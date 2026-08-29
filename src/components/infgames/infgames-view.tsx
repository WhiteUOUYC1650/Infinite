'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, increment, limit } from 'firebase/firestore';
import type { AuthenticatedUser, CustomGame } from '@/types';
import { Gamepad2, ArrowLeft, Trophy, MousePointer2, Loader2, Sparkles, ShieldAlert, Ban, Zap, Smartphone, ShieldCheck, Lock, AlertTriangle, MessageCircle, X, Send, Code2, LayoutGrid, Coins, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { InfGoldIcon } from '../ui/inf-gold-icon';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { useTheme } from '@/context/theme-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Capacitor } from '@capacitor/core';
import { GameStudioView } from './game-studio-view';
import { GamePlayer } from './game-player';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBatchUsers } from '@/hooks/use-batch-users';

type GameType = 'none' | 'gold_clicker' | 'max_simulator' | 'studio' | 'player';

export function InfGamesView({ currentUser, onClose }: { currentUser: AuthenticatedUser, onClose: () => void }) {
  const { t } = useLanguage();
  const { theme: colorTheme } = useTheme();
  const db = useFirestore();
  const [selectedGame, setSelectedGame] = useState<GameType>('none');
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [playingGameId, setPlayingGameId] = useState<string | null>(null);

  const publicGamesQuery = useMemo(() => (db ? query(collection(db, 'customGames'), where('isActive', '==', true), orderBy('installs', 'desc'), limit(50)) : null), [db]);
  const { data: publicGames } = useCollection<CustomGame>(publicGamesQuery);

  const ownerIds = useMemo(() => Array.from(new Set(publicGames?.map(g => g.ownerId) || [])), [publicGames]);
  const { users: authors } = useBatchUsers(ownerIds);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handleSystemBack = () => {
        if (selectedGame !== 'none') setSelectedGame('none');
        else onClose();
    };
    let backListener: any;
    import('@capacitor/app').then(({ App }) => {
        backListener = App.addListener('backButton', handleSystemBack);
    });
    return () => { if (backListener) backListener.then((l: any) => l.remove()); };
  }, [selectedGame, onClose]);

  const renderContent = () => {
    if (selectedGame === 'studio') return <GameStudioView currentUser={currentUser} onClose={() => setSelectedGame('none')} />;
    if (selectedGame === 'player' && playingGameId) return <GamePlayer gameId={playingGameId} currentUser={currentUser} onBack={() => setSelectedGame('none')} />;
    
    switch (selectedGame) {
      case 'gold_clicker':
        return <GoldClickerGame currentUser={currentUser} onBack={() => setSelectedGame('none')} />;
      case 'max_simulator':
        return <MaxSimulatorGame onBack={() => setSelectedGame('none')} />;
      default:
        return (
          <div className="max-w-7xl mx-auto space-y-8 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-2">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full max-w-xs">
                    <TabsList className="bg-muted/50 p-1 rounded-xl w-full">
                        <TabsTrigger value="all" className="rounded-lg font-black text-[10px] uppercase tracking-widest flex-1">{t('all_videos')}</TabsTrigger>
                        <TabsTrigger value="my" className="rounded-lg font-black text-[10px] uppercase tracking-widest flex-1">{t('my_games')}</TabsTrigger>
                    </TabsList>
                </Tabs>
                <Button variant="ghost" onClick={() => setSelectedGame('studio')} className="rounded-full gap-2 font-black uppercase text-[10px] tracking-widest hover:bg-primary/10 hover:text-primary transition-all">
                    <Code2 className="h-4 w-4" />
                    <span>Studio</span>
                </Button>
            </div>

            {activeTab === 'all' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <GameCard 
                        title={t('game_gold_clicker')}
                        description={t('game_gold_clicker_desc')}
                        icon={MousePointer2}
                        color="bg-amber-500"
                        onClick={() => setSelectedGame('gold_clicker')}
                        author="Infinite Team"
                    />
                    <GameCard 
                        title={t('game_max_simulator')}
                        description={t('game_max_simulator_desc')}
                        icon={Smartphone}
                        color="bg-indigo-600"
                        onClick={() => setSelectedGame('max_simulator')}
                        author="Infinite Team"
                    />
                    {publicGames?.map(game => (
                        <GameCard 
                            key={game.id}
                            title={game.name}
                            description={game.description || 'Custom block-based logic game.'}
                            icon={LayoutGrid}
                            color="bg-primary"
                            onClick={() => { setPlayingGameId(game.id); setSelectedGame('player'); }}
                            author={authors[game.ownerId]?.name}
                        />
                    ))}
                    <div className="border-2 border-dashed rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-muted-foreground/30 gap-4 min-h-[200px]">
                        <Gamepad2 className="h-12 w-12" />
                        <p className="font-bold uppercase tracking-widest text-[10px] text-center">{t('placeholder_title')}</p>
                    </div>
                </div>
            ) : (
                <GameStudioView currentUser={currentUser} onClose={() => setActiveTab('all')} />
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      <header className={cn(
          "flex-shrink-0 flex items-center p-4 border-b z-20 pt-[calc(1rem+env(safe-area-inset-top))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]",
          colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background/95 backdrop-blur-md'
      )}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={selectedGame === 'none' ? onClose : () => setSelectedGame('none')} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 overflow-hidden">
                <Gamepad2 className="h-8 w-8 text-primary shrink-0" />
                <h1 className="text-xl font-bold font-headline truncate">
                    {selectedGame === 'none' ? t('infgames_title') : (selectedGame === 'studio' ? t('game_studio_title') : t(`game_${selectedGame}` as any))}
                </h1>
                <Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none shrink-0 font-black">1.4</Badge>
            </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative bg-muted/5">
        <div className="p-4 md:p-6 min-h-full">
            {renderContent()}
        </div>
      </main>

      {selectedGame === 'none' && (
        <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-20 pointer-events-none">
            <div className="bg-card/80 backdrop-blur-xl border-2 border-primary/20 p-5 rounded-[2rem] shadow-2xl flex flex-col items-end gap-1 animate-in slide-in-from-bottom-4 duration-500">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('inf_gold_balance')}</p>
                <div className="flex items-center gap-3 text-3xl font-black text-primary">
                    <InfGoldIcon className="w-7 h-7 experimental-glow" />
                    <span>{Math.round(currentUser.infGoldBalance || 0)}</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

function GameCard({ title, description, icon: Icon, color, onClick, author }: { title: string, description: string, icon: any, color: string, onClick: () => void, author?: string }) {
    const { t } = useLanguage();
    return (
        <div className="group bg-card border rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer flex flex-col gap-6 overflow-hidden relative border-border/10" onClick={onClick}>
            <div className={cn("absolute -top-12 -right-12 w-40 h-40 blur-3xl opacity-10 transition-opacity group-hover:opacity-30", color)} />
            <div className="flex items-center justify-between">
                <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl transition-transform group-hover:scale-110 duration-500", color)}>
                    <Icon className="h-9 w-9" />
                </div>
                {author && (
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{t('sender_label')}</p>
                        <p className="text-[10px] font-bold text-primary truncate max-w-[120px]">{author}</p>
                    </div>
                )}
            </div>
            <div className="space-y-2 flex-1">
                <h3 className="text-2xl font-black font-headline whitespace-normal leading-tight uppercase tracking-tighter">{title}</h3>
                <p className="text-sm text-muted-foreground font-medium whitespace-normal leading-relaxed line-clamp-2">{description}</p>
            </div>
            <Button className={cn("w-full h-14 rounded-2xl font-black text-lg uppercase tracking-widest transition-all", color, "hover:brightness-110 shadow-lg text-white")}>
                {t('play')}
            </Button>
        </div>
    );
}

function MaxSimulatorGame({ onBack }: { onBack: () => void }) {
    const { t } = useLanguage();
    const [gameState, setGameState] = useState<'phone' | 'install_prompt' | 'launching' | 'welcome' | 'chat_list' | 'chat_view' | 'fine' | 'prison'>('phone');
    const [notifications, setNotifications] = useState<string[]>([]);
    const [selectedChat, setSelectedChat] = useState<number>(0);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const addNotification = (text: string) => {
        setNotifications(prev => [text, ...prev].slice(0, 3));
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n !== text));
        }, 4000);
    };

    useEffect(() => {
        if (gameState === 'welcome' || gameState === 'chat_list' || gameState === 'chat_view') {
            const interval = setInterval(() => {
                const pool = [
                    t('max_notif_data_leak'), 
                    t('max_notif_fsb'),
                    "Система: Ваши контакты успешно синхронизированы с базой МВД.",
                    "Уведомление: ФСБ запрашивает доступ к вашему микрофону.",
                    "Система: Обнаружена подозрительная активность в мыслях.",
                    "MAX: Рекомендуем обновить лояльность до версии 2.0."
                ];
                addNotification(pool[Math.floor(Math.random() * pool.length)]);
            }, 6000);
            return () => clearInterval(interval);
        }
    }, [gameState, t]);

    const handleChoice = (isSafe: boolean) => {
        if (isSafe) {
            setGameState('chat_list');
        } else {
            const outcome = Math.random() > 0.5 ? 'fine' : 'prison';
            setGameState(outcome);
        }
    };

    const renderGameContent = () => {
        switch (gameState) {
            case 'phone':
                return (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900 flex flex-col items-center justify-between p-8 animate-in fade-in duration-700">
                        <div className="text-center pt-20">
                            <h2 className="text-6xl font-light text-white font-mono">
                                {currentTime.getHours().toString().padStart(2, '0')}:
                                {currentTime.getMinutes().toString().padStart(2, '0')}
                            </h2>
                            <p className="text-white/60 text-sm mt-2 uppercase tracking-widest font-bold">Safe Phone OS</p>
                        </div>
                        <div className="grid grid-cols-4 gap-6 w-full max-w-xs mb-20">
                            {[1, 2, 3].map(i => <div key={i} className="aspect-square bg-white/10 rounded-2xl border border-white/5" />)}
                            <button onClick={() => setGameState('install_prompt')} className="aspect-square bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 animate-pulse">
                                <AlertTriangle className="text-white w-8 h-8" />
                            </button>
                        </div>
                    </div>
                );
            case 'install_prompt':
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                        <div className="bg-card border rounded-[2rem] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-white shadow-lg">
                                <Smartphone className="w-10 h-10" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold font-headline">{t('game_max_simulator')}</h3>
                                <p className="text-muted-foreground font-medium">{t('max_install_prompt')}</p>
                            </div>
                            <div className="grid grid-cols-1">
                                <Button onClick={() => setGameState('launching')} className="h-14 rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl">
                                    {t('max_yes')} (ОБЯЗАТЕЛЬНО)
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            case 'launching':
                return (
                    <div className="w-full h-full bg-[#1e1b4b] flex flex-col items-center justify-center text-white gap-8 animate-in fade-in duration-500">
                        <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center animate-bounce">
                             <Smartphone className="w-12 h-12 text-indigo-400" />
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-sm font-bold uppercase tracking-[0.3em] text-indigo-300">{t('max_launching')}</p>
                            <p className="text-xs text-white/40 animate-pulse">{t('max_login_status')}</p>
                        </div>
                        <Progress value={80} className="w-48 h-1 bg-white/10" />
                        {setTimeout(() => setGameState('welcome'), 3000) && null}
                    </div>
                );
            case 'welcome':
                return (
                    <div className="w-full h-full bg-white flex flex-col items-center justify-center p-8 gap-8 animate-in slide-in-from-bottom duration-700">
                        <div className="text-center space-y-4">
                            <Smartphone className="w-20 h-20 text-indigo-600 mx-auto" />
                            <h2 className="text-3xl font-black font-headline text-indigo-950 uppercase tracking-tighter">{t('max_welcome')}</h2>
                            <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full border border-green-100 mx-auto w-fit">
                                <ShieldCheck className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{t('max_secure_connection')}</span>
                            </div>
                        </div>
                        <Button onClick={() => setGameState('chat_list')} className="w-full max-w-xs h-14 rounded-2xl bg-indigo-600 font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20">
                            {t('continue_button')}
                        </Button>
                    </div>
                );
            case 'chat_list':
                return (
                    <div className="w-full h-full bg-slate-50 flex flex-col animate-in fade-in duration-300">
                        <header className="bg-indigo-600 text-white p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between shadow-md">
                            <h3 className="font-black text-xl font-headline tracking-tighter uppercase">MAX</h3>
                            <Lock className="w-5 h-5 opacity-50" />
                        </header>
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {[1, 2].map(i => (
                                    <button key={i} onClick={() => { setSelectedChat(i); setGameState('chat_view'); }} className="w-full flex items-center gap-4 p-4 bg-white border rounded-2xl hover:bg-indigo-50 transition-colors group text-left">
                                        <Avatar className="h-12 w-12 border-2 border-indigo-100">
                                            <AvatarFallback className="bg-indigo-50 text-indigo-600 font-black">
                                                {t(`max_chat_contact_${i}` as any).charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-indigo-950">{t(`max_chat_contact_${i}` as any)}</p>
                                            <p className="text-xs text-muted-foreground truncate italic">{t(`max_chat_msg_${i}` as any)}</p>
                                        </div>
                                        <Badge className="bg-red-500 text-white font-black">1</Badge>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                );
            case 'chat_view':
                return (
                    <div className="w-full h-full bg-slate-100 flex flex-col animate-in slide-in-from-right duration-300">
                        <header className="bg-indigo-600 text-white p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-4 shadow-md">
                            <Button variant="ghost" size="icon" onClick={() => setGameState('chat_list')} className="text-white"><ArrowLeft /></Button>
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-white/20 text-white font-bold">{t(`max_chat_contact_${selectedChat}` as any).charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-black uppercase tracking-tighter">{t(`max_chat_contact_${selectedChat}` as any)}</span>
                        </header>
                        <div className="flex-1 p-4 space-y-4">
                            <div className="bg-white border p-4 rounded-2xl rounded-bl-none shadow-sm max-w-[85%] animate-in slide-in-from-left duration-500">
                                <p className="text-sm font-medium leading-relaxed">{t(`max_chat_msg_${selectedChat}` as any)}</p>
                            </div>
                        </div>
                        <footer className="p-4 bg-white border-t space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                            <p className="text-[10px] font-black uppercase text-indigo-600/60 tracking-widest px-2">Выберите безопасный ответ:</p>
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" className="h-12 rounded-xl text-xs font-bold text-left justify-start border-indigo-100 hover:bg-green-50 hover:text-green-700" onClick={() => handleChoice(true)}>
                                    {t(`max_reply_safe_${selectedChat}` as any)}
                                </Button>
                                <Button variant="outline" className="h-12 rounded-xl text-xs font-bold text-left justify-start border-red-100 hover:bg-red-50 hover:text-red-700" onClick={() => handleChoice(false)}>
                                    {t(`max_reply_dangerous_${selectedChat}` as any)}
                                </Button>
                            </div>
                        </footer>
                    </div>
                );
            case 'fine':
                return (
                    <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center p-8 gap-8 animate-in fade-in duration-500">
                        <div className="w-24 h-24 bg-red-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl animate-bounce">
                             <AlertTriangle className="w-12 h-12" />
                        </div>
                        <div className="text-center space-y-4">
                            <h2 className="text-4xl font-black font-headline text-red-700 uppercase tracking-tighter">{t('max_fine_title')}</h2>
                            <p className="text-red-900 font-bold bg-white p-6 rounded-3xl border-2 border-red-200 shadow-xl">{t('max_fine_reason_1')}</p>
                        </div>
                        <Button onClick={() => setGameState('phone')} className="w-full max-w-xs h-14 rounded-2xl bg-indigo-600 font-black uppercase tracking-widest">
                            {t('max_restart')}
                        </Button>
                    </div>
                );
            case 'prison':
                return (
                    <div className="w-full h-full bg-black text-white flex flex-col items-center justify-center p-8 gap-10 animate-in zoom-in duration-1000 overflow-hidden relative">
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                            <div className="w-full h-full grid grid-cols-6 gap-0">
                                {Array.from({length: 6}).map((_, i) => <div key={i} className="border-r border-white/50 h-full" />)}
                            </div>
                        </div>
                        <Ban className="w-32 h-32 text-red-600 animate-pulse relative z-10" />
                        <div className="text-center space-y-4 relative z-10">
                            <h2 className="text-4xl font-black font-headline text-white uppercase tracking-[0.2em]">{t('max_prison_title')}</h2>
                            <p className="text-white/60 font-medium italic">{t('max_prison_reason_1')}</p>
                        </div>
                        <Button onClick={() => setGameState('phone')} variant="outline" className="w-full max-w-xs h-14 rounded-2xl font-black uppercase tracking-widest border-white/20 hover:bg-white/10 relative z-10">
                            {t('max_restart')}
                        </Button>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden animate-in fade-in duration-300">
            <header className="h-14 border-b flex items-center px-4 shrink-0 bg-background/80 backdrop-blur-md relative z-[110] pt-[calc(0.5rem+env(safe-area-inset-top))]">
                <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-indigo-600" />
                    <span className="text-xs font-black uppercase tracking-widest opacity-40">{t('game_max_simulator')}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={onBack} className="ml-auto rounded-full h-10 w-10">
                    <X className="h-5 w-5" />
                </Button>
            </header>
            
            <div className="flex-1 relative">
                {renderGameContent()}
                
                {/* Simulated Overlay Notifications */}
                <div className="absolute top-4 left-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
                    {notifications.map((n, i) => (
                        <div key={i} className="bg-indigo-950/90 text-white p-3 rounded-2xl border border-indigo-400/30 shadow-2xl text-[10px] font-bold animate-in slide-in-from-top-4 backdrop-blur-xl">
                            {n}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function GoldClickerGame({ currentUser, onBack }: { currentUser: AuthenticatedUser, onBack: () => void }) {
    const { t } = useLanguage();
    const db = useFirestore();
    const { toast } = useToast();
    
    const CLICKS_PER_GOLD = 100000;

    const [score, setScore] = useState(0);
    const [clickPower, setClickPower] = useState(1);
    const [upgradeCost, setUpgradeCost] = useState(100);
    const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
    const [isSaving, setIsSaving] = useState(false);
    const [isCheating, setIsCheating] = useState(false);
    
    const lastClickTimeRef = useRef<number>(0);
    const lastClickPosRef = useRef<{x: number, y: number}>({x: 0, y: 0});
    const identicalPosCountRef = useRef<number>(0);
    const clickIntervalsRef = useRef<number[]>([]);

    const startGame = () => {
        setScore(0);
        setClickPower(1);
        setUpgradeCost(100);
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
                if (identicalPosCountRef.current > 15) {
                    setIsCheating(true);
                }
            } else {
                identicalPosCountRef.current = 0;
            }

            clickIntervalsRef.current.push(interval);
            if (clickIntervalsRef.current.length > 20) {
                const recentIntervals = clickIntervalsRef.current.slice(-20);
                const avg = recentIntervals.reduce((a, b) => a + b, 0) / 20;
                const variance = recentIntervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / 20;
                
                const varianceThreshold = 1.2 / Math.log2(clickPower + 1); 
                if (variance < varianceThreshold) { 
                    setIsCheating(true);
                }
            }
        }

        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x: clientX, y: clientY };
        setScore(prev => prev + clickPower);
    }, [gameState, clickPower]);

    const handleUpgrade = () => {
        if (score >= upgradeCost) {
            setScore(prev => prev - upgradeCost);
            setClickPower(prev => prev + 1);
            setUpgradeCost(prev => Math.round(prev * 1.25));
            toast({ title: t('dm_success'), description: t('game_click_power', { power: clickPower + 1 }) });
        }
    };

    const handleClaim = async () => {
        if (!db || isSaving || isCheating) {
            if (isCheating) {
                toast({ variant: 'destructive', title: 'Anti-Cheat', description: 'Auto-clicker detected. Reward cancelled.' });
                onBack();
            }
            return;
        }
        
        const reward = Math.floor(score / CLICKS_PER_GOLD);
        
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

    const nextGoldProgress = (score % CLICKS_PER_GOLD) / (CLICKS_PER_GOLD / 100);
    const earnedGold = Math.floor(score / CLICKS_PER_GOLD);

    return (
        <div className="max-w-md mx-auto flex flex-col items-center gap-6 py-4 animate-in fade-in zoom-in duration-300 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            {gameState === 'idle' && (
                <div className="text-center space-y-6 pt-12">
                    <div className="w-32 h-32 bg-amber-500 rounded-full flex items-center justify-center mx-auto shadow-2xl experimental-glow">
                        <InfGoldIcon className="w-16 h-16 text-white" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black font-headline text-amber-600">{t('game_gold_clicker')}</h2>
                        <p className="text-muted-foreground px-4">{t('game_gold_clicker_desc')}</p>
                    </div>
                    <Button onClick={startGame} size="lg" className="rounded-full px-12 h-14 font-black text-lg bg-amber-500 hover:bg-amber-600 shadow-xl">
                        {t('play')}
                    </Button>
                </div>
            )}

            {gameState === 'playing' && (
                <div className="w-full flex flex-col items-center gap-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="w-full bg-card border p-6 rounded-3xl shadow-lg space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('inf_gold_balance')}</p>
                                <div className="flex items-center gap-2 text-3xl font-black text-primary">
                                    <InfGoldIcon className="w-6 h-6" />
                                    <span>{earnedGold}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ОЧКИ</p>
                                <p className="text-xl font-bold font-mono">{score.toLocaleString()}</p>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                                <span>До следующего Gold</span>
                                <span>{(score % CLICKS_PER_GOLD).toLocaleString()} / {CLICKS_PER_GOLD.toLocaleString()}</span>
                            </div>
                            <Progress value={nextGoldProgress} className="h-2" />
                        </div>

                        <div className="pt-2 border-t flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                                <span className="text-xs font-bold uppercase tracking-tight">{t('game_click_power', { power: clickPower })}</span>
                            </div>
                            <Button 
                                size="sm" 
                                variant={score >= upgradeCost ? "default" : "outline"}
                                className={cn("h-8 text-[10px] font-black rounded-full px-4 transition-all", score >= upgradeCost && "bg-amber-500 text-white animate-pulse")}
                                onClick={handleUpgrade}
                                disabled={score < upgradeCost}
                            >
                                {t('game_upgrade_click_power')} ({upgradeCost.toLocaleString()})
                            </Button>
                        </div>
                    </div>

                    <div className="relative mt-4">
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
                        
                        {isCheating && (
                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-red-500 font-bold bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20 whitespace-nowrap animate-bounce">
                                <ShieldAlert className="h-4 w-4" />
                                <span>FAIR PLAY REQUIRED</span>
                            </div>
                        )}
                    </div>

                    {!isCheating && (
                        <p className="font-bold text-muted-foreground uppercase tracking-widest text-[10px] animate-pulse">Кликай, чтобы заработать!</p>
                    )}

                    <div className="w-full space-y-3 pt-8">
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
