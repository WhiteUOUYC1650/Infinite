
/**
 * @fileOverview Utility for persistent caching of media and files using IndexedDB with Blob support.
 */

const DB_NAME = 'infinite_cache_v2';
const STORE_NAME = 'files';
const DB_VERSION = 1;

export async function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Converts a base64 data URI to a Blob safely.
 */
function dataURItoBlob(dataURI: string): Blob {
  try {
    const parts = dataURI.split(',');
    if (parts.length < 2) throw new Error('Invalid Data URI');
    
    // Robustly handle base64 decoding errors
    let byteString;
    try {
        byteString = atob(parts[1]);
    } catch (atobError) {
        console.warn('atob decoding failed, returning empty blob', atobError);
        return new Blob([], { type: 'application/octet-stream' });
    }

    const mimeString = parts[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (e) {
    console.error('DataURI conversion failed', e);
    return new Blob([], { type: 'application/octet-stream' });
  }
}

export async function getCachedFile(id: string): Promise<string | null> {
  try {
    const db = await openCacheDB();
    const result = await new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (result instanceof Blob) {
      return URL.createObjectURL(result);
    }
    return null;
  } catch (e) {
    console.error('IndexedDB Get error:', e);
    return null;
  }
}

const CACHE_INDEX_KEY = 'infinite-cache-index';
const CACHE_LIMIT_KEY = 'app-cache-limit-bytes';

/** 0 = unlimited (the cache is only cleared manually). */
export function getCacheLimitBytes(): number {
  if (typeof localStorage === 'undefined') return 0;
  const raw = localStorage.getItem(CACHE_LIMIT_KEY);
  const value = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Pass 0 to make the cache unlimited again. */
export function setCacheLimitBytes(bytes: number): void {
  if (typeof localStorage === 'undefined') return;
  const value = Math.max(0, Math.round(bytes));
  localStorage.setItem(CACHE_LIMIT_KEY, String(value));
}

type CacheIndexEntry = { size: number; ts: number };
type CacheIndex = Record<string, CacheIndexEntry>;

function readCacheIndex(): CacheIndex {
  try {
    return JSON.parse(localStorage.getItem(CACHE_INDEX_KEY) || '{}') as CacheIndex;
  } catch {
    return {};
  }
}

function writeCacheIndex(index: CacheIndex): void {
  try {
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    /* quota exceeded - the next enforce pass will rebuild it */
  }
}

async function deleteCachedFile(id: string): Promise<void> {
  try {
    const db = await openCacheDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Could not delete cached file', e);
  }
}

/**
 * Deletes the oldest cached files until the total size fits the user limit.
 * Does nothing when the cache is unlimited (limit === 0).
 */
export async function enforceCacheLimit(): Promise<number> {
  const limit = getCacheLimitBytes();
  if (!limit) return 0;

  const index = readCacheIndex();
  let entries = Object.entries(index);
  let total = entries.reduce((sum, [, entry]) => sum + (entry.size || 0), 0);
  if (total <= limit) return 0;

  // Oldest first (entries without a timestamp are treated as the oldest).
  entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));

  let removed = 0;
  for (const [id, entry] of entries) {
    if (total <= limit) break;
    await deleteCachedFile(id);
    total -= entry.size || 0;
    removed += 1;
    delete index[id];
    writeCacheIndex(index);
  }

  return removed;
}

export async function cacheFile(id: string, data: string | Blob): Promise<void> {
  try {
    const db = await openCacheDB();
    const blob = typeof data === 'string' ? dataURItoBlob(data) : data;

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Remember the size/time so the optional cache limit can evict the oldest
    // entries when the cache is full.
    const index = readCacheIndex();
    index[id] = { size: blob.size || 0, ts: Date.now() };
    writeCacheIndex(index);

    if (getCacheLimitBytes()) void enforceCacheLimit();
  } catch (e) {
    console.error('IndexedDB Put error:', e);
  }
}

export async function fetchAndCacheImage(id: string, url: string): Promise<string | null> {
  // Check if already cached
  const cached = await getCachedFile(id);
  if (cached) return cached;

  try {
    // Avoid re-fetching base64 images, just store them
    if (url.startsWith('data:')) {
        await cacheFile(id, url);
        return await getCachedFile(id);
    }

    // Standard HTTP URL
    const response = await fetch(url);
    const blob = await response.blob();
    await cacheFile(id, blob);
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Fetch and cache error:', e);
    return null;
  }
}

export async function clearCacheDB(): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => {
        writeCacheIndex({});
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('IndexedDB Clear error:', e);
  }
}

/**
 * Calculates the total size of the media cache store.
 */
export async function calculateCacheSize(): Promise<number> {
  try {
    const db = await openCacheDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    let total = 0;

    return new Promise((resolve) => {
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          const value = cursor.value;
          if (value instanceof Blob) {
            total += value.size;
          } else if (typeof value === 'string') {
            total += value.length;
          }
          cursor.continue();
        } else {
          resolve(total);
        }
      };
      cursorRequest.onerror = () => resolve(total);
    });
  } catch (e) {
    return 0;
  }
}
