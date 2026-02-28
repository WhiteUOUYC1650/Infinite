
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
import { AuthenticatedUser, PopulatedChat, User, type Chat } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Megaphone, Users, LogOut, Trash2, Pencil, Loader2, MessageSquare, Share2, Bell, BellOff } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, doc, updateDoc, arrayRemove, deleteDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
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
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { VerifiedBadge } from '../ui/verified-badge';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

interface ChatProfileDialogProps {
  chat: PopulatedChat;
  members: User[];
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseChat: () => void;
  onJoinDiscussion?: (id: string) => void;
}

const chatEditSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }),
  description: z.string().max(200, 'Description must be 200 characters or less.').optional(),
  discussionChatId: z.string().optional(),
  avatar: z.string().optional(),
});

// Helper to center the crop
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

// Helper to get the cropped image data URL
async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop
): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const pixelRatio = window.devicePixelRatio;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result as string));
      reader.addEventListener('error', (error) => reject(error));
      reader.readAsDataURL(blob);
    }, 'image/jpeg');
  });
}


export function ChatProfileDialog({ chat, members, currentUser, open, onOpenChange, onCloseChat, onJoinDiscussion }: ChatProfileDialogProps) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const { experimentalDesign } = useTheme();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ownedGroups, setOwnedGroups] = useState<Chat[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isOwner = chat.ownerId === currentUser.uid;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null | undefined>(chat.avatar);
  const [imageToCrop, setImageToCrop] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);

  const form = useForm<z.infer<typeof chatEditSchema>>({
    resolver: zodResolver(chatEditSchema),
    defaultValues: {
        name: chat.name || '',
        description: chat.description || '',
        discussionChatId: chat.discussionChatId || '',
        avatar: chat.avatar || '',
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
            avatar: chat.avatar || '',
        });
        setAvatarPreview(chat.avatar);
        setImageToCrop('');
        setIsEditing(false); // Reset editing state when dialog opens
    }
  }, [chat, form, open]);
  
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
            variant: 'destructive',
            title: 'Image too large',
            description: 'Please select an image smaller than 2MB.',
        });
        return;
      }
      setCrop(undefined) // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImageToCrop(reader.result?.toString() || ''),
      )
      reader.readAsDataURL(file)
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1 / 1));
  }

  const handleCropConfirm = async () => {
    if (!completedCrop || !imgRef.current) {
        toast({ variant: 'destructive', title: 'Crop Error', description: 'Could not process the crop.' });
        return;
    }
    setIsCropping(true);
    try {
        const croppedImageUrl = await getCroppedImg(imgRef.current, completedCrop);
        setAvatarPreview(croppedImageUrl);
        form.setValue('avatar', croppedImageUrl, { shouldValidate: true });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Crop Error', description: 'An error occurred while cropping.' });
    } finally {
        setImageToCrop('');
        setIsCropping(false);
    }
  };


  const handleSaveChanges = async (values: z.infer<typeof chatEditSchema>) => {
    if (!db || !isOwner) return;
    setIsSaving(true);
    const chatRef = doc(db, 'chats', chat.id);
    const dataToUpdate: { [key: string]: any } = { 
        name: values.name,
        avatar: values.avatar,
    };

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

  const handleCopyLink = () => {
    if (chat.link) {
        navigator.clipboard.writeText(chat.link);
        toast({ title: t('copy_success_toast') });
    }
  }

  const Icon = chat.type === 'group' ? Users : Megaphone;
  
  const cropperContent = (
    <div className="p-6">
        <DialogHeader>
            <DialogTitle>Crop your new avatar</DialogTitle>
            <DialogDescription>Adjust the selection to crop your image. It will be a 1:1 square.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center my-4">
            <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                minWidth={100}
                minHeight={100}
            >
                <img
                    ref={imgRef}
                    alt="Crop me"
                    src={imageToCrop}
                    onLoad={onImageLoad}
                    style={{ maxHeight: '60vh' }}
                />
            </ReactCrop>
        </div>
        <DialogFooter>
            <Button variant="ghost" onClick={() => setImageToCrop('')}>Cancel</Button>
            <Button onClick={handleCropConfirm} disabled={isCropping}>
                {isCropping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crop & Save
            </Button>
        </DialogFooter>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-sm flex flex-col p-0 overflow-hidden max-h-[90vh]", experimentalDesign && !isEditing ? "rounded-[2rem] border-none" : "rounded-lg")}>
        {imageToCrop ? cropperContent : isEditing ? (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveChanges)} className="flex flex-col h-full overflow-hidden p-6">
                    <DialogHeader>
                        <DialogTitle>{t('edit_chat_title')}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto py-4">
                        <div className="space-y-4">
                            <div className="flex justify-center">
                              <div className="relative">
                                <button type="button" onClick={handleAvatarClick} className="rounded-full overflow-hidden">
                                    <Avatar className="h-24 w-24">
                                        <AvatarImage src={avatarPreview || undefined} />
                                        <AvatarFallback><Icon className="h-12 w-12" /></AvatarFallback>
                                    </Avatar>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAvatarClick}
                                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-background"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <FormControl>
                                  <Input
                                    type="file"
                                    accept="image/png, image/jpeg, image/gif"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                  />
                                </FormControl>
                              </div>
                            </div>
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
                    <DialogFooter className="mt-auto pt-4 border-t gap-2">
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
                <div className={cn(experimentalDesign && "bg-gradient-to-b from-primary/10 to-transparent pt-10 pb-6 px-6")}>
                    <DialogHeader className="p-0">
                        <DialogTitle className="sr-only">{chat.name}'s Profile</DialogTitle>
                        <div className='relative mx-auto flex justify-center'>
                            <Avatar className="w-32 h-32 text-4xl shadow-xl border-4 border-background rounded-full">
                            {chat.avatar ? (
                                    <AvatarImage src={chat.avatar} alt={chat.name} />
                            ) : (
                                    <AvatarFallback>
                                        <Icon className="h-16 w-16" />
                                    </AvatarFallback>
                            )}
                            </Avatar>
                        </div>
                    </DialogHeader>
                    <div className="text-center pt-4">
                        <div className="flex items-center justify-center gap-2">
                            <h2 className="text-2xl font-bold font-headline truncate max-w-[250px]">{chat.name}</h2>
                            {(chat.link === '/G/Infinite' || chat.link === '/C/Infinite') && <VerifiedBadge />}
                        </div>
                        <p className="text-muted-foreground font-medium">{chat.link}</p>
                    </div>

                    {experimentalDesign && (
                        <div className={cn("grid gap-3 w-full mt-6", chat.type === 'channel' ? "grid-cols-3" : "grid-cols-2")}>
                            {chat.type === 'channel' && (
                                <button 
                                    onClick={() => chat.discussionChatId && onJoinDiscussion?.(chat.discussionChatId)}
                                    disabled={!chat.discussionChatId}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm transition-all active:scale-95",
                                        !chat.discussionChatId ? "opacity-50 grayscale cursor-not-allowed" : "hover:shadow-md"
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                                        <MessageSquare className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-tight">{t('join_discussion_button')}</span>
                                </button>
                            )}
                            <button 
                                onClick={handleCopyLink}
                                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                <div className="w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center">
                                    <Share2 className="w-5 h-5 text-orange-500" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-tight text-orange-600">{t('copy_text')}</span>
                            </button>
                            <button 
                                onClick={() => setIsMuted(!isMuted)}
                                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isMuted ? "bg-red-500/15" : "bg-muted")}>
                                    {isMuted ? <BellOff className="w-5 h-5 text-red-500" /> : <Bell className="w-5 h-5 text-muted-foreground" />}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">{t('mute')}</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className={cn("flex-1 overflow-y-auto px-6 space-y-6", experimentalDesign ? "pb-8" : "py-4")}>
                    {chat.description && (
                        <div className="text-center p-4 bg-muted/50 rounded-2xl">
                            <p className="text-sm italic text-muted-foreground">"{chat.description}"</p>
                        </div>
                    )}

                    {(chat.type === 'group' || chat.type === 'channel') && (
                        <div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                                {t(chat.type === 'channel' ? 'subscribers_count' : 'members_count', { count: members.length })}
                            </h3>
                            <div className="space-y-3">
                                {members.slice(0, 10).map(member => (
                                    <div key={member.id} className="flex items-center gap-3">
                                        <UserAvatarWithStatus user={member} className="w-10 h-10" />
                                        <div className="flex-1 truncate">
                                            <p className="font-bold text-sm truncate">{member.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{member.username}</p>
                                        </div>
                                        {chat.ownerId === member.id && <Badge variant="secondary" className="text-[10px]">{t('owner')}</Badge>}
                                    </div>
                                ))}
                                {members.length > 10 && (
                                    <p className="text-xs text-center text-muted-foreground pt-2">
                                        And {members.length - 10} more...
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            
                <div className={cn('flex flex-col gap-2 px-6 pb-6 pt-4 border-t', experimentalDesign ? "bg-muted/30" : "mt-auto")}>
                    <div className="flex gap-2 w-full">
                        {isOwner && chat.id !== 'GENERAL_CHAT' && chat.type !== 'dm' && (
                            <Button variant="outline" onClick={() => setIsEditing(true)} className="flex-1 rounded-xl">
                                <Pencil className="mr-2 h-4 w-4" />
                                {t('edit')}
                            </Button>
                        )}

                        {chat.id !== 'GENERAL_CHAT' && (<>
                            {isOwner ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isDeleting} className="flex-1 rounded-xl">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            {isDeleting ? t('deleting') : t('delete')}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-2xl">
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t('delete_chat_confirm')}
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteChat} disabled={isDeleting} className="rounded-xl">
                                            {t('delete')}
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={isLeaving} className="flex-1 rounded-xl">
                                            <LogOut className="mr-2 h-4 w-4" />
                                            {isLeaving ? t('leaving') : t('leave')}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-2xl">
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t(chat.type === 'group' ? 'leave_group_confirm' : 'leave_channel_confirm')}
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleLeaveChat} disabled={isLeaving} className="rounded-xl">
                                            {t('leave')}
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </>)}
                    </div>
                </div>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}
