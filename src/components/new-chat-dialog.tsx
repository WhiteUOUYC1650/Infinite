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
import { collection, doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/language-context';

const dmFormSchema = z.object({
  username: z.string()
    .min(2, { message: 'Username is too short.' })
    .refine(value => value.startsWith('@'), { message: "Username must start with '@'." }),
});

const groupFormSchema = z.object({
  name: z.string().min(3, { message: 'Group name must be at least 3 characters.' }),
});

const channelFormSchema = z.object({
    name: z.string().min(3, { message: 'Channel name must be at least 3 characters.' }),
    description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
    link: z.string().min(5, { message: 'Link must be at least 4 characters after /C/.'})
        .refine(value => value.startsWith('/C/'), { message: "Link must start with '/C/'." })
        .refine(value => !/\s/.test(value), { message: 'Link must not contain spaces.'}),
});


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

  const dmForm = useForm<z.infer<typeof dmFormSchema>>({
    resolver: zodResolver(dmFormSchema),
    defaultValues: { username: '@' },
  });

  const groupForm = useForm<z.infer<typeof groupFormSchema>>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: '' },
  });

  const channelForm = useForm<z.infer<typeof channelFormSchema>>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: { name: '', description: '', link: '/C/' },
  });

  const onDmSubmit = async (values: z.infer<typeof dmFormSchema>) => {
    if (!db || isCreating) return;
    setIsCreating(true);
    dmForm.clearErrors();

    try {
        const usernameRef = doc(db, 'usernames', values.username);
        const usernameSnap = await getDoc(usernameRef);

        if (!usernameSnap.exists()) {
            dmForm.setError('username', { message: t('user_not_found') });
            setIsCreating(false);
            return;
        }

        const targetUserId = usernameSnap.data().uid;
        
        const members = targetUserId === currentUser.uid
            ? [currentUser.uid]
            : [currentUser.uid, targetUserId].sort();
        
        const chatId = members.join('_');
        const chatRef = doc(db, 'chats', chatId);

        const chatSnap = await getDoc(chatRef);

        if (chatSnap.exists()) {
            toast({ title: t('chat_exists'), description: t('chat_exists_desc') });
            onOpenChange(false);
            if(onChatCreated) onChatCreated(chatId);
            setIsCreating(false);
            return;
        }

        await setDoc(chatRef, {
            type: 'dm',
            members: members,
        });
        
        toast({ title: t('dm_success'), description: t('dm_success_desc', { username: values.username })});
        onOpenChange(false);
        if(onChatCreated) onChatCreated(chatId);

    } catch (error) {
        console.error("Error creating DM:", error);
        toast({ variant: 'destructive', title: 'Error', description: t('dm_error') });
    } finally {
        setIsCreating(false);
    }
  };

  const onGroupSubmit = async (values: z.infer<typeof groupFormSchema>) => {
    if (!db || isCreating) return;
    setIsCreating(true);

    try {
        await runTransaction(db, async (transaction) => {
            const newChatRef = doc(collection(db, "chats"));
            
            // This is a simplified random link generator. For production, a more robust solution is needed.
            const link = '/G/' + Math.random().toString(36).substr(2, 8);
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(link));

            const linkDoc = await transaction.get(linkRef);
            if (linkDoc.exists()) {
                throw new Error(t('link_error'));
            }

            const newGroup = {
                type: 'group',
                name: values.name,
                members: [currentUser.uid],
                icon: 'Users',
                ownerId: currentUser.uid,
                link: link
            };
            
            transaction.set(newChatRef, newGroup);
            transaction.set(linkRef, { chatId: newChatRef.id });

            toast({ title: t('dm_success'), description: t('group_success', {groupName: values.name}) });
            onOpenChange(false);
            if (onChatCreated) onChatCreated(newChatRef.id);
        });
    } catch (error: any) {
        console.error("Error creating group:", error);
        const isPermissionError = error.name === 'FirestorePermissionError';
        if (isPermissionError) {
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
    channelForm.clearErrors();

    try {
        await runTransaction(db, async (transaction) => {
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(values.link));
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
                link: values.link,
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
            toast({ variant: 'destructive', title: 'Error', description: t('channel_error') });
        }
    } finally {
        setIsCreating(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('new_conversation')}</DialogTitle>
          <DialogDescription>{t('new_conversation_desc')}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="dm" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dm">{t('direct_message_tab')}</TabsTrigger>
                <TabsTrigger value="group">{t('new_group_tab')}</TabsTrigger>
                <TabsTrigger value="channel">{t('new_channel_tab')}</TabsTrigger>
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
                                <Input placeholder={t('username_placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <div className='flex justify-end'>
                            <Button type="submit" disabled={isCreating}>
                                {isCreating ? t('searching') : t('start_chat')}
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
                         <div className='flex justify-end'>
                            <Button type="submit" disabled={isCreating}>
                                {isCreating ? t('creating') : t('create_group')}
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
                                <Textarea placeholder={t('description_placeholder')} {...field} />
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
                                <Input placeholder={t('link_placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <div className='flex justify-end'>
                            <Button type="submit" disabled={isCreating}>
                                {isCreating ? t('creating') : t('create_channel')}
                            </Button>
                        </div>
                    </form>
                </Form>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
