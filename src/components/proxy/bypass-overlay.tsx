'use client';

import React, { useState } from 'react';
import { ShieldAlert, Globe, ArrowRight, Loader2, CheckCircle2, XCircle, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/language-context';
import { proxyService } from '@/lib/proxy-service';
import { useToast } from '@/hooks/use-toast';

export function BypassOverlay({ onRetry, onBypassSuccess }: { onRetry: () => void, onBypassSuccess?: () => void }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [domain, setDomain] = useState('vk.com');
    const [isChecking, setIsChecking] = useState(false);
    const [isConnectingProxy, setIsConnectingProxy] = useState(false);
    const [status, setStatus] = useState<'idle' | 'ok' | 'blocked'>('idle');
    const [error, setError] = useState<string | null>(null);

    const checkConnectivity = async () => {
        setIsChecking(true);
        setStatus('idle');
        setError(null);
        try {
            // Using no-cors to check if the "white" domain is reachable
            await fetch(`https://${domain}`, { mode: 'no-cors' });
            setStatus('ok');
        } catch (e) {
            setStatus('blocked');
        } finally {
            setIsChecking(false);
        }
    };

    const handleConnectProxy = async () => {
        setIsConnectingProxy(true);
        setError(null);
        try {
            // Stealth logic: We are masking our traffic as if it's going to the whitelisted domain.
            const relayUrl = 'wss://relay.infinite.white'; 
            await proxyService.connect(relayUrl, domain);
            
            toast({ title: t('dm_success'), description: `Traffic masked under ${domain}!` });
            
            if (onBypassSuccess) {
                onBypassSuccess();
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to establish masked tunnel.");
        } finally {
            setIsConnectingProxy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="max-w-md w-full glass-panel p-10 rounded-[3rem] border-none shadow-2xl space-y-8 text-center bg-card/60 backdrop-blur-3xl relative">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4 experimental-glow">
                    <Globe className="h-10 w-10 text-primary animate-pulse" />
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-3xl font-black font-headline tracking-tighter">Infinite Stealth</h2>
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

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3 text-red-500 text-xs font-bold animate-in zoom-in">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <Button onClick={handleConnectProxy} disabled={isConnectingProxy} className="w-full h-14 rounded-2xl font-black text-lg gap-3 shadow-xl bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95">
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
