
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/types';
import { Gamepad2, ArrowLeft, Trophy, MousePointer2, Loader2, Sparkles, ShieldAlert, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { InfGoldIcon } from '../ui/inf-gold-icon';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';

type GameType = 'none' | 'gold_clicker';

export function InfGamesView({ currentUser, onClose }: { currentUser: AuthenticatedUser, onClose: () => void }) {
  const { t } = useLanguage();
  const [selectedGame, setSelectedGame] = useState<GameType>('none');

  const renderContent = () => {
    switch (selectedGame) {
      case 'gold_clicker':
        return <GoldClickerGame currentUser={currentUser} onBack={() => setSelectedGame('none')} />;
      default:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            <GameCard 
              title={t('game_gold_clicker')}
              description={t('game_gold_clicker_desc')}
              icon={MousePointer2}
              color="bg-amber-500"
              onClick={() => setSelectedGame('gold_clicker')}
            />
            {/* Placeholder for future games */}
            <div className="border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-muted-foreground/40 gap-4">
                <Gamepad2 className="h-12 w-12" />
                <p className="font-bold uppercase tracking-widest text-xs">{t('placeholder_title')}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b px-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={selectedGame === 'none' ? onClose : () => setSelectedGame('none')}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 overflow-hidden">
                <Gamepad2 className="h-8 w-8 text-primary shrink-0" />
                <h1 className="text-xl font-bold font-headline truncate">
                    {selectedGame === 'none' ? t('infgames_title') : t(`game_${selectedGame}` as any)}
                </h1>
                <Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none shrink-0">BETA</Badge>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="bg-primary/10 px-3 py-1.5 rounded-full flex items-center gap-2 border border-primary/20">
                <InfGoldIcon className="w-4 h-4" />
                <span className="font-bold text-sm">{currentUser.infGoldBalance || 0}</span>
            </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/5">
        {renderContent()}
      </main>
    </div>
  );
}

function GameCard({ title, description, icon: Icon, color, onClick }: { title: string, description: string, icon: any, color: string, onClick: () => void }) {
    const { t } = useLanguage();
    return (
        <div className="group bg-card border rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col gap-4 overflow-hidden relative" onClick={onClick}>
            <div className={cn("absolute -top-10 -right-10 w-32 h-32 blur-3xl opacity-20 transition-opacity group-hover:opacity-40", color)} />
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>
                <Icon className="h-8 w-8" />
            </div>
            <div className="space-y-1">
                <h3 className="text-xl font-bold font-headline">{title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            </div>
            <Button className="w-full mt-2 rounded-2xl font-bold bg-primary group-hover:scale-105 transition-transform">
                {t('play')}
            </Button>
        </div>
    );
}

function GoldClickerGame({ currentUser, onBack }: { currentUser: AuthenticatedUser, onBack: () => void }) {
    const { t } = useLanguage();
    const db = useFirestore();
    const { toast } = useToast();
    
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
    const [isSaving, setIsSaving] = useState(false);
    const [isCheating, setIsCheating] = useState(false);
    
    const lastClickTimeRef = useRef<number>(0);
    const lastClickPosRef = useRef<{x: number, y: number}>({x: 0, y: 0});
    const identicalPosCountRef = useRef<number>(0);
    const clickIntervalsRef = useRef<number[]>([]);

    const startGame = () => {
        setScore(0);
        setGameState('playing');
        setIsCheating(false);
        lastClickTimeRef.current = 0;
        identicalPosCountRef.current = 0;
        clickIntervalsRef.current = [];
    };

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (gameState !== 'playing') return;

        const now = performance.now();
        const { clientX, clientY } = e;

        if (!e.isTrusted) {
            setIsCheating(true);
        }

        if (lastClickTimeRef.current > 0) {
            const interval = now - lastClickTimeRef.current;
            
            if (clientX === lastClickPosRef.current.x && clientY === lastClickPosRef.current.y) {
                identicalPosCountRef.current += 1;
                if (identicalPosCountRef.current > 10) {
                    setIsCheating(true);
                }
            } else {
                identicalPosCountRef.current = 0;
            }

            clickIntervalsRef.current.push(interval);
            if (clickIntervalsRef.current.length > 15) {
                const recentIntervals = clickIntervalsRef.current.slice(-15);
                const avg = recentIntervals.reduce((a, b) => a + b, 0) / 15;
                const variance = recentIntervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / 15;
                if (variance < 1.2) { 
                    setIsCheating(true);
                }
            }
        }

        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x: clientX, y: clientY };
        setScore(prev => prev + 1);
    }, [gameState]);

    const handleClaim = async () => {
        if (!db || isSaving || isCheating) {
            if (isCheating) {
                toast({ variant: 'destructive', title: 'Anti-Cheat', description: 'Auto-clicker detected. Reward cancelled.' });
                onBack();
            }
            return;
        }
        
        const reward = Math.floor(score / 1000);
        
        setIsSaving(true);
        try {
            if (reward > 0) {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    infGoldBalance: increment(reward)
                });
                toast({ title: t('dm_success'), description: `+${reward} InfGold!` });
            }
            onBack();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to claim reward.' });
        } finally {
            setIsSaving(false);
        }
    };

    const nextGoldProgress = (score % 1000) / 10;
    const earnedGold = Math.floor(score / 1000);

    return (
        <div className="max-w-md mx-auto flex flex-col items-center gap-8 py-8 animate-in fade-in zoom-in duration-300">
            {gameState === 'idle' && (
                <div className="text-center space-y-6">
                    <div className="w-32 h-32 bg-amber-500 rounded-full flex items-center justify-center mx-auto shadow-2xl experimental-glow">
                        <InfGoldIcon className="w-16 h-16 text-white" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black font-headline text-amber-600">{t('game_gold_clicker')}</h2>
                        <p className="text-muted-foreground">{t('game_gold_clicker_desc')}</p>
                    </div>
                    <Button onClick={startGame} size="lg" className="rounded-full px-12 h-14 font-black text-lg bg-amber-500 hover:bg-amber-600 shadow-xl">
                        {t('play')}
                    </Button>
                </div>
            )}

            {gameState === 'playing' && (
                <div className="w-full flex flex-col items-center gap-8">
                    <div className="w-full bg-card border p-6 rounded-3xl shadow-lg space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('inf_gold_balance')}</p>
                                <div className="flex items-center gap-2 text-3xl font-black">
                                    <InfGoldIcon className="w-6 h-6" />
                                    <span>{earnedGold}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">КЛИКИ</p>
                                <p className="text-xl font-bold font-mono">{score}</p>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                                <span>До следующего Gold</span>
                                <span>{score % 1000} / 1000</span>
                            </div>
                            <Progress value={nextGoldProgress} className="h-2" />
                        </div>
                    </div>

                    <button 
                        onMouseDown={handleClick}
                        className={cn(
                            "w-64 h-64 bg-amber-500 rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all select-none relative group",
                            isCheating && "bg-red-500 shadow-red-500/50"
                        )}
                    >
                        <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-20 pointer-events-none" />
                        {isCheating ? (
                            <Ban className="w-24 h-24 text-white drop-shadow-lg" />
                        ) : (
                            <MousePointer2 className="w-24 h-24 text-white drop-shadow-lg" />
                        )}
                    </button>
                    
                    {isCheating ? (
                        <div className="flex items-center gap-2 text-red-500 font-bold animate-bounce bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                            <ShieldAlert className="h-4 w-4" />
                            <span>FAIR PLAY REQUIRED</span>
                        </div>
                    ) : (
                        <p className="font-bold text-muted-foreground uppercase tracking-widest text-[10px] animate-pulse">Кликай, чтобы заработать!</p>
                    )}

                    <div className="w-full space-y-3 pt-4">
                        <Button 
                            onClick={handleClaim} 
                            disabled={isSaving} 
                            variant={earnedGold > 0 ? "default" : "outline"}
                            size="lg" 
                            className={cn(
                                "w-full rounded-2xl h-14 font-bold shadow-lg transition-all",
                                earnedGold > 0 && !isCheating ? "bg-green-500 hover:bg-green-600 shadow-green-500/20" : ""
                            )}
                        >
                            {isSaving ? <Loader2 className="animate-spin" /> : (
                                isCheating ? <><Ban className="mr-2 h-4 w-4" /> REWARD DISABLED</> :
                                <><Sparkles className="mr-2 h-5 w-5" /> {earnedGold > 0 ? `Забрать ${earnedGold} Gold` : 'Закончить и выйти'}</>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
