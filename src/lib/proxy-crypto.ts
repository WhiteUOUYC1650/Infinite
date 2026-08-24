
/**
 * @fileOverview Crypto utilities for WEB Proxy (AES-256-GCM and HMAC-SHA256).
 */

const PROXY_SECRET = 'infinite_white_proxy_2024';

export async function encryptPacket(data: any): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(PROXY_SECRET.padEnd(32, '0').slice(0, 32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const key = await crypto.subtle.importKey(
        'raw', keyData, 'AES-GCM', false, ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(JSON.stringify(data))
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
}

export async function decryptPacket(base64: string): Promise<any> {
    try {
        const combined = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const encoder = new TextEncoder();
        const keyData = encoder.encode(PROXY_SECRET.padEnd(32, '0').slice(0, 32));

        const key = await crypto.subtle.importKey(
            'raw', keyData, 'AES-GCM', false, ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
        console.error("Proxy Decryption Error", e);
        return null;
    }
}

export async function generateHmacToken(): Promise<string> {
    const encoder = new TextEncoder();
    const timestamp = Math.floor(Date.now() / 10000).toString(); // Changes every 10s
    const keyData = encoder.encode(PROXY_SECRET);
    
    const key = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(timestamp));
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
