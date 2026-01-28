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
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore } from '@/firebase';
import { arrayUnion, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import type { AuthenticatedUser, Chat, User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import React, { useState } from 'react';
import { useLanguage } from '@/context/language-context';
import { Loader2, Search, Users, Megaphone } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';


const searchFormSchema = z.object({
  query: z.string().min(2, { message: 'Query must be at least 2 characters.' }),
});

type SearchResult = 
    | { type: 'user', data: User }
    | { type: 'chat', data: Chat };

interface SearchDialogProps {
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatSelected: (chat: Chat) => void;
}

export function SearchDialog({ currentUser, open, onOpenChange, onChatSelected }: SearchDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const searchForm = useForm<z.infer<typeof searchFormSchema>>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: { query: '' },
  });

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
        } else {
            const searchPromises = [];

            // Search chats by name
            const chatsCollection = collection(db, 'chats');
            const chatNameQuery = query(
                chatsCollection,
                where('type', 'in', ['group', 'channel']),
                where('name', '>=', searchQuery),
                where('name', '<=', searchQuery + '\uf8ff')
            );
            searchPromises.push(getDocs(chatNameQuery));

            // Search users by name
            const usersCollection = collection(db, 'users');
            const userNameQuery = query(
                usersCollection,
                where('name', '>=', searchQuery),
                where('name', '<=', searchQuery + '\uf8ff')
            );
            searchPromises.push(getDocs(userNameQuery));
            
            const [chatSnapshots, userSnapshots] = await Promise.all(searchPromises);

            chatSnapshots.forEach((doc) => {
                foundResults.push({ type: 'chat', data: { id: doc.id, ...doc.data() } as Chat });
            });

            userSnapshots.forEach((doc) => {
                if (!foundResults.some(r => r.type === 'user' && r.data.id === doc.id)) {
                    foundResults.push({ type: 'user', data: { id: doc.id, ...doc.data() } as User });
                }
            });
        }

        setResults(foundResults);

        if (foundResults.length === 0) {
            searchForm.setError('query', { message: t('no_results_found') });
        }

    } catch (error: any) {
        console.error("Search error:", error);
        if (error.code === 'failed-precondition') {
             toast({ variant: 'destructive', title: 'Search Error', description: 'The necessary search index is being created. Please try again in a few minutes.'})
        } else {
             toast({ variant: 'destructive', title: 'Error', description: 'Something went wrong during search.'})
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleMessage = async (targetUser: User) => {
    if (!db) return;
    
    const members = [currentUser.uid, targetUser.id].sort();
    const chatId = members.join('_');
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        type: 'dm',
        members: members,
      });
    }
    
    onOpenChange(false);
    onChatSelected({ id: chatId, members, type: 'dm' });
  };
  
  const handleJoin = async (chat: Chat) => {
      if (!db || chat.members.includes(currentUser.uid)) {
          onOpenChange(false);
          onChatSelected(chat);
          return;
      };

      const chatRef = doc(db, 'chats', chat.id);
      
      try {
          await updateDoc(chatRef, {
              members: arrayUnion(currentUser.uid)
          });
          toast({ title: t('dm_success'), description: t(chat.type === 'group' ? 'join_success_group' : 'join_success_channel')});
          onOpenChange(false);
          onChatSelected({ ...chat, members: [...chat.members, currentUser.uid] });
      } catch (serverError) {
          console.error("Error joining chat:", serverError);
          const permissionError = new FirestorePermissionError({
              path: chatRef.path,
              operation: 'update',
              requestResourceData: { members: arrayUnion(currentUser.uid) },
          });
          errorEmitter.emit('permission-error', permissionError);
      }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('search_dialog_title')}</DialogTitle>
          <DialogDescription>{t('search_dialog_desc')}</DialogDescription>
        </DialogHeader>
        <Form {...searchForm}>
            <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} className="flex items-center gap-2">
                <FormField
                control={searchForm.control}
                name="query"
                render={({ field }) => (
                    <FormItem className="flex-1">
                    <FormControl>
                        <Input placeholder={t('search_placeholder')} {...field} />
                    </FormControl>
                     <FormMessage className="absolute" />
                    </FormItem>
                )}
                />
                <Button type="submit" size="icon" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </Button>
            </form>
        </Form>
        <div className="flex-1 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('search_results')}</h3>
            <ScrollArea className="h-[calc(70vh-200px)] pr-4">
                {results.length > 0 ? (
                    <div className='space-y-2'>
                    {results.map((result) => (
                        <div key={result.type + '-' + result.data.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-accent">
                           {result.type === 'user' ? (
                               <UserAvatarWithStatus user={result.data} />
                           ) : (
                               <Avatar>
                                   <AvatarFallback>
                                       {result.data.type === 'group' ? <Users /> : <Megaphone />}
                                   </AvatarFallback>
                               </Avatar>
                           )}
                           <div className="flex-1">
                                <p className="font-semibold flex items-center gap-2">
                                    {result.data.name}
                                    {result.type === 'user' && (result.data as User).isBot && <Badge variant="secondary">BOT</Badge>}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {result.type === 'user' ? (result.data as User).username : result.data.link}
                                </p>
                           </div>
                           {result.type === 'user' && result.data.id !== currentUser.uid && (
                                <Button size="sm" onClick={() => handleMessage(result.data as User)}>{t('message')}</Button>
                           )}
                           {result.type === 'chat' && (
                               <Button size="sm" onClick={() => handleJoin(result.data as Chat)}>
                                   {(result.data as Chat).members.includes(currentUser.uid) ? t('open') : t('join')}
                               </Button>
                           )}
                        </div>
                    ))}
                    </div>
                ) : (
                    !isLoading && <p className="text-sm text-center text-muted-foreground py-8">{t('no_results_found')}</p>
                )}
                 {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
