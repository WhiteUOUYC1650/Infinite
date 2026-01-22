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
import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

const dmFormSchema = z.object({
  username: z.string()
    .min(2, { message: 'Username is too short.' })
    .refine(value => value.startsWith('@'), { message: "Username must start with '@'." }),
});

const groupFormSchema = z.object({
  name: z.string().min(3, { message: 'Group name must be at least 3 characters.' }),
  icon: z.string().optional(),
});

const channelFormSchema = z.object({
    name: z.string().min(3, { message: 'Channel name must be at least 3 characters.' }),
    description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
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
    defaultValues: { name: '', description: '' },
  });

  const onDmSubmit = async (values: z.infer<typeof dmFormSchema>) => {
    if (!db || isCreating) return;
    setIsCreating(true);
    dmForm.clearErrors();

    try {
        const usernameRef = doc(db, 'usernames', values.username);
        const usernameSnap = await getDoc(usernameRef);

        if (!usernameSnap.exists()) {
            dmForm.setError('username', { message: 'User not found.' });
            setIsCreating(false);
            return;
        }

        const targetUserId = usernameSnap.data().uid;
        if (targetUserId === currentUser.uid) {
            dmForm.setError('username', { message: "You can't start a chat with yourself." });
            setIsCreating(false);
            return;
        }
        
        const chatsRef = collection(db, "chats");
        const q = query(chatsRef, where("type", "==", "dm"), where("members", "array-contains", currentUser.uid));
        const querySnapshot = await getDocs(q);
        const existingChat = querySnapshot.docs.find(d => d.data().members.includes(targetUserId));

        if (existingChat) {
            toast({ title: 'Chat already exists', description: 'This direct message chat is already in your list.' });
            onOpenChange(false);
            if(onChatCreated) onChatCreated(existingChat.id);
            setIsCreating(false);
            return;
        }

        const newChatRef = await addDoc(chatsRef, {
            type: 'dm',
            members: [currentUser.uid, targetUserId],
        });
        
        toast({ title: 'Success!', description: `Chat with ${values.username} started.`});
        onOpenChange(false);
        if(onChatCreated) onChatCreated(newChatRef.id);

    } catch (error) {
        console.error("Error creating DM:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not create direct message.' });
    } finally {
        setIsCreating(false);
    }
  };

  const onGroupSubmit = async (values: z.infer<typeof groupFormSchema>) => {
    if (!db || isCreating) return;
    setIsCreating(true);

    const newGroup = {
      type: 'group',
      name: values.name,
      members: [currentUser.uid],
      icon: 'Users',
      ownerId: currentUser.uid,
    };

    addDoc(collection(db, 'chats'), newGroup)
        .then((docRef) => {
            toast({ title: 'Success!', description: `Group "${values.name}" created.` });
            onOpenChange(false);
            if (onChatCreated) onChatCreated(docRef.id);
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: 'chats',
                operation: 'create',
                requestResourceData: newGroup,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => setIsCreating(false));
  };
  
  const onChannelSubmit = async (values: z.infer<typeof channelFormSchema>) => {
    if (!db || isCreating) return;
    setIsCreating(true);

    const newChannel = {
      type: 'channel',
      name: values.name,
      description: values.description,
      members: [currentUser.uid],
      icon: 'Megaphone',
      ownerId: currentUser.uid,
    };

    addDoc(collection(db, 'chats'), newChannel)
        .then((docRef) => {
            toast({ title: 'Success!', description: `Channel "${values.name}" created.` });
            onOpenChange(false);
            if (onChatCreated) onChatCreated(docRef.id);
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: 'chats',
                operation: 'create',
                requestResourceData: newChannel,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => setIsCreating(false));
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a new direct message, group discussion, or broadcast channel.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="dm" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dm">Direct Message</TabsTrigger>
                <TabsTrigger value="group">New Group</TabsTrigger>
                <TabsTrigger value="channel">New Channel</TabsTrigger>
            </TabsList>
            <TabsContent value="dm">
                <Form {...dmForm}>
                    <form onSubmit={dmForm.handleSubmit(onDmSubmit)} className="space-y-4 pt-4">
                        <FormField
                        control={dmForm.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                                <Input placeholder="@username" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <div className='flex justify-end'>
                            <Button type="submit" disabled={isCreating}>
                                {isCreating ? 'Searching...' : 'Start Chat'}
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
                            <FormLabel>Group Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Project Team" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <div className='flex justify-end'>
                            <Button type="submit" disabled={isCreating}>
                                {isCreating ? 'Creating...' : 'Create Group'}
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
                            <FormLabel>Channel Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Company Announcements" {...field} />
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
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="What is this channel about?" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <div className='flex justify-end'>
                            <Button type="submit" disabled={isCreating}>
                                {isCreating ? 'Creating...' : 'Create Channel'}
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
