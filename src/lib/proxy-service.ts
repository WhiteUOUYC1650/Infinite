
'use client';
/**
 * @fileOverview Singleton service for masked WebSocket communication (WEB Proxy).
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

    public async connect(proxyUrl: string, whiteDomain: string = 'vk.com'): Promise<void> {
        if (this.ws) {
            try { this.ws.close(); } catch (e) {}
        }

        return new Promise(async (resolve, reject) => {
            try {
                const token = await generateHmacToken();
                let wsUrl = `${proxyUrl}/tunnel?auth=${encodeURIComponent(token)}&mask=${whiteDomain}`;

                // Ensure secure websocket on HTTPS pages to prevent Mixed Content errors
                if (typeof window !== 'undefined' && window.location.protocol === 'https:' && wsUrl.startsWith('ws:')) {
                    wsUrl = wsUrl.replace('ws:', 'wss:');
                }

                console.log(`Connecting to proxy: ${wsUrl}`);
                const socket = new WebSocket(wsUrl);
                this.ws = socket;

                // Timeout for connection
                const timeout = setTimeout(() => {
                    if (socket.readyState !== WebSocket.OPEN) {
                        socket.close();
                        reject(new Error("Connection timed out."));
                    }
                }, 10000);

                socket.onopen = () => {
                    clearTimeout(timeout);
                    console.log("Proxy Tunnel Connected");
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
                    console.error("Proxy Tunnel Error:", err);
                    reject(new Error("Failed to connect to proxy server. Please check the address or your network."));
                };
                
                socket.onclose = (event) => {
                    console.log("Proxy Tunnel Closed", event.code, event.reason);
                };

            } catch (e) {
                console.error("Proxy Initialization Error:", e);
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
