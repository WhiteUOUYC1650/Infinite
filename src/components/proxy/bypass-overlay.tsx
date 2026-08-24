'use client';

import React, { useState } from 'react';
import { ShieldAlert, Globe, ArrowRight, Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/language-context';
import { proxyService } from '@/lib/proxy-service';

export function BypassOverlay({ onRetry }: { onRetry: () => void }) {
    const { t } = useLanguage();
    const [domain, setDomain] = useState('vk.com');
    const [isChecking, setIsChecking] = useState(false);
    const [isConnectingProxy, setIsConnectingProxy] = useState(false);
    const [status, setStatus] = useState<'idle' | 'ok' | 'blocked'>('idle');

    const checkConnectivity = async () => {
        setIsChecking(true);
        setStatus('idle');
        try {
            // Using no-cors to bypass CORS blocks for testing reachability
            const resp = await fetch(`https://${domain}`, { mode: 'no-cors' });
            setStatus('ok');
        } catch (e) {
            setStatus('blocked');
        } finally {
            setIsChecking(false);
        }
    };

    const handleConnectProxy = async () => {
        setIsConnectingProxy(true);
        try {
            // We use a predefined relay URL or build one based on the white domain
            const relayUrl = 'ws://relay.infinite.white'; // Example
            await proxyService.connect(relayUrl, domain);
            // After connection logic, we would trigger a refresh or state change in page.tsx
            onRetry(); 
        } catch (e) {
            console.error(e);
        } finally {
            setIsConnectingProxy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="max-w-md w-full glass-panel p-10 rounded-[3rem] border-none shadow-2xl space-y-8 text-center bg-card/60 backdrop-blur-3xl">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4 experimental-glow">
                    <Globe className="h-10 w-10 text-primary animate-pulse" />
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-3xl font-black font-headline tracking-tighter">Infinite Bypass</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                        {t('bypass_description')}
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <Input 
                            value={domain}
                            onChange={e => setDomain(e.target.value.replace('https://', ''))}
                            placeholder="Напр. avito.ru"
                            className="h-14 rounded-2xl bg-background/40 border-white/20 pl-6 font-bold text-lg focus-visible:ring-primary"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {status === 'ok' && <CheckCircle2 className="text-green-500 h-5 w-5" />}
                            {status === 'blocked' && <XCircle className="text-red-500 h-5 w-5" />}
                            <Button size="sm" onClick={checkConnectivity} disabled={isChecking} className="rounded-xl h-10 px-4 font-black">
                                {isChecking ? <Loader2 className="animate-spin h-4 w-4" /> : t('test')}
                            </Button>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        {t('enter_white_domain')}
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <Button onClick={handleConnectProxy} disabled={isConnectingProxy} className="w-full h-14 rounded-2xl font-black text-lg gap-3 shadow-xl bg-indigo-600 hover:bg-indigo-700">
                        {isConnectingProxy ? <Loader2 className="animate-spin h-5 w-5" /> : <Zap className="h-5 w-5 fill-current" />}
                        {t('launch_via_proxy')}
                    </Button>
                    <Button variant="ghost" onClick={onRetry} className="w-full h-12 rounded-2xl font-bold text-sm gap-3">
                        {t('retry_connection')} <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
