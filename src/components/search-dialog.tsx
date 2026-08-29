
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormMessage,
  FormItem,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore } from '@/firebase';
import { arrayUnion, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import type { AuthenticatedUser, Chat, User, CustomGame } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/language-context';
import { Loader2, Search, Users, Megaphone, ArrowLeft, X, Gamepad2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

const searchFormSchema = z.object({
  query: z.string().min(2, { message: 'Query must be at least 2 characters.' }),
});

type SearchResult = 
    | { type: 'user', data: User }
    | { type: 'chat', data: Chat }
    | { type: 'game', data: CustomGame };

interface SearchDialogProps {
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatSelected: (chat: Chat) => void;
  onGameSelected?: (gameId: string) => void;
}

export function SearchDialog({ currentUser, open, onOpenChange, onChatSelected, onGameSelected }: SearchDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { experimentalDesign } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const searchForm = useForm<z.infer<typeof searchFormSchema>>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: { query: '' },
  });

  useEffect(() => {
    if (!open) return;
    const handleSystemBack = () => { onOpenChange(false); };
    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        backListener = App.addListener('backButton', handleSystemBack);
      });
    }
    return () => { if (backListener) { backListener.then((l: any) => l.remove()); } };
  }, [open, onOpenChange]);

  const onSearchSubmit = async (values: z.infer<typeof searchFormSchema>) => {
    if (!db) return;
    setIsLoading(true);
    setResults([]);
    searchForm.clearErrors();
    const { query: searchQuery } = values;

    try {
        let foundResults: SearchResult[] = [];
        if (searchQuery.startsWith('@')) {
            const usernameRef = doc(db, 'usernames', searchQuery);
            const usernameSnap = await getDoc(usernameRef);
            if (usernameSnap.exists()) {
                const userRef = doc(db, 'users', usernameSnap.data().uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    foundResults.push({ type: 'user', data: { id: userSnap.id, ...userSnap.data() } as User });
                }
            }
        } else if (searchQuery.startsWith('/C/') || searchQuery.startsWith('/G/') || searchQuery.startsWith('/B/')) {
            const linkCollection = searchQuery.startsWith('/B/') ? 'botLinks' : 'chatLinks';
            const linkRef = doc(db, linkCollection, encodeURIComponent(searchQuery));
            const linkSnap = await getDoc(linkRef);
            if (linkSnap.exists()) {
                if (linkCollection === 'botLinks') {
                    const botUserRef = doc(db, 'users', linkSnap.data().botId);
                    const botUserSnap = await getDoc(botUserRef);
                    if (botUserSnap.exists()) {
                        foundResults.push({ type: 'user', data: { id: botUserSnap.id, ...botUserSnap.data() } as User });
                    }
                } else {
                    const chatRef = doc(db, 'chats', linkSnap.data().chatId);
                    const chatSnap = await getDoc(chatRef);
                    if (chatSnap.exists()) {
                        foundResults.push({ type: 'chat', data: { id: chatSnap.id, ...chatSnap.data() } as Chat});
                    }
                }
            }
        } else if (searchQuery.startsWith('/IG/')) {
            const linkRef = doc(db, 'gameLinks', encodeURIComponent(searchQuery));
            const linkSnap = await getDoc(linkRef);
            if (linkSnap.exists()) {
                const gameRef = doc(db, 'customGames', linkSnap.data().gameId);
                const gameSnap = await getDoc(gameRef);
                if (gameSnap.exists()) {
                    foundResults.push({ type: 'game', data: { id: gameSnap.id, ...gameSnap.data() } as CustomGame });
                }
            }
        } else {
            const searchPromises = [];
            const chatsCollection = collection(db, 'chats');
            const chatNameQuery = query(chatsCollection, where('type', 'in', ['group', 'channel']), where('name', '>=', searchQuery), where('name', '<=', searchQuery + '\uf8ff'));
            searchPromises.push(getDocs(chatNameQuery));
            
            const usersCollection = collection(db, 'users');
            const userNameQuery = query(usersCollection, where('name', '>=', searchQuery), where('name', '<=', searchQuery + '\uf8ff'));
            searchPromises.push(getDocs(userNameQuery));

            const gamesCollection = collection(db, 'customGames');
            const gamesNameQuery = query(gamesCollection, where('isActive', '==', true), where('name', '>=', searchQuery), where('name', '<=', searchQuery + '\uf8ff'));
            searchPromises.push(getDocs(gamesNameQuery));

            const [chatSnapshots, userSnapshots, gameSnapshots] = await Promise.all(searchPromises);
            chatSnapshots.forEach((doc) => { foundResults.push({ type: 'chat', data: { id: doc.id, ...doc.data() } as Chat }); });
            userSnapshots.forEach((doc) => { if (!foundResults.some(r => r.type === 'user' && r.data.id === doc.id)) { foundResults.push({ type: 'user', data: { id: doc.id, ...doc.data() } as User }); } });
            gameSnapshots.forEach((doc) => { foundResults.push({ type: 'game', data: { id: doc.id, ...doc.data() } as CustomGame }); });
        }
        setResults(foundResults);
        if (foundResults.length === 0) { searchForm.setError('query', { message: t('no_results_found') }); }
    } catch (error: any) {
        console.error("Search error:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Something went wrong during search.'});
    } finally { setIsLoading(false); }
  };

  const handleMessage = async (targetUser: User) => {
    if (!db) return;
    const members = [currentUser.uid, targetUser.id].sort();
    const chatId = members.join('_');
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) { await setDoc(chatRef, { type: 'dm', members: members, unreadCounts: { [currentUser.uid]: 0, [targetUser.id]: 0 } }); }
    onOpenChange(false);
    onChatSelected({ id: chatId, members, type: 'dm' });
  };
  
  const handleJoin = async (chat: Chat) => {
      if (!db || chat.members.includes(currentUser.uid)) { onOpenChange(false); onChatSelected(chat); return; }
      const chatRef = doc(db, 'chats', chat.id);
      try {
          await updateDoc(chatRef, { members: arrayUnion(currentUser.uid) });
          toast({ title: t('dm_success'), description: t(chat.type === 'group' ? 'join_success_group' : 'join_success_channel')});
          onOpenChange(false);
          onChatSelected({ ...chat, members: [...chat.members, currentUser.uid] });
      } catch (serverError) { console.error("Error joining chat:", serverError); }
  };

  const handlePlayGame = (gameId: string) => {
      onOpenChange(false);
      if (onGameSelected) {
          onGameSelected(gameId);
      } else {
          window.dispatchEvent(new CustomEvent('open-infgames', { detail: { gameId } }));
      }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className={cn("max-w-2xl h-[70vh] flex flex-col p-0 overflow-hidden rounded-lg")}>
        <DialogHeader className="relative flex-row items-center justify-center p-4 border-b shrink-0 h-16">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button>
            <DialogTitle>{t('search_dialog_title')}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2"><X /></Button>
        </DialogHeader>
        <div className="p-6 flex flex-col flex-1 overflow-hidden">
            <Form {...searchForm}>
                <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} className="flex items-center gap-2">
                    <FormField
                    control={searchForm.control}
                    name="query"
                    render={({ field }) => (
                        <FormItem className="flex-1">
                        <FormControl>
                            <Input placeholder={t('search_placeholder')} {...field} className={cn(experimentalDesign && "bg-card/45 backdrop-blur-xl border-white/20")} />
                        </FormControl>
                        <FormMessage className="absolute" />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" size="icon" disabled={isLoading} className={cn(experimentalDesign && "bg-card/45 backdrop-blur-xl border border-white/20 rounded-xl")}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    </Button>
                </form>
            </Form>
            <div className="flex-1 mt-4 overflow-hidden flex flex-col">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('search_results')}</h3>
                <ScrollArea className="flex-1 pr-4">
                    {results.length > 0 ? (
                        <div className='space-y-2'>
                        {results.map((result) => (
                            <div key={result.type + '-' + result.data.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-accent transition-colors">
                            {result.type === 'user' ? (
                                <UserAvatarWithStatus user={result.data as User} />
                            ) : result.type === 'chat' ? (
                                <Avatar><AvatarFallback>{result.data.type === 'group' ? <Users className='h-5 w-5 text-muted-foreground' /> : <Megaphone className='h-5 w-5 text-muted-foreground' />}</AvatarFallback></Avatar>
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600"><Gamepad2 className="h-5 w-5" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-bold truncate">{result.data.name}</p>
                                    {result.type === 'user' && (result.data as User).isBot && <Badge variant="secondary" className="text-[9px] h-4 leading-none px-1 font-black">BOT</Badge>}
                                    {result.type === 'game' && <Badge variant="outline" className="text-[8px] h-3.5 leading-none px-1 border-indigo-200 text-indigo-600 font-black">GAME</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                    {result.type === 'user' ? (result.data as User).username : (result.data as any).link}
                                </p>
                            </div>
                            {result.type === 'user' && result.data.id !== currentUser.uid && (<Button size="sm" variant="outline" className="rounded-xl h-8 font-bold" onClick={() => handleMessage(result.data as User)}>{t('message')}</Button>)}
                            {result.type === 'chat' && (<Button size="sm" variant="outline" className="rounded-xl h-8 font-bold" onClick={() => handleJoin(result.data as Chat)}>{(result.data as Chat).members.includes(currentUser.uid) ? t('open') : t('join')}</Button>)}
                            {result.type === 'game' && (<Button size="sm" className="rounded-xl h-8 font-bold bg-indigo-600 hover:bg-indigo-700" onClick={() => handlePlayGame(result.data.id)}>{t('play')}</Button>)}
                            </div>
                        ))}
                        </div>
                    ) : ( !isLoading && <p className="text-sm text-center text-muted-foreground py-8">{t('no_results_found')}</p> )}
                    {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
