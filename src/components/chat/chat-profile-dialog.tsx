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
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Megaphone, Users, LogOut, Trash2, Pencil, Loader2, MessageSquare, Share2, Bell, BellOff, X, SmilePlus, ArrowLeft, Globe, Eraser } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, doc, updateDoc, arrayRemove, deleteDoc, query, where, getDocs, getDoc, writeBatch, deleteField } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { UserAvatarWithStatus } from './user-avatar-with-status';
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
import { COMMON_EMOJIS } from './chat-view';

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
  allowedReactions: z.array(z.string()).optional(),
});

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(makeAspectCrop({ unit: '%', width: 90, }, aspect, mediaWidth, mediaHeight), mediaWidth, mediaHeight);
}

async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, crop.width, crop.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas is empty')); return; }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    }, 'image/jpeg');
  });
}

export function ChatProfileDialog({ chat, members: initialMembers, currentUser, open, onOpenChange, onCloseChat, onJoinDiscussion }: ChatProfileDialogProps) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const { experimentalDesign } = useTheme();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ownedGroups, setOwnedGroups] = useState<Chat[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isOwner = chat.ownerId === currentUser.uid;
  const isAdmin = currentUser.username === '@Infinite';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null | undefined>(chat.avatar);
  const [imageToCrop, setImageToCrop] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const [showCompactHeader, setShowCompactHeader] = useState(false);

  const form = useForm<z.infer<typeof chatEditSchema>>({
    resolver: zodResolver(chatEditSchema),
    defaultValues: {
        name: chat.name || '',
        description: chat.description || '',
        discussionChatId: chat.discussionChatId || '',
        avatar: chat.avatar || '',
        allowedReactions: chat.allowedReactions || COMMON_EMOJIS,
    },
  });

  useEffect(() => {
    if (isEditing && chat.type === 'channel' && db) {
        const fetchOwnedGroups = async () => {
            setIsLoadingGroups(true);
            const q = query(collection(db, 'chats'), where('ownerId', '==', currentUser.uid), where('type', '==', 'group'));
            try { const snap = await getDocs(q); setOwnedGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat))); }
            catch (e) { toast({ variant: 'destructive', title: 'Error', description: "Could not load groups." }); }
            finally { setIsLoadingGroups(false); }
        };
        fetchOwnedGroups();
    }
  }, [isEditing, chat.type, db, currentUser.uid]);

  useEffect(() => {
    if (open) {
        form.reset({ name: chat.name || '', description: chat.description || '', discussionChatId: chat.discussionChatId || '', avatar: chat.avatar || '', allowedReactions: chat.allowedReactions || COMMON_EMOJIS, });
        setAvatarPreview(chat.avatar); setImageToCrop(''); setIsEditing(false); setShowCompactHeader(false);
    }
  }, [chat, form, open]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) { toast({ variant: 'destructive', title: 'Image too large', description: 'Limit is 2MB.' }); return; }
      setCrop(undefined); const reader = new FileReader(); reader.addEventListener('load', () => setImageToCrop(reader.result?.toString() || '')); reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = async () => {
    if (!completedCrop || !imgRef.current) return;
    setIsCropping(true);
    try { const cropped = await getCroppedImg(imgRef.current, completedCrop); setAvatarPreview(cropped); form.setValue('avatar', cropped, { shouldValidate: true }); }
    catch (e) { toast({ variant: 'destructive', title: 'Crop Error', description: 'Failed to crop.' }); }
    finally { setImageToCrop(''); setIsCropping(false); }
  };

  const handleSaveChanges = async (values: z.infer<typeof chatEditSchema>) => {
    if (!db || !isOwner) return;
    setIsSaving(true);
    const data: any = { name: values.name, avatar: values.avatar, allowedReactions: values.allowedReactions };
    if (chat.type === 'channel' || chat.type === 'group') { data.description = values.description; }
    if (chat.type === 'channel') { data.discussionChatId = values.discussionChatId === 'none' ? '' : values.discussionChatId; }
    try { await updateDoc(doc(db, 'chats', chat.id), data); toast({ title: t('dm_success'), description: t('chat_update_success') }); setIsEditing(false); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: t('chat_update_error')}); }
    finally { setIsSaving(false); }
  };

  const handleLeaveChat = async () => {
    if (!db) return;
    setIsLeaving(true);
    try { await updateDoc(doc(db, 'chats', chat.id), { members: arrayRemove(currentUser.uid) }); toast({ title: t('dm_success'), description: t('leave_chat_success')}); onOpenChange(false); onCloseChat(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: t('leave_chat_error')}); }
    finally { setIsLeaving(false); }
  };

  const handleDeleteChat = async () => {
    if (!db || (!isOwner && !isAdmin)) return;
    setIsDeleting(true);
    try { await deleteDoc(doc(db, 'chats', chat.id)); toast({ title: t('dm_success'), description: t('delete_chat_success')}); onOpenChange(false); onCloseChat(); }
    catch (e) { toast({ variant: 'destructive', title: 'Error', description: t('delete_chat_error')}); }
    finally { setIsDeleting(false); }
  }

  const handleClearHistory = async () => {
    if (!db || chat.id === 'GENERAL_CHAT') return;
    setIsClearing(true);
    try {
        const snap = await getDocs(collection(db, 'chats', chat.id, 'messages'));
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        await updateDoc(doc(db, 'chats', chat.id), { lastMessage: deleteField() });
        toast({ title: t('dm_success') });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to clear history.' });
    } finally {
        setIsClearing(false);
    }
  };

  const Icon = chat.id === 'GENERAL_CHAT' ? Globe : (chat.type === 'group' ? Users : Megaphone);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className={cn("max-w-sm flex flex-col p-0 overflow-hidden h-[85vh] h-full-safe max-h-[85vh] rounded-lg")}>
        {imageToCrop ? (
            <div className="p-6 h-full flex flex-col">
                <DialogHeader className="relative flex-row items-center justify-center p-4 border-b shrink-0 h-16">
                    <Button variant="ghost" size="icon" onClick={() => setImageToCrop('')} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button>
                    <DialogTitle>Crop your new avatar</DialogTitle>
                </DialogHeader>
                <div className="flex-1 flex items-center justify-center my-4 overflow-hidden"><ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={c => setCompletedCrop(c)} aspect={1} minWidth={100}><img ref={imgRef} src={imageToCrop} onLoad={e => setCrop(centerAspectCrop(e.currentTarget.width, e.currentTarget.height, 1))} className="max-h-full max-w-full" /></ReactCrop></div>
                <DialogFooter className="gap-2"><Button variant="ghost" onClick={() => setImageToCrop('')}>Cancel</Button><Button onClick={handleCropConfirm} disabled={isCropping}>{isCropping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Set Avatar</Button></DialogFooter>
            </div>
        ) : isEditing ? (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveChanges)} className="flex flex-col h-full overflow-hidden">
                    <DialogHeader className="relative flex-row items-center justify-center p-4 border-b shrink-0 h-16">
                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button>
                        <DialogTitle>{t('edit_chat_title')}</DialogTitle>
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2"><X /></Button>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6"><div className="space-y-6">
                            <div className="flex justify-center"><div className="relative">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full overflow-hidden"><Avatar className="h-24 w-24"><AvatarImage src={avatarPreview || undefined} /><AvatarFallback><Icon className="h-12 w-12" /></AvatarFallback></Avatar></button>
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-background"><Pencil className="h-4 w-4" /></button>
                                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                            </div></div>
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{chat.type === 'group' ? t('group_name_label') : t('channel_name_label')}</FormLabel><FormControl><Input {...field} className={cn(experimentalDesign && "glass-input")} /></FormControl><FormMessage /></FormItem>)} />
                            {(chat.type === 'channel' || chat.type === 'group') && (<FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>{t('description_label')}</FormLabel><FormControl><Textarea {...field} className={cn("resize-none", experimentalDesign && "glass-input")} /></FormControl><FormMessage /></FormItem>)} />)}
                            {chat.type === 'channel' && (<FormField control={form.control} name="discussionChatId" render={({ field }) => (<FormItem><FormLabel>{t('discussion_chat_label')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger disabled={isLoadingGroups} className={cn(experimentalDesign && "glass-input")}><SelectValue placeholder={t('select_discussion_chat_placeholder')} /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">{t('none_label')}</SelectItem>{ownedGroups.map(g => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />)}
                            <div className="space-y-3"><div className="flex items-center gap-2"><SmilePlus className="h-4 w-4 text-muted-foreground" /><FormLabel>{t('manage_reactions_label')}</FormLabel></div><div className="grid grid-cols-5 gap-2 p-3 bg-muted/30 rounded-xl border">{COMMON_EMOJIS.map(emoji => (<FormField key={emoji} control={form.control} name="allowedReactions" render={({ field }) => (<FormItem className="flex flex-col items-center gap-1 space-y-0"><FormControl><button type="button" onClick={() => { const cur = field.value || []; if (cur.includes(emoji)) { field.onChange(cur.filter(e => e !== emoji)); } else { field.onChange([...cur, emoji]); } }} className={cn("w-10 h-10 flex items-center justify-center text-xl rounded-lg transition-all", field.value?.includes(emoji) ? "bg-primary/20 border-primary" : "bg-background border border-border/50 opacity-50 grayscale hover:opacity-100 hover:grayscale-0")}>{emoji}</button></FormControl></FormItem>)} />))}</div></div>
                    </div></div>
                    <DialogFooter className="shrink-0 mt-auto p-6 border-t gap-2"><Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>{t('cancel')}</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('save')}</Button></DialogFooter>
                </form>
            </Form>
        ) : (
            <div className="flex flex-col h-full overflow-hidden relative">
                <div className={cn("absolute top-0 left-0 right-0 z-20 h-14 flex items-center px-4 transition-all duration-300 border-b", showCompactHeader ? "bg-background/95 backdrop-blur-md opacity-100" : "bg-transparent opacity-0 pointer-events-none border-transparent")}>
                    <div className="flex items-center gap-3 min-w-0 flex-1"><Avatar className="h-8 w-8 shrink-0">{chat.avatar ? <AvatarImage src={chat.avatar} /> : <AvatarFallback><Icon className="h-4 w-4" /></AvatarFallback>}</Avatar><span className="font-bold font-headline truncate">{chat.name}</span></div>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="shrink-0 ml-2"><X className="h-5 w-5" /></Button>
                </div>
                <ScrollArea className="flex-1" onScroll={e => setShowCompactHeader(e.currentTarget.scrollTop > 100)}>
                    <div className={cn(experimentalDesign && "bg-gradient-to-b from-primary/10 to-transparent pt-10 pb-6 px-6")}>
                        <DialogHeader className="p-0 relative">
                            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className={cn("absolute -top-6 left-0 z-10 rounded-full", showCompactHeader && "hidden")}><ArrowLeft className="h-5 w-5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className={cn("absolute -top-6 -right-2 z-10 rounded-full", showCompactHeader && "hidden")}><X className="h-5 w-5" /></Button>
                            <div className='relative mx-auto flex justify-center'><Avatar className="w-32 h-32 text-4xl shadow-xl border-4 border-background rounded-full">{chat.avatar ? (<AvatarImage src={chat.avatar} />) : (<AvatarFallback><Icon className="h-16 w-16" /></AvatarFallback>)}</Avatar></div>
                        </DialogHeader>
                        <div className="text-center pt-4"><div className="flex items-center justify-center gap-2"><h2 className="text-2xl font-bold font-headline truncate max-w-[250px]">{chat.name}</h2>{(chat.link === '/G/Infinite' || chat.link === '/C/Infinite') && <VerifiedBadge />}</div><p className="text-muted-foreground font-medium">{chat.link}</p></div>
                        <div className={cn("grid gap-3 w-full mt-6 px-6", chat.type === 'channel' ? "grid-cols-3" : "grid-cols-2")}>
                            {chat.type === 'channel' && (<button onClick={() => chat.discussionChatId && onJoinDiscussion?.(chat.discussionChatId)} disabled={!chat.discussionChatId} className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm transition-all active:scale-95", !chat.discussionChatId ? "opacity-50 grayscale cursor-not-allowed" : "hover:shadow-md")}><div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center"><MessageSquare className="w-5 h-5 text-blue-500" /></div><span className="text-[10px] font-bold uppercase tracking-tight">{t('join_discussion_button')}</span></button>)}
                            <button onClick={() => { if (chat.link) { navigator.clipboard.writeText(chat.link); toast({ title: t('copy_success_toast') }); } }} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"><div className="w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center"><Share2 className="w-5 h-5 text-orange-500" /></div><span className="text-[10px] font-bold uppercase tracking-tight text-orange-600">{t('copy_text')}</span></button>
                            <button onClick={() => setIsMuted(!isMuted)} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"><div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isMuted ? "bg-red-500/15" : "bg-muted")}>{isMuted ? <BellOff className="w-5 h-5 text-red-500" /> : <Bell className="h-5 w-5 text-muted-foreground" />}</div><span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">{t('mute')}</span></button>
                        </div>
                    </div>
                    <div className={cn("px-6 space-y-6", experimentalDesign ? "pb-8" : "py-4")}>
                        {chat.description && (<div className="text-center p-4 bg-muted/50 rounded-2xl"><p className="text-sm italic text-muted-foreground leading-relaxed">"{chat.description}"</p></div>)}
                    </div>
                </ScrollArea>
                <div className={cn('shrink-0 flex flex-col gap-2 px-6 pb-6 pt-4 border-t', experimentalDesign ? "bg-muted/30" : "bg-background")}>
                    {chat.id !== 'GENERAL_CHAT' && (<div className="flex gap-2 w-full">
                        {isOwner && chat.type !== 'dm' && (<Button variant="outline" onClick={() => setIsEditing(true)} className="flex-1 rounded-xl"><Pencil className="mr-2 h-4 w-4" />{t('edit')}</Button>)}
                        {(isOwner || isAdmin || chat.type === 'dm') && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={isClearing} className="flex-1 rounded-xl text-destructive border-destructive/20 hover:bg-destructive/5"><Eraser className="mr-3 h-4 w-4" />{isClearing ? t('loading') : t('clear_history')}</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                                  <AlertDialogDescription>{t('clear_history_confirm_desc')}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleClearHistory} disabled={isClearing} className="rounded-xl bg-destructive hover:bg-destructive/90">{t('ok')}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        )}
                        {isOwner || isAdmin ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeleting} className="flex-1 rounded-xl"><Trash2 className="mr-2 h-4 w-4" />{isDeleting ? t('deleting') : t('delete')}</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                                  <AlertDialogDescription>{t('delete_chat_confirm')}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDeleteChat} disabled={isDeleting} className="rounded-xl">{t('delete')}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isLeaving} className="flex-1 rounded-xl"><LogOut className="mr-2 h-4 w-4" />{isLeaving ? t('leaving') : t('leave')}</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                                  <AlertDialogDescription>{t(chat.type === 'group' ? 'leave_group_confirm' : 'leave_channel_confirm')}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleLeaveChat} disabled={isLeaving} className="rounded-xl">{t('leave')}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>)}
                </div>
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}