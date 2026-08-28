'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, doc, setDoc, deleteDoc, Timestamp, runTransaction, updateDoc } from 'firebase/firestore';
import type { AuthenticatedUser, CustomGame } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Gamepad2, Plus, ArrowLeft, Loader2, Pencil, Trash2, Play, Pause, Code2, X, Sparkles, LayoutGrid, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameEditor } from './game-editor';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/theme-context';
import { Capacitor } from '@capacitor/core';

export function GameStudioView({ currentUser, onClose }: { currentUser: AuthenticatedUser, onClose: () => void }) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const { theme: colorTheme } = useTheme();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [selectedGame, setSelectedGame] = useState<CustomGame | null>(null);

  const gamesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'customGames'), where('ownerId', '==', currentUser.uid));
  }, [db, currentUser.uid]);

  const { data: myGames, loading } = useCollection<CustomGame>(gamesQuery);

  useEffect(() => {
    const handleSystemBack = () => {
      if (selectedGame) setSelectedGame(null);
      else if (isCreateOpen) setIsCreateOpen(false);
      else onClose();
    };
    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        backListener = App.addListener('backButton', handleSystemBack);
      });
    }
    return () => { if (backListener) backListener.then((l: any) => l.remove()); }
  }, [selectedGame, isCreateOpen, onClose]);

  const handleCreateGame = async () => {
    if (!db || !newGameName.trim()) return;
    setIsCreating(true);
    try {
        const gameId = doc(collection(db, 'customGames')).id;
        const gameData: CustomGame = {
            id: gameId,
            name: newGameName.trim(),
            ownerId: currentUser.uid,
            scripts: [],
            isActive: true,
            createdAt: Timestamp.now(),
            installs: 0
        };
        await setDoc(doc(db, 'customGames', gameId), gameData);
        toast({ title: t('dm_success'), description: "Game project created!" });
        setIsCreateOpen(false);
        setNewGameName('');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsCreating(false);
    }
  };

  const handleDeleteGame = async (game: CustomGame) => {
    if (!db || !window.confirm(t('delete_chat_confirm'))) return;
    try {
        await deleteDoc(doc(db, 'customGames', game.id));
        toast({ title: t('dm_success') });
    } catch (e) { 
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete game.' });
    }
  };

  if (selectedGame) {
      return <GameEditor game={selectedGame} onBack={() => setSelectedGame(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
        <div className="p-4 md:p-8 space-y-8">
            <div className="bg-primary/10 rounded-[2.5rem] p-10 border border-primary/20 flex flex-col md:flex-row items-center gap-10 shadow-inner">
                <div className="w-24 h-24 rounded-[2rem] bg-background flex items-center justify-center shadow-2xl shrink-0">
                    <Code2 className="h-12 w-12 text-primary" />
                </div>
                <div className="text-center md:text-left space-y-3 flex-1">
                    <h2 className="text-3xl font-black font-headline text-primary uppercase tracking-tighter">{t('game_studio_title')}</h2>
                    <p className="text-muted-foreground font-medium leading-relaxed">{t('game_studio_desc')}</p>
                    <Button onClick={() => setIsCreateOpen(true)} className="rounded-2xl gap-2 font-black shadow-xl shadow-primary/20 h-12 px-8 mt-2">
                        <Plus className="h-5 w-5" />
                        <span>{t('create_game')}</span>
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-4">{t('my_games')}</h3>
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
                ) : myGames && myGames.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myGames.map(game => (
                            <Card key={game.id} className="rounded-[2rem] border-none shadow-sm hover:shadow-2xl transition-all duration-500 group overflow-hidden bg-card/50">
                                <CardHeader className="flex flex-row items-center gap-5 pb-6 pt-6 px-6">
                                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center shrink-0 border-2 border-border/20">
                                        <Gamepad2 className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate font-black text-xl leading-none mb-2">{game.name}</CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={game.isActive ? "default" : "secondary"} className="rounded-full text-[9px] h-4 uppercase font-black px-2">
                                                {game.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardFooter className="bg-muted/20 gap-2 p-4 pt-4 border-t border-border/10">
                                    <Button variant="outline" size="sm" className="flex-1 rounded-xl font-black h-10 border-none bg-background hover:bg-primary/5" onClick={() => setSelectedGame(game)}>
                                        <Pencil className="h-4 w-4 mr-2" /> EDIT
                                    </Button>
                                    <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-none bg-background hover:text-destructive" onClick={() => handleDeleteGame(game)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 bg-card/30 rounded-[3rem] border-2 border-dashed opacity-40">
                        <Gamepad2 className="h-20 w-20 mx-auto mb-6 text-muted-foreground" />
                        <p className="font-black uppercase tracking-widest text-xs">{t('no_studio_bots')}</p>
                    </div>
                )}
            </div>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="max-w-sm rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden">
                <DialogHeader className="p-8 pb-4">
                    <DialogTitle className="text-2xl font-black font-headline text-center uppercase tracking-tighter">New Game Project</DialogTitle>
                </DialogHeader>
                <div className="px-8 space-y-6 pb-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('game_name_label')}</Label>
                        <Input value={newGameName} onChange={(e) => setNewGameName(e.target.value)} placeholder="Enter name..." className="h-14 rounded-2xl bg-muted/50 border-none focus-visible:ring-primary font-bold text-lg px-6" />
                    </div>
                </div>
                <DialogFooter className="p-8 pt-4 flex flex-col gap-2">
                    <Button onClick={handleCreateGame} disabled={isCreating || !newGameName.trim()} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">
                        {isCreating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
                        CREATE GAME
                    </Button>
                    <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="w-full h-12 rounded-xl font-bold text-muted-foreground">CANCEL</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
