
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

    public async connect(proxyUrl: string, whiteDomain: string = 'vk.com') {
        if (this.ws) this.ws.close();

        const token = await generateHmacToken();
        const wsUrl = `${proxyUrl}/tunnel?auth=${encodeURIComponent(token)}&mask=${whiteDomain}`;

        // In a real browser we can't fully spoof Origin headers in WebSocket constructor,
        // but the Proxy relay on Node side will check the dynamic token.
        this.ws = new WebSocket(wsUrl);

        this.ws.onmessage = async (event) => {
            const decrypted = await decryptPacket(event.data);
            if (decrypted) {
                this.listeners.forEach(l => l(decrypted));
            }
        };

        this.ws.onerror = (err) => console.error("Proxy Tunnel Error", err);
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
