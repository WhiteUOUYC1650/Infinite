
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, getDoc, runTransaction, query, where, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import type { AuthenticatedUser, Chat, ChatLink } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/language-context';
import { Loader2, Dices, ArrowLeft, X, ShoppingBag, Coins, Sparkles, MessageCircle, Megaphone, Users } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

const dmFormSchema = z.object({
  username: z.string()
    .min(2, { message: 'Username is too short.' })
    .refine(value => value.startsWith('@'), { message: "Username must start with '@'." }),
});

const groupFormSchema = z.object({
  name: z.string().min(3, { message: 'Group name must be at least 3 characters.' }),
  link: z.string().min(4, { message: 'Link must be at least 4 characters.'})
        .refine(value => !/\s/.test(value), { message: 'Link must not contain spaces.'})
        .refine(value => /^[a-zA-Z0-9_]+$/.test(value), { message: 'Link can only contain English letters, numbers, and underscores.'}),
});

const channelFormSchema = z.object({
    name: z.string().min(3, { message: 'Channel name must be at least 3 characters.' }),
    description: z.string().optional(),
    link: z.string().min(4, { message: 'Link must be at least 4 characters.'})
        .refine(value => !/\s/.test(value), { message: 'Link must not contain spaces.'})
        .refine(value => /^[a-zA-Z0-9_]+$/.test(value), { message: 'Link can only contain English letters, numbers, and underscores.'}),
});

const generateRandomLink = (length: number): string => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};


interface NewChatDialogProps {
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated?: (chatId: string) => void;
}

export function NewChatDialog({ currentUser, open, onOpenChange, onChatCreated }: NewChatDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameExists, setUsernameExists] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout>();

  const [isCheckingGroupLink, setIsCheckingGroupLink] = useState(false);
  const [isCheckingChannelLink, setIsCheckingChannelLink] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkForSale, setLinkOnSale] = useState<{ price: number, link: string } | null>(null);
  const [showBuyLinkDialog, setShowBuyLinkDialog] = useState(false);

  const groupDebounceTimeout = useRef<NodeJS.Timeout>();
  const channelDebounceTimeout = useRef<NodeJS.Timeout>();

  const dmForm = useForm<z.infer<typeof dmFormSchema>>({
    resolver: zodResolver(dmFormSchema),
    defaultValues: { username: '@' },
    mode: 'onChange',
  });

  const groupForm = useForm<z.infer<typeof groupFormSchema>>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: '', link: '' },
    mode: 'onChange',
  });

  const channelForm = useForm<z.infer<typeof channelFormSchema>>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: { name: '', description: '', link: '' },
    mode: 'onChange',
  });

  const dmUsernameValue = dmForm.watch('username');
  const groupLinkValue = groupForm.watch('link');
  const channelLinkValue = channelForm.watch('link');

  useEffect(() => {
    if (!open) return;
    const handleSystemBack = () => { onOpenChange(false); };
    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => { backListener = App.addListener('backButton', handleSystemBack); });
    }
    return () => { if (backListener) { backListener.then((l: any) => l.remove()); } };
  }, [open, onOpenChange]);

  const handleGenerateGroupLink = async () => {
    if (!db) return;
    setIsGeneratingLink(true);
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
        const randomLink = generateRandomLink(8);
        const linkWithPrefix = '/G/' + randomLink;
        const linkRef = doc(db, 'chatLinks', encodeURIComponent(linkWithPrefix));
        try {
            const linkSnap = await getDoc(linkRef);
            if (!linkSnap.exists()) {
                groupForm.setValue('link', randomLink);
                groupForm.clearErrors('link');
                setIsGeneratingLink(false);
                return;
            }
        } catch (error) { break; }
        attempts++;
    }
    setIsGeneratingLink(false);
    toast({ variant: "destructive", title: "Error", description: "Could not generate a unique link automatically." });
  };

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    if (dmUsernameValue && dmUsernameValue.length > 2 && dmUsernameValue.startsWith('@')) {
        setIsCheckingUsername(true); setUsernameExists(false); dmForm.clearErrors('username');
        debounceTimeout.current = setTimeout(async () => {
            if (!db) return;
            try {
                const usernameRef = doc(db, 'usernames', dmUsernameValue);
                const usernameSnap = await getDoc(usernameRef);
                if (usernameSnap.exists()) {
                    if (usernameSnap.data().uid === currentUser.uid) { dmForm.setError('username', { message: t('cannot_chat_with_self_dm') }); }
                    else setUsernameExists(true);
                } else { dmForm.setError('username', { message: t('user_not_found') }); }
            } catch (error) { setUsernameExists(false); }
            finally { setIsCheckingUsername(false); }
        }, 800);
    } else { setUsernameExists(false); setIsCheckingUsername(false); }
  }, [dmUsernameValue, db, dmForm, t, currentUser.uid]);

    useEffect(() => {
        if (groupDebounceTimeout.current) clearTimeout(groupDebounceTimeout.current);
        setLinkOnSale(null);
        if (groupForm.formState.dirtyFields.link) groupForm.clearErrors('link');
        if (groupLinkValue && groupLinkValue.length >= 4 && !/\s/.test(groupLinkValue) && /^[a-zA-Z0-9_]+$/.test(groupLinkValue)) {
            setIsCheckingGroupLink(true);
            groupDebounceTimeout.current = setTimeout(async () => {
                if (!db) return;
                const linkWithPrefix = '/G/' + groupLinkValue;
                const linkRef = doc(db, 'chatLinks', encodeURIComponent(linkWithPrefix));
                try {
                    const linkSnap = await getDoc(linkRef);
                    if (linkSnap.exists()) {
                        const data = linkSnap.data() as ChatLink;
                        if (data.price && data.price > 0 && data.ownerId !== currentUser.uid) {
                            setLinkOnSale({ price: data.price, link: linkWithPrefix });
                        } else {
                            groupForm.setError('link', { message: t('link_taken') });
                        }
                    }
                } finally { setIsCheckingGroupLink(false); }
            }, 800);
        } else { setIsCheckingGroupLink(false); }
    }, [groupLinkValue, db, groupForm, t, currentUser.uid]);

    useEffect(() => {
        if (channelDebounceTimeout.current) clearTimeout(channelDebounceTimeout.current);
        setLinkOnSale(null);
        if (channelForm.formState.dirtyFields.link) channelForm.clearErrors('link');
        if (channelLinkValue && channelLinkValue.length >= 4 && !/\s/.test(channelLinkValue) && /^[a-zA-Z0-9_]+$/.test(channelLinkValue)) {
            setIsCheckingChannelLink(true);
            channelDebounceTimeout.current = setTimeout(async () => {
                if (!db) return;
                const linkWithPrefix = '/C/' + channelLinkValue;
                const linkRef = doc(db, 'chatLinks', encodeURIComponent(linkWithPrefix));
                try {
                    const linkSnap = await getDoc(linkRef);
                    if (linkSnap.exists()) {
                        const data = linkSnap.data() as ChatLink;
                        if (data.price && data.price > 0 && data.ownerId !== currentUser.uid) {
                            setLinkOnSale({ price: data.price, link: linkWithPrefix });
                        } else {
                            channelForm.setError('link', { message: t('link_taken') });
                        }
                    }
                } finally { setIsCheckingChannelLink(false); }
            }, 800);
        } else { setIsCheckingChannelLink(false); }
    }, [channelLinkValue, db, channelForm, t, currentUser.uid]);


  const onDmSubmit = async (values: z.infer<typeof dmFormSchema>) => {
    if (!db || isCreating || !usernameExists) return;
    setIsCreating(true);
    try {
        const usernameRef = doc(db, 'usernames', values.username);
        const usernameSnap = await getDoc(usernameRef);
        if (!usernameSnap.exists()) { setIsCreating(false); return; }
        const targetUserId = usernameSnap.data().uid;
        const members = [currentUser.uid, targetUserId].sort();
        const chatId = members.join('_');
        await runTransaction(db, async (transaction) => {
            const chatRef = doc(db, 'chats', chatId);
            const chatSnap = await transaction.get(chatRef);
            if (chatSnap.exists()) return;
            transaction.set(chatRef, { type: 'dm', members, unreadCounts: members.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}) });
        });
        onOpenChange(false);
        if(onChatCreated) onChatCreated(chatId);
    } catch (e) { console.error(e); }
    finally { setIsCreating(false); }
  };

  const onGroupSubmit = async (values: z.infer<typeof groupFormSchema>) => {
    if (!db || isCreating) return;
    setIsCreating(true);
    const linkWithPrefix = '/G/' + values.link;
    try {
        await runTransaction(db, async (transaction) => {
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(linkWithPrefix));
            const linkDoc = await transaction.get(linkRef);
            if (linkDoc.exists()) throw new Error(t('link_taken'));
            const newChatRef = doc(collection(db, "chats"));
            const newGroup = { type: 'group', name: values.name, members: [currentUser.uid], icon: 'Users', ownerId: currentUser.uid, link: linkWithPrefix, unreadCounts: { [currentUser.uid]: 0 } };
            transaction.set(newChatRef, newGroup);
            transaction.set(linkRef, { chatId: newChatRef.id, ownerId: currentUser.uid });
            if (onChatCreated) onChatCreated(newChatRef.id);
        });
        onOpenChange(false);
    } catch (error: any) { 
        if (error.message.includes(t('link_taken'))) groupForm.setError('link', { message: error.message });
    } finally { setIsCreating(false); }
  };
  
  const onChannelSubmit = async (values: z.infer<typeof channelFormSchema>) => {
    if (!db || isCreating) return;
    setIsCreating(true);
    const linkWithPrefix = '/C/' + values.link;
    try {
        await runTransaction(db, async (transaction) => {
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(linkWithPrefix));
            const linkDoc = await transaction.get(linkRef);
            if (linkDoc.exists()) throw new Error(t('link_taken'));
            const newChatRef = doc(collection(db, "chats"));
            const newChannel = { type: 'channel', name: values.name, description: values.description, members: [currentUser.uid], icon: 'Megaphone', ownerId: currentUser.uid, link: linkWithPrefix, unreadCounts: { [currentUser.uid]: 0 } };
            transaction.set(newChatRef, newChannel);
            transaction.set(linkRef, { chatId: newChatRef.id, ownerId: currentUser.uid });
            if (onChatCreated) onChatCreated(newChatRef.id);
        });
        onOpenChange(false);
    } catch (error: any) {
        if (error.message.includes(t('link_taken'))) channelForm.setError('link', { message: error.message });
    } finally { setIsCreating(false); }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="flex flex-col max-h-[90vh] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
        <DialogHeader className="relative flex-row items-center justify-center p-4 border-b shrink-0 h-16">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button>
            <DialogTitle>{t('new_conversation')}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2"><X /></Button>
        </DialogHeader>
        <div className="p-6 flex-1 overflow-y-auto">
            <Tabs defaultValue="dm" className="w-full">
                <TabsList className="flex flex-wrap h-auto justify-center bg-muted/50 p-1 rounded-xl mb-4">
                    <TabsTrigger value="dm" className="rounded-lg">{t('direct_message_tab')}</TabsTrigger>
                    <TabsTrigger value="group" className="rounded-lg">{t('new_group_tab')}</TabsTrigger>
                    <TabsTrigger value="channel" className="rounded-lg">{t('new_channel_tab')}</TabsTrigger>
                </TabsList>
                <TabsContent value="dm"><Form {...dmForm}><form onSubmit={dmForm.handleSubmit(onDmSubmit)} className="space-y-4 pt-2"><FormField control={dmForm.control} name="username" render={({ field }) => (<FormItem><FormLabel>{t('username_label')}</FormLabel><FormControl><Input placeholder={t('username_placeholder_short')} {...field} /></FormControl><FormMessage /></FormItem>)} /><div className='flex justify-end'><Button type="submit" disabled={isCreating || isCheckingUsername || !usernameExists} className="rounded-xl px-8 h-12 font-bold">{isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('start_chat')}</Button></div></form></Form></TabsContent>
                <TabsContent value="group"><Form {...groupForm}><form onSubmit={groupForm.handleSubmit(onGroupSubmit)} className="space-y-4 pt-2"><FormField control={groupForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('group_name_label')}</FormLabel><FormControl><Input placeholder={t('group_name_placeholder')} {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={groupForm.control} name="link" render={({ field }) => (<FormItem><FormLabel>{t('group_link_label')}</FormLabel><div className="flex items-center gap-2"><div className="relative flex-1"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">/G/</span><FormControl><Input placeholder={t('group_link_placeholder')} className="pl-9" {...field} /></FormControl></div><Button type="button" variant="outline" size="icon" onClick={handleGenerateGroupLink} disabled={isGeneratingLink} className="rounded-lg h-10 w-10">{isGeneratingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}</Button></div><FormMessage /></FormItem>)} />{linkForSale && (<button type="button" onClick={() => setShowBuyLinkDialog(true)} className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-left animate-in zoom-in group hover:bg-amber-500/20 transition-all"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform"><ShoppingBag className="h-5 w-5" /></div><div><p className="text-xs font-bold text-amber-700 leading-tight">{t('link_on_sale', { amount: linkForSale.price })}</p><p className="text-[10px] uppercase font-black tracking-widest text-amber-600/60 mt-0.5">{t('buy_link_button')}</p></div></div><Coins className="h-5 w-5 text-amber-500" /></button>)}<div className='flex justify-end'><Button type="submit" disabled={isCreating || isCheckingGroupLink || !groupForm.formState.isValid} className="rounded-xl px-8 h-12 font-bold">{isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('create_group')}</Button></div></form></Form></TabsContent>
                <TabsContent value="channel"><Form {...channelForm}><form onSubmit={channelForm.handleSubmit(onChannelSubmit)} className="space-y-4 pt-2"><FormField control={channelForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('channel_name_label')}</FormLabel><FormControl><Input placeholder={t('channel_name_placeholder')} {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={channelForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>{t('description_label')}</FormLabel><FormControl><Textarea placeholder={t('description_placeholder')} {...field} className="rounded-xl bg-muted/50 border-none min-h-[100px]" /></FormControl><FormMessage /></FormItem>)} /><FormField control={channelForm.control} name="link" render={({ field }) => (<FormItem><FormLabel>{t('unique_link_label')}</FormLabel><FormControl><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">/C/</span><Input placeholder={t('link_placeholder')} className="pl-9" {...field} /></div></FormControl><FormMessage /></FormItem>)} />{linkForSale && (<button type="button" onClick={() => setShowBuyLinkDialog(true)} className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-left animate-in zoom-in group hover:bg-amber-500/20 transition-all"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform"><ShoppingBag className="h-5 w-5" /></div><div><p className="text-xs font-bold text-amber-700 leading-tight">{t('link_on_sale', { amount: linkForSale.price })}</p><p className="text-[10px] uppercase font-black tracking-widest text-amber-600/60 mt-0.5">{t('buy_link_button')}</p></div></div><Coins className="h-5 w-5 text-amber-500" /></button>)}<div className='flex justify-end'><Button type="submit" disabled={isCreating || isCheckingChannelLink || !channelForm.formState.isValid} className="rounded-xl px-8 h-12 font-bold">{isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('create_channel')}</Button></div></form></Form></TabsContent>
            </Tabs>
        </div>
      </DialogContent>
    </Dialog>
    {linkForSale && <BuyLinkDialog open={showBuyLinkDialog} onOpenChange={setShowBuyLinkDialog} link={linkForSale.link} price={linkForSale.price} currentUser={currentUser} onSuccess={(cid) => { setShowBuyLinkDialog(false); onOpenChange(false); if (onChatCreated) onChatCreated(cid); }} />}
    </>
  );
}

function BuyLinkDialog({ open, onOpenChange, link, price, currentUser, onSuccess }: { open: boolean, onOpenChange: (o: boolean) => void, link: string, price: number, currentUser: AuthenticatedUser, onSuccess: (cid: string) => void }) {
    const { t } = useLanguage(); const db = useFirestore(); const { toast } = useToast();
    const [isBuying, setIsBuying] = useState(false); const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [targetChatId, setTargetChatId] = useState<string>(''); const [newName, setNewName] = useState('');
    
    const chatsQuery = useMemo(() => db ? query(collection(db, 'chats'), where('ownerId', '==', currentUser.uid)) : null, [db, currentUser.uid]);
    const { data: myChats } = useCollection<Chat>(chatsQuery);
    const eligibleChats = useMemo(() => myChats?.filter(c => c.id !== 'GENERAL_CHAT') || [], [myChats]);

    const handleBuy = async () => {
        if (!db || isBuying) return;
        if (mode === 'existing' && !targetChatId) return;
        if (mode === 'new' && !newName.trim()) return;
        setIsBuying(true);
        try {
            await runTransaction(db, async (tx) => {
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await tx.get(userRef);
                if (!userSnap.exists()) throw new Error("User not found");
                if ((userSnap.data().infGoldBalance || 0) < price) throw new Error(t('not_enough_gold'));

                const linkRef = doc(db, 'chatLinks', encodeURIComponent(link));
                const linkSnap = await tx.get(linkRef);
                if (!linkSnap.exists()) throw new Error("Link no longer available.");
                const sellerId = linkSnap.data().ownerId;
                const oldChatId = linkSnap.data().chatId;

                let finalChatId = targetChatId;
                if (mode === 'new') {
                    const newChatRef = doc(collection(db, 'chats'));
                    finalChatId = newChatRef.id;
                    tx.set(newChatRef, { type: link.startsWith('/G/') ? 'group' : 'channel', name: newName.trim(), members: [currentUser.uid], ownerId: currentUser.uid, link: link, unreadCounts: { [currentUser.uid]: 0 } });
                } else {
                    const targetChatRef = doc(db, 'chats', targetChatId);
                    const targetChatSnap = await tx.get(targetChatRef);
                    const oldLink = targetChatSnap.data()?.link;
                    if (oldLink) tx.delete(doc(db, 'chatLinks', encodeURIComponent(oldLink)));
                    tx.update(targetChatRef, { link: link });
                }

                tx.update(doc(db, 'chats', oldChatId), { link: deleteField() });
                tx.update(userRef, { infGoldBalance: increment(-price) });
                if (sellerId) tx.update(doc(db, 'users', sellerId), { infGoldBalance: increment(price) });
                tx.update(linkRef, { chatId: finalChatId, ownerId: currentUser.uid, price: deleteField() });
                return finalChatId;
            }).then((cid) => { toast({ title: t('dm_success'), description: t('link_transfer_success') }); onSuccess(cid!); });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
        finally { setIsBuying(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent hideCloseButton className="max-w-sm rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 border-b shrink-0 h-16 flex-row items-center justify-between"><DialogTitle className="text-lg font-bold font-headline">{t('purchase_confirm')}</DialogTitle><Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full"><X /></Button></DialogHeader>
                <div className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 mx-auto mb-2"><Sparkles className="h-8 w-8" /></div>
                        <h3 className="font-black text-2xl text-primary leading-tight">{link}</h3>
                        <div className="flex items-center justify-center gap-2 text-amber-600 font-bold"><Coins className="h-5 w-5" /><span>{price} InfGold</span></div>
                    </div>
                    <div className="flex bg-muted/50 p-1 rounded-xl"><button onClick={() => setMode('existing')} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", mode === 'existing' ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}>{t('buy_for_existing_chat')}</button><button onClick={() => setMode('new')} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", mode === 'new' ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}>{t('buy_and_create_new')}</button></div>
                    {mode === 'existing' ? (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Выберите свой чат</Label>
                            {eligibleChats.length > 0 ? (
                                <Select value={targetChatId} onValueChange={setTargetChatId}><SelectTrigger className="h-12 rounded-xl bg-muted/50 border-none font-bold"><SelectValue placeholder="Select chat..." /></SelectTrigger><SelectContent className="rounded-xl">{eligibleChats.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.name}</SelectItem>)}</SelectContent></Select>
                            ) : (<p className="text-xs text-center p-4 bg-muted/30 rounded-xl text-muted-foreground italic">{t('no_chats_to_apply')}</p>)}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Название чата</Label>
                            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Напр. Мой Мега Канал" className="h-12 rounded-xl bg-muted/50 border-none font-bold" />
                        </div>
                    )}
                </div>
                <DialogFooter className="p-6 pt-0 flex flex-col gap-2"><Button onClick={handleBuy} disabled={isBuying || (mode === 'existing' && !targetChatId) || (mode === 'new' && !newName.trim())} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">{isBuying ? <Loader2 className="animate-spin" /> : t('buy_link_button')}</Button><Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-12 rounded-xl text-muted-foreground">{t('cancel')}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
