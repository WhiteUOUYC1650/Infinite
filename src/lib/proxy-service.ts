
'use client';
/**
 * @fileOverview Singleton service for masked WebSocket communication (WEB Proxy / Traffic Masking).
 */

import { encryptPacket, decryptPacket, generateHmacToken } from './proxy-crypto';

class ProxyService {
    private static instance: ProxyService;
    private ws: WebSocket | null = null;
    private listeners: ((data: any) => void)[] = [];

    private constructor() {}

    public static getInstance(): ProxyService {
        if (!ProxyService.instance) {
            ProxyService.instance = new ProxyService();
        }
        return ProxyService.instance;
    }

    /**
     * Establishes a masked WebSocket tunnel.
     * @param proxyUrl The address of the relay server.
     * @param mask The whitelisted domain to mask traffic under.
     */
    public async connect(proxyUrl: string, mask: string = 'vk.com'): Promise<void> {
        if (this.ws) {
            try { this.ws.close(); } catch (e) {}
        }

        return new Promise(async (resolve, reject) => {
            try {
                const token = await generateHmacToken();
                // Masking: The 'mask' parameter tells the relay server to wrap the traffic
                // in a way that looks like standard interaction with a whitelisted site.
                let wsUrl = `${proxyUrl}/tunnel?auth=${encodeURIComponent(token)}&mask=${encodeURIComponent(mask)}`;

                if (typeof window !== 'undefined' && window.location.protocol === 'https:' && wsUrl.startsWith('ws:')) {
                    wsUrl = wsUrl.replace('ws:', 'wss:');
                }

                console.log(`Establishing masked connection to: ${mask} (via ${wsUrl})`);
                const socket = new WebSocket(wsUrl);
                this.ws = socket;

                const timeout = setTimeout(() => {
                    if (socket.readyState !== WebSocket.OPEN) {
                        socket.close();
                        reject(new Error("Connection timed out. Masking failed."));
                    }
                }, 10000);

                socket.onopen = () => {
                    clearTimeout(timeout);
                    console.log(`Masked tunnel active under domain: ${mask}`);
                    resolve();
                };

                socket.onmessage = async (event) => {
                    const decrypted = await decryptPacket(event.data);
                    if (decrypted) {
                        this.listeners.forEach(l => l(decrypted));
                    }
                };

                socket.onerror = (err) => {
                    clearTimeout(timeout);
                    console.error("Masking Error:", err);
                    reject(new Error(`Failed to mask traffic under ${mask}. Check domain access.`));
                };
                
                socket.onclose = (event) => {
                    console.log("Masked session closed", event.code);
                };

            } catch (e) {
                console.error("Masking Initialization Error:", e);
                reject(e);
            }
        });
    }

    public async send(payload: any) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const encrypted = await encryptPacket(payload);
        this.ws.send(encrypted);
    }

    public addListener(cb: (data: any) => void) {
        this.listeners.push(cb);
    }
}

export const proxyService = ProxyService.getInstance();
