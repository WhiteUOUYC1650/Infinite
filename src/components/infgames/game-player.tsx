'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import type { AuthenticatedUser, CustomGame, BotBlock, User } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Trophy, Ban, X, Coins, Sparkles, RefreshCw, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export function GamePlayer({ gameId, currentUser, onBack }: { gameId: string, currentUser: AuthenticatedUser, onBack: () => void }) {
    const { t } = useLanguage();
    const db = useFirestore();
    const { toast } = useToast();
    
    const [game, setGame] = useState<CustomGame | null>(null);
    const [owner, setOwner] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [gameState, setGameState] = useState<'playing' | 'win' | 'lose'>('playing');
    const [gameVars, setGameVars] = useState<Record<string, any>>({});
    const [winReward, setWinReward] = useState(0);

    const resolveVars = (text: string = '', vars: Record<string, any>) => text.replace(/\{(\w+)\}/g, (match, key) => vars[key] || match);

    const executeLogic = useCallback(async (triggerType: string, params?: any) => {
        if (!game || gameState !== 'playing') return;

        for (const script of game.scripts) {
            const blocks = script.blocks;
            if (!blocks || blocks.length === 0 || blocks[0].type !== triggerType) continue;

            let i = 1;
            const ifStack: boolean[] = [];
            let stopped = false;
            let currentVars = { ...gameVars };

            while (i < blocks.length && !stopped) {
                const block = blocks[i];
                if (block.type === 'logic_end_if') { ifStack.pop(); i++; continue; }
                if (block.type === 'logic_else') { if (ifStack.length > 0) { ifStack[ifStack.length - 1] = !ifStack[ifStack.length - 1]; } i++; continue; }
                if (ifStack.some(val => val === false)) { if (block.type === 'logic_if') ifStack.push(false); i++; continue; }

                switch (block.type) {
                    case 'logic_if':
                        const cond = resolveVars(block.params?.condition, currentVars);
                        if (cond.includes('==')) {
                            const [left, right] = cond.split('==').map(s => s.trim());
                            ifStack.push(left === right);
                        } else if (cond.includes('!=')) {
                            const [left, right] = cond.split('!=').map(s => s.trim());
                            ifStack.push(left !== right);
                        } else { ifStack.push(false); }
                        break;
                    case 'variable_set':
                        currentVars[block.params?.name] = resolveVars(block.params?.value, currentVars);
                        break;
                    case 'variable_math':
                        const val = parseInt(currentVars[block.params?.name] || '0');
                        const delta = parseInt(resolveVars(block.params?.value, currentVars) || '0');
                        if (block.params?.op === 'sub') currentVars[block.params?.name] = (val - delta);
                        else if (block.params?.op === 'mul') currentVars[block.params?.name] = (val * delta);
                        else currentVars[block.params?.name] = (val + delta);
                        break;
                    case 'variable_random':
                        const max = parseInt(resolveVars(block.params?.value, currentVars) || '100');
                        currentVars[block.params?.name] = Math.floor(Math.random() * (max + 1));
                        break;
                    case 'action_game_win':
                        setWinReward(parseInt(block.params?.reward || '0'));
                        setGameState('win');
                        stopped = true;
                        break;
                    case 'action_game_lose':
                        setGameState('lose');
                        stopped = true;
                        break;
                    case 'action_wait':
                        await new Promise(res => setTimeout(res, (block.params?.seconds || 1) * 1000));
                        break;
                }
                i++;
            }
            setGameVars(currentVars);
        }
    }, [game, gameState, gameVars]);

    useEffect(() => {
        if (!db || !gameId) return;
        const fetchGame = async () => {
            setIsLoading(true);
            const snap = await getDoc(doc(db, 'customGames', gameId));
            if (snap.exists()) {
                const gData = { id: snap.id, ...snap.data() } as CustomGame;
                setGame(gData);
                
                // Fetch owner name
                const ownerSnap = await getDoc(doc(db, 'users', gData.ownerId));
                if (ownerSnap.exists()) {
                    setOwner({ id: ownerSnap.id, ...ownerSnap.data() } as User);
                }
            }
            setIsLoading(false);
        };
        fetchGame();
    }, [db, gameId]);

    useEffect(() => {
        if (game) executeLogic('event_game_start');
    }, [game]);

    const handleClaimReward = async () => {
        if (!db || winReward <= 0 || !game) { onBack(); return; }
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                infGoldBalance: increment(winReward)
            });
            toast({ title: t('dm_success'), description: `+${winReward} InfGold!` });
            onBack();
        } catch (e) {
            console.error(e);
            onBack();
        }
    };

    const currentUI = useMemo(() => {
        if (!game) return [];
        const blocks: BotBlock[] = [];
        game.scripts.forEach(s => {
            s.blocks.forEach(b => {
                if (b.type.startsWith('ui_')) blocks.push(b);
            });
        });
        return blocks;
    }, [game]);

    if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    if (!game) return <div className="text-center py-20 text-muted-foreground">Game not found.</div>;

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in duration-300">
            <header className="h-14 border-b flex items-center px-4 shrink-0 bg-background pt-[calc(0.5rem+env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full h-10 w-10">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 text-center min-w-0 px-2">
                    <h2 className="text-sm font-black font-headline uppercase tracking-widest truncate">{game.name}</h2>
                    {owner && (
                        <div className="flex items-center justify-center gap-1 opacity-60">
                            <span className="text-[8px] font-black uppercase tracking-[0.2em]">by {owner.name}</span>
                        </div>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full h-10 w-10">
                    <X className="h-5 w-5" />
                </Button>
            </header>

            <main className="flex-1 relative overflow-hidden" onClick={() => executeLogic('event_game_click')}>
                {gameState === 'playing' ? (
                    <ScrollArea className="h-full">
                        <div className="p-8 max-w-md mx-auto space-y-6">
                            <div className="flex flex-wrap gap-2 justify-center mb-8">
                                {Object.entries(gameVars).map(([name, val]) => (
                                    <div key={name} className="bg-primary/5 border border-primary/20 text-primary font-black uppercase text-[10px] px-3 py-1 rounded-full">
                                        {name}: {val}
                                    </div>
                                ))}
                            </div>
                            
                            <div className="space-y-4">
                                {currentUI.map(block => {
                                    const text = resolveVars(block.params?.text, gameVars);
                                    switch (block.type) {
                                        case 'ui_header': return <h3 key={block.id} className="text-3xl font-black font-headline text-center text-primary leading-none uppercase tracking-tighter">{text}</h3>;
                                        case 'ui_text': return <p key={block.id} className="text-center font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</p>;
                                        case 'ui_button': return <Button key={block.id} onClick={(e) => { e.stopPropagation(); executeLogic('event_button_click', { buttonId: block.params?.buttonId }); }} className="w-full h-16 rounded-[1.5rem] font-black text-lg shadow-xl uppercase tracking-widest">{text}</Button>;
                                        case 'ui_separator': return <Separator key={block.id} className="my-8 opacity-40" />;
                                        default: return null;
                                    }
                                })}
                            </div>

                            {currentUI.length === 0 && (
                                <div className="text-center py-20 text-muted-foreground opacity-30 animate-pulse">
                                    <Gamepad2 className="w-20 h-20 mx-auto mb-4" />
                                    <p className="font-black uppercase text-xs">Waiting for Interaction</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                ) : gameState === 'win' ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-700 bg-green-500/5">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                            <Trophy className="w-32 h-32 text-green-500 relative z-10 drop-shadow-2xl" />
                        </div>
                        <h2 className="text-5xl font-black font-headline text-green-600 uppercase tracking-tighter mb-4">{t('game_win_title')}</h2>
                        <div className="bg-white dark:bg-zinc-900 border-2 border-green-500/20 p-8 rounded-[2.5rem] shadow-2xl space-y-4 mb-10 w-full max-w-xs">
                             <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">Reward Unlocked</p>
                             <div className="flex items-center justify-center gap-3 text-5xl font-black text-primary">
                                 <InfGoldIcon className="w-10 h-10" />
                                 <span>{winReward}</span>
                             </div>
                        </div>
                        <Button onClick={handleClaimReward} size="lg" className="h-16 px-12 rounded-2xl font-black text-xl bg-green-600 hover:bg-green-700 shadow-xl shadow-green-600/20 w-full max-w-xs uppercase tracking-widest">
                            {t('claim_gold')}
                        </Button>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 bg-red-500/5">
                        <Ban className="w-24 h-24 text-red-500 mb-6 opacity-80" />
                        <h2 className="text-4xl font-black font-headline text-red-600 uppercase tracking-tighter mb-2">{t('game_lose_title')}</h2>
                        <p className="text-muted-foreground font-bold mb-10">Don't give up! Try again to earn rewards.</p>
                        <div className="grid grid-cols-1 w-full max-w-xs gap-3">
                            <Button onClick={() => { setGameState('playing'); setGameVars({}); executeLogic('event_game_start'); }} size="lg" className="h-14 rounded-2xl font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/20">
                                <RefreshCw className="mr-2 h-5 w-5" /> RESTART
                            </Button>
                            <Button variant="ghost" onClick={onBack} className="h-12 font-bold uppercase tracking-widest text-muted-foreground">Exit</Button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
