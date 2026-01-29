'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AuthenticatedUser, PopulatedChat, User, type Chat } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Avatar } from '../ui/avatar';
import { Megaphone, Users, LogOut, Trash2, Pencil, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, doc, updateDoc, arrayRemove, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { Badge } from '../ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface ChatProfileDialogProps {
  chat: PopulatedChat;
  members: User[];
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseChat: () => void;
}

const chatEditSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }),
  description: z.string().max(200, 'Description must be 200 characters or less.').optional(),
  discussionChatId: z.string().optional(),
});


export function ChatProfileDialog({ chat, members, currentUser, open, onOpenChange, onCloseChat }: ChatProfileDialogProps) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ownedGroups, setOwnedGroups] = useState<Chat[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const isOwner = chat.ownerId === currentUser.uid;

  const form = useForm<z.infer<typeof chatEditSchema>>({
    resolver: zodResolver(chatEditSchema),
    defaultValues: {
        name: chat.name || '',
        description: chat.description || '',
        discussionChatId: chat.discussionChatId || '',
    },
  });

  useEffect(() => {
    if (isEditing && chat.type === 'channel' && db) {
        const fetchOwnedGroups = async () => {
            setIsLoadingGroups(true);
            const groupsCollection = collection(db, 'chats');
            const q = query(groupsCollection, where('ownerId', '==', currentUser.uid), where('type', '==', 'group'));
            try {
                const querySnapshot = await getDocs(q);
                const groups = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
                setOwnedGroups(groups);
            } catch (error) {
                console.error("Error fetching owned groups:", error);
                toast({ variant: 'destructive', title: 'Error', description: "Could not load your groups." });
            } finally {
                setIsLoadingGroups(false);
            }
        };
        fetchOwnedGroups();
    }
  }, [isEditing, chat.type, db, currentUser.uid, toast]);

  useEffect(() => {
    if (open) {
        form.reset({
            name: chat.name || '',
            description: chat.description || '',
            discussionChatId: chat.discussionChatId || '',
        });
        setIsEditing(false); // Reset editing state when dialog opens
    }
  }, [chat, form, open]);

  const handleSaveChanges = async (values: z.infer<typeof chatEditSchema>) => {
    if (!db || !isOwner) return;
    setIsSaving(true);
    const chatRef = doc(db, 'chats', chat.id);
    const dataToUpdate: { [key: string]: any } = { name: values.name };

    if (chat.type === 'channel') {
        dataToUpdate.description = values.description;
        dataToUpdate.discussionChatId = values.discussionChatId === 'none' ? '' : values.discussionChatId;
    } else if (chat.type === 'group') {
        dataToUpdate.description = values.description;
    }
    
    try {
        await updateDoc(chatRef, dataToUpdate);
        toast({ title: t('dm_success'), description: t('chat_update_success') });
        setIsEditing(false);
    } catch (error) {
        console.error("Error updating chat:", error);
        toast({ variant: 'destructive', title: 'Error', description: t('chat_update_error')});
    } finally {
        setIsSaving(false);
    }
  };


  const handleLeaveChat = async () => {
    if (!db) return;
    setIsLeaving(true);
    const chatRef = doc(db, 'chats', chat.id);
    try {
        await updateDoc(chatRef, {
            members: arrayRemove(currentUser.uid)
        });
        toast({ title: t('dm_success'), description: t('leave_chat_success')});
        onOpenChange(false);
        // Do not close the chat view, let the user see they've left.
        // onCloseChat();
    } catch (error) {
        console.error("Error leaving chat:", error);
        toast({ variant: 'destructive', title: 'Error', description: t('leave_chat_error')});
    } finally {
        setIsLeaving(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!db || !isOwner) return;
    setIsDeleting(true);
    const chatRef = doc(db, 'chats', chat.id);
    try {
        // In a real app, you'd also delete messages and chatLinks in a transaction or cloud function.
        // For this prototype, we'll just delete the chat doc.
        await deleteDoc(chatRef);
        toast({ title: t('dm_success'), description: t('delete_chat_success')});
        onOpenChange(false);
        onCloseChat();
    } catch (error) {
        console.error("Error deleting chat:", error);
        toast({ variant: 'destructive', title: 'Error', description: t('delete_chat_error')});
    } finally {
        setIsDeleting(false);
    }
  }

  const Icon = chat.type === 'group' ? Users : Megaphone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm flex flex-col max-h-[90vh]">
        {isEditing ? (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveChanges)} className="flex flex-col h-full overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>{t('edit_chat_title')}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6">
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{chat.type === 'group' ? t('group_name_label') : t('channel_name_label')}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {(chat.type === 'channel' || chat.type === 'group') && (
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('description_label')}</FormLabel>
                                            <FormControl>
                                                <Textarea {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            {chat.type === 'channel' && (
                                <FormField
                                    control={form.control}
                                    name="discussionChatId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('discussion_chat_label')}</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger disabled={isLoadingGroups}>
                                                        <SelectValue placeholder={t('select_discussion_chat_placeholder')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">{t('none_label')}</SelectItem>
                                                    {ownedGroups.map(group => (
                                                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                    <DialogFooter className="mt-auto pt-4 border-t -mx-6 px-6 pb-0">
                        <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>{t('cancel')}</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('save')}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        ) : (
            <>
                <DialogHeader>
                    <DialogTitle className="sr-only">{chat.name}'s Profile</DialogTitle>
                    <div className='relative mx-auto w-32 h-32'>
                        <Avatar className="w-32 h-32 text-4xl">
                            <div className="flex h-full w-full items-center justify-center bg-secondary">
                                <Icon className="h-16 w-16 text-secondary-foreground" />
                            </div>
                        </Avatar>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6 space-y-4">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold font-headline">{chat.name}</h2>
                        <p className="text-muted-foreground">{chat.link}</p>
                    </div>

                    {chat.description && (
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm">{chat.description}</p>
                        </div>
                    )}

                    {(chat.type === 'group' || chat.type === 'channel') && (
                        <div>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('members_count', { count: members.length })}</h3>
                            <ScrollArea className="h-auto max-h-48 pr-4">
                                <div className="space-y-2">
                                    {members.map(member => (
                                        <div key={member.id} className="flex items-center gap-3">
                                            <UserAvatarWithStatus user={member} />
                                            <div className="flex-1 truncate">
                                                <p className="font-semibold truncate">{member.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{member.username}</p>
                                            </div>
                                            {chat.ownerId === member.id && <Badge variant="secondary">{t('owner')}</Badge>}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>
            
                <DialogFooter className='!justify-center flex-col sm:flex-col sm:space-x-0 gap-2 pt-4 mt-auto border-t -mx-6 px-6 pb-0'>
                    {isOwner && chat.id !== 'GENERAL_CHAT' && chat.type !== 'dm' && (
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('edit')}
                        </Button>
                    )}

                    {chat.id !== 'GENERAL_CHAT' && (<>
                        {isOwner ? (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeleting}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {isDeleting ? t('deleting') : t('delete_chat')}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('delete_chat_confirm')}
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteChat} disabled={isDeleting}>
                                        {t('delete')}
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isLeaving}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        {isLeaving ? t('leaving') : t('leave_chat')}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t(chat.type === 'group' ? 'leave_group_confirm' : 'leave_channel_confirm')}
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleLeaveChat} disabled={isLeaving}>
                                        {t('leave')}
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </>)}
                </DialogFooter>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}
