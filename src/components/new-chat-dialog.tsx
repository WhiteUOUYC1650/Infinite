
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
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore } from '@/firebase';
import { collection, doc, getDoc, runTransaction } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/language-context';
import { Loader2, Dices, ArrowLeft, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

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

  // --- System Back Button Support ---
  useEffect(() => {
    if (!open) return;

    const handleSystemBack = () => {
      onOpenChange(false);
    };

    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        backListener = App.addListener('backButton', handleSystemBack);
      });
    }

    return () => {
      if (backListener) {
        backListener.then((l: any) => l.remove());
      }
    };
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
        } catch (error) {
            console.error("Error checking generated group link", error);
            break; // Exit loop on error
        }
        attempts++;
    }
    setIsGeneratingLink(false);
    toast({
        variant: "destructive",
        title: "Error",
        description: "Could not generate a unique link automatically. Please enter one manually.",
    });
  };

  useEffect(() => {
    if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
    }

    if (dmUsernameValue && dmUsernameValue.length > 2 && dmUsernameValue.startsWith('@')) {
        setIsCheckingUsername(true);
        setUsernameExists(false);
        dmForm.clearErrors('username');
        debounceTimeout.current = setTimeout(async () => {
            if (!db) return;
            try {
                const usernameRef = doc(db, 'usernames', dmUsernameValue);
                const usernameSnap = await getDoc(usernameRef);
                if (usernameSnap.exists()) {
                    if (usernameSnap.data().uid === currentUser.uid) {
                         dmForm.setError('username', { message: t('cannot_chat_with_self_dm') });
                         setUsernameExists(false);
                    } else {
                        setUsernameExists(true);
                    }
                } else {
                    setUsernameExists(false);
                    dmForm.setError('username', { message: t('user_not_found') });
                }
            } catch (error) {
                setUsernameExists(false);
            } finally {
                setIsCheckingUsername(false);
            }
        }, 800);
    } else {
        setUsernameExists(false);
        setIsCheckingUsername(false);
    }

    return () => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
    };
  }, [dmUsernameValue, db, dmForm, t, currentUser.uid]);

    useEffect(() => {
        if (groupDebounceTimeout.current) clearTimeout(groupDebounceTimeout.current);
        if (groupForm.formState.dirtyFields.link) {
            groupForm.clearErrors('link');
        }

        if (groupLinkValue && groupLinkValue.length >= 4 && !/\s/.test(groupLinkValue) && /^[a-zA-Z0-9_]+$/.test(groupLinkValue)) {
            setIsCheckingGroupLink(true);
            groupDebounceTimeout.current = setTimeout(async () => {
                if (!db) return;
                const linkWithPrefix = '/G/' + groupLinkValue;
                const linkRef = doc(db, 'chatLinks', encodeURIComponent(linkWithPrefix));
                try {
                    const linkSnap = await getDoc(linkRef);
                    if (linkSnap.exists()) {
                        groupForm.setError('link', { message: t('link_taken') });
                    }
                } catch (error) {
                    console.error("Error checking group link", error);
                } finally {
                    setIsCheckingGroupLink(false);
                }
            }, 800);
        } else {
            setIsCheckingGroupLink(false);
        }

        return () => {
            if (groupDebounceTimeout.current) clearTimeout(groupDebounceTimeout.current);
        };
    }, [groupLinkValue, db, groupForm, t]);

    useEffect(() => {
        if (channelDebounceTimeout.current) clearTimeout(channelDebounceTimeout.current);
        if (channelForm.formState.dirtyFields.link) {
            channelForm.clearErrors('link');
        }

        if (channelLinkValue && channelLinkValue.length >= 4 && !/\s/.test(channelLinkValue) && /^[a-zA-Z0-9_]+$/.test(channelLinkValue)) {
            setIsCheckingChannelLink(true);
            channelDebounceTimeout.current = setTimeout(async () => {
                if (!db) return;
                const linkWithPrefix = '/C/' + channelLinkValue;
                const linkRef = doc(db, 'chatLinks', encodeURIComponent(linkWithPrefix));
                try {
                    const linkSnap = await getDoc(linkRef);
                    if (linkSnap.exists()) {
                        channelForm.setError('link', { message: t('link_taken') });
                    }
                } catch (error) {
                    console.error("Error checking channel link", error);
                } finally {
                    setIsCheckingChannelLink(false);
                }
            }, 800);
        } else {
            setIsCheckingChannelLink(false);
        }

        return () => {
            if (channelDebounceTimeout.current) clearTimeout(channelDebounceTimeout.current);
        };
    }, [channelLinkValue, db, channelForm, t]);


  const onDmSubmit = async (values: z.infer<typeof dmFormSchema>) => {
    if (!db || isCreating || !usernameExists) return;
    setIsCreating(true);

    let chatId = '';
    let targetUserId = '';
    try {
        const usernameRef = doc(db, 'usernames', values.username);
        const usernameSnap = await getDoc(usernameRef);

        if (!usernameSnap.exists()) {
            dmForm.setError('username', { message: t('user_not_found') });
            setIsCreating(false);
            return;
        }

        targetUserId = usernameSnap.data().uid;
        
        const members = [currentUser.uid, targetUserId].sort();
        
        chatId = members.join('_');
        
        await runTransaction(db, async (transaction) => {
            const chatRef = doc(db, 'chats', chatId);
            const chatSnap = await transaction.get(chatRef);

            if (chatSnap.exists()) {
                // Chat already exists, do nothing.
                return;
            }

            const newChatData = {
                type: 'dm' as const,
                members: members,
                unreadCounts: members.reduce((acc, memberId) => ({ ...acc, [memberId]: 0 }), {}),
            };
            transaction.set(chatRef, newChatData);
        });

        toast({ title: t('dm_success'), description: t('dm_success_desc', { username: values.username })});
        onOpenChange(false);
        if(onChatCreated) onChatCreated(chatId);

    } catch (serverError: any) {
         console.error("Error creating DM:", serverError);
         const chatRefPath = `chats/${chatId || [currentUser.uid, targetUserId || 'other_user'].sort().join('_')}`;
         const permissionError = new FirestorePermissionError({
             path: chatRefPath,
             operation: 'write', 
         });
         errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsCreating(false);
    }
  };

  const onGroupSubmit = async (values: z.infer<typeof groupFormSchema>) => {
    if (!db || isCreating) return;
    setIsCreating(true);
    groupForm.clearErrors('link');

    const linkWithPrefix = '/G/' + values.link;

    try {
        await runTransaction(db, async (transaction) => {
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(linkWithPrefix));
            const linkDoc = await transaction.get(linkRef);

            if (linkDoc.exists()) {
                 throw new Error(t('link_taken'));
            }

            const newChatRef = doc(collection(db, "chats"));
            const newGroup = {
                type: 'group',
                name: values.name,
                members: [currentUser.uid],
                icon: 'Users',
                ownerId: currentUser.uid,
                link: linkWithPrefix,
                unreadCounts: { [currentUser.uid]: 0 },
            };
            
            transaction.set(newChatRef, newGroup);
            transaction.set(linkRef, { chatId: newChatRef.id });

            toast({ title: t('dm_success'), description: t('group_success', {groupName: values.name}) });
            onOpenChange(false);
            if (onChatCreated) onChatCreated(newChatRef.id);
        });
    } catch (error: any) {
        console.error("Error creating group:", error);
        if (error.message.includes(t('link_taken'))) {
            groupForm.setError('link', { message: error.message });
        } else if (error.name === 'FirestorePermissionError') {
             errorEmitter.emit('permission-error', error);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: error.message || t('group_error') });
        }
    } finally {
        setIsCreating(false);
    }
  };
  
  const onChannelSubmit = async (values: z.infer<typeof channelFormSchema>) => {
    if (!db || isCreating) return;
    setIsCreating(true);
    channelForm.clearErrors('link');

    const linkWithPrefix = '/C/' + values.link;

    try {
        await runTransaction(db, async (transaction) => {
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(linkWithPrefix));
            const linkDoc = await transaction.get(linkRef);

            if (linkDoc.exists()) {
                throw new Error(t('link_taken'));
            }

            const newChatRef = doc(collection(db, "chats"));
            const newChannel = {
                type: 'channel',
                name: values.name,
                description: values.description,
                members: [currentUser.uid],
                icon: 'Megaphone',
                ownerId: currentUser.uid,
                link: linkWithPrefix,
                unreadCounts: { [currentUser.uid]: 0 },
            };

            transaction.set(newChatRef, newChannel);
            transaction.set(linkRef, { chatId: newChatRef.id });
            
            toast({ title: t('dm_success'), description: t('channel_success', {channelName: values.name}) });
            onOpenChange(false);
            if (onChatCreated) onChatCreated(newChatRef.id);
        });
    } catch (error: any) {
         console.error("Error creating channel:", error);
        if (error.message.includes(t('link_taken'))) {
            channelForm.setError('link', { message: error.message });
        } else if (error.name === 'FirestorePermissionError') {
             errorEmitter.emit('permission-error', error);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: error.message || t('channel_error') });
        }
    } finally {
        setIsCreating(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="flex flex-col max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="relative flex-row items-center justify-center p-4 border-b shrink-0 h-16">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute left-2 top-1/2 -translate-y-1/2">
                <ArrowLeft />
            </Button>
            <DialogTitle>{t('new_conversation')}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X />
            </Button>
        </DialogHeader>
        <div className="p-6 flex-1 overflow-y-auto">
            <DialogDescription className="mb-4">{t('new_conversation_desc')}</DialogDescription>
            <Tabs defaultValue="dm" className="w-full pt-2">
                <TabsList className="flex flex-wrap h-auto justify-center bg-muted/50 p-1 rounded-xl">
                    <TabsTrigger value="dm" className="rounded-lg">{t('direct_message_tab')}</TabsTrigger>
                    <TabsTrigger value="group" className="rounded-lg">{t('new_group_tab')}</TabsTrigger>
                    <TabsTrigger value="channel" className="rounded-lg">{t('new_channel_tab')}</TabsTrigger>
                </TabsList>
                <TabsContent value="dm">
                    <Form {...dmForm}>
                        <form onSubmit={dmForm.handleSubmit(onDmSubmit)} className="space-y-4 pt-4">
                            <FormField
                            control={dmForm.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('username_label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('username_placeholder_short')} {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <div className='flex justify-end'>
                                <Button type="submit" disabled={isCreating || isCheckingUsername || !usernameExists} className="rounded-xl px-8 h-12 font-bold">
                                    {isCreating ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('creating')} </> : 
                                    isCheckingUsername ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('checking')} </> : 
                                    t('start_chat')}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
                <TabsContent value="group">
                    <Form {...groupForm}>
                        <form onSubmit={groupForm.handleSubmit(onGroupSubmit)} className="space-y-4 pt-4">
                            <FormField
                            control={groupForm.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('group_name_label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('group_name_placeholder')} {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                                control={groupForm.control}
                                name="link"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('group_link_label')}</FormLabel>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                                                    /G/
                                                </span>
                                                <FormControl>
                                                    <Input placeholder={t('group_link_placeholder')} className="pl-9" {...field} />
                                                </FormControl>
                                            </div>
                                            <Button type="button" variant="outline" size="icon" onClick={handleGenerateGroupLink} disabled={isGeneratingLink} className="rounded-lg h-10 w-10">
                                                {isGeneratingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className='flex justify-end'>
                                <Button type="submit" disabled={isCreating || isCheckingGroupLink || !groupForm.formState.isValid} className="rounded-xl px-8 h-12 font-bold">
                                    {isCreating ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('creating')} </> : 
                                    isCheckingGroupLink ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('checking')} </> : 
                                    t('create_group')}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
                <TabsContent value="channel">
                    <Form {...channelForm}>
                        <form onSubmit={channelForm.handleSubmit(onChannelSubmit)} className="space-y-4 pt-4">
                            <FormField
                            control={channelForm.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('channel_name_label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder={t('channel_name_placeholder')} {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={channelForm.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('description_label')}</FormLabel>
                                <FormControl>
                                    <Textarea placeholder={t('description_placeholder')} {...field} className="rounded-xl bg-muted/50 border-none min-h-[100px]" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={channelForm.control}
                            name="link"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t('unique_link_label')}</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                                            /C/
                                        </span>
                                        <Input placeholder={t('link_placeholder')} className="pl-9" {...field} />
                                    </div>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <div className='flex justify-end'>
                                <Button type="submit" disabled={isCreating || isCheckingChannelLink || !channelForm.formState.isValid} className="rounded-xl px-8 h-12 font-bold">
                                    {isCreating ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('creating')} </> : 
                                    isCheckingChannelLink ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('checking')} </> :
                                    t('create_channel')}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
            </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
