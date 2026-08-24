
'use client';

import React, { useState } from 'react';
import { ShieldAlert, Globe, ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function BypassOverlay({ onRetry }: { onRetry: () => void }) {
    const [domain, setDomain] = useState('vk.com');
    const [isChecking, setIsChecking] = useState(false);
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

    return (
        <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="max-w-md w-full glass-panel p-10 rounded-[3rem] border-none shadow-2xl space-y-8 text-center bg-card/60 backdrop-blur-3xl">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4 experimental-glow">
                    <Globe className="h-10 w-10 text-primary animate-pulse" />
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-3xl font-black font-headline tracking-tighter">Infinite Bypass</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                        Это попытка обойти «белые списки» Рунета. Мы тестируем маскировку трафика под легитимные сервисы.
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
                                {isChecking ? <Loader2 className="animate-spin h-4 w-4" /> : "TEST"}
                            </Button>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Введите доступный домен для проверки блокировки
                    </p>
                </div>

                <Button onClick={onRetry} className="w-full h-14 rounded-2xl font-black text-lg gap-3 shadow-xl">
                    Повторить подключение <ArrowRight className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
