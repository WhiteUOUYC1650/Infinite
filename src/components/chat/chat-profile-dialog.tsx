'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AuthenticatedUser, PopulatedChat, User } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Megaphone, Users, LogOut, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayRemove, deleteDoc } from 'firebase/firestore';
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
import { useState } from 'react';

interface ChatProfileDialogProps {
  chat: PopulatedChat;
  members: User[];
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseChat: () => void;
}

export function ChatProfileDialog({ chat, members, currentUser, open, onOpenChange, onCloseChat }: ChatProfileDialogProps) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isOwner = chat.ownerId === currentUser.uid;

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
        onCloseChat();
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
      <DialogContent className="max-w-sm">
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
        <div className="text-center py-4">
            <h2 className="text-2xl font-bold font-headline">{chat.name}</h2>
            <p className="text-muted-foreground">{chat.link}</p>
        </div>

        {chat.description && (
             <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">{chat.description}</p>
            </div>
        )}

        {chat.type === 'group' && (
            <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('members_count', { count: members.length })}</h3>
                <ScrollArea className="h-24 pr-4">
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
       
        <DialogFooter className='!justify-center flex-col sm:flex-col sm:space-x-0 gap-2 pt-4'>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
