'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, Unlock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/theme-context';

export function PinLockOverlay({ onUnlock }: { onUnlock: () => void }) {
    const { t } = useLanguage();
    const { glassEffect } = useTheme();
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Focus input on mount
        setTimeout(() => inputRef.current?.focus(), 500);
    }, []);

    const handleUnlock = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (isChecking) return;

        setIsChecking(true);
        const savedPin = localStorage.getItem('app-local-pin');
        
        if (pin === savedPin) {
            onUnlock();
        } else {
            setError(true);
            setPin('');
            setTimeout(() => setError(false), 500);
            inputRef.current?.focus();
        }
        setIsChecking(false);
    };

    return (
        <div className="fixed inset-0 z-[500] bg-background flex items-center justify-center p-6 animate-in fade-in duration-500 overflow-hidden">
            <div className={cn(
                "max-w-md w-full p-10 rounded-[3rem] text-center space-y-8 animate-in zoom-in duration-300 transition-all",
                glassEffect ? "glass-panel bg-card/60 backdrop-blur-3xl border-none shadow-2xl" : "bg-card border shadow-xl",
                error && "animate-shake border-red-500/50 shadow-red-500/10"
            )}>
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4 experimental-glow">
                    {error ? <AlertCircle className="h-10 w-10 text-red-500" /> : <Lock className="h-10 w-10 text-primary" />}
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-3xl font-black font-headline tracking-tighter">Infinite Lock</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                        {t('enter_pin')}
                    </p>
                </div>

                <form onSubmit={handleUnlock} className="space-y-6">
                    <div className="relative">
                        <Input 
                            ref={inputRef}
                            type="password"
                            value={pin}
                            onChange={e => setPin(e.target.value)}
                            placeholder="••••"
                            className="h-16 rounded-2xl bg-background/40 border-white/20 text-center font-black text-3xl tracking-[0.5em] focus-visible:ring-primary"
                            maxLength={16}
                            autoFocus
                        />
                    </div>

                    <Button 
                        type="submit"
                        disabled={pin.length < 4 || isChecking} 
                        className="w-full h-14 rounded-2xl font-black text-lg gap-3 shadow-xl transition-all active:scale-95"
                    >
                        {isChecking ? <Loader2 className="animate-spin" /> : <Unlock className="h-5 w-5" />}
                        {t('ok')}
                    </Button>
                </form>

                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {t('local_pin_lock_desc')}
                </p>
            </div>
        </div>
    );
}
