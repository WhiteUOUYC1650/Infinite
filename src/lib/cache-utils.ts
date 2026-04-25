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
 * Converts a base64 data URI to a Blob.
 */
function dataURItoBlob(dataURI: string): Blob {
  const parts = dataURI.split(',');
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
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

export async function cacheFile(id: string, data: string | Blob): Promise<void> {
  try {
    const db = await openCacheDB();
    const blob = typeof data === 'string' ? dataURItoBlob(data) : data;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('IndexedDB Put error:', e);
  }
}

export async function fetchAndCacheImage(id: string, url: string): Promise<string | null> {
  const cached = await getCachedFile(id);
  if (cached) return cached;

  try {
    // Avoid re-fetching base64 images
    if (url.startsWith('data:')) {
        await cacheFile(id, url);
        return await getCachedFile(id);
    }

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
      request.onsuccess = () => resolve();
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
