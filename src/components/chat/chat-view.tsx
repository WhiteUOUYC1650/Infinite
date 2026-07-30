'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat, Poll, CustomBot, MessageAttachment } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X, MoreVertical, Info, Trash2, Users, Megaphone, CheckCheck, Bookmark, Globe, Bot, Copy, Edit, Reply, Image as ImageIcon, Music as MusicIcon, Video as VideoIcon, Clock, Check, CheckCheck as CheckDouble, File as FileIcon, Mic, Camera, Pause, Play, ListTodo, Plus, CheckCircle2, Forward, Bell, BellOff, ThumbsUp, ChevronDown, ChevronUp, Smile, Radio, Eraser, LogOut, ChevronRight, LayoutGrid, MessageSquare, ArrowDown, Download, Trash, MoreHorizontal, Square } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, setDoc, arrayUnion, deleteDoc, serverTimestamp, orderBy, limit, arrayRemove, query, runTransaction, deleteField, getDoc, getDocs, writeBatch, increment } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { format, isSameDay, isYesterday } from 'date-fns';
import { useLanguage } from '@/context/language-context';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { UserProfileDialog } from '../user-profile-dialog';
import { ChatProfileDialog } from './chat-profile-dialog';
import { Capacitor } from '@capacitor/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '../ui/badge';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { VerifiedBadge } from '../ui/verified-badge';
import { useTheme } from '@/context/theme-context';
import { getCachedFile, cacheFile, fetchAndCacheImage } from '@/lib/cache-utils';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';

const iconMap = {
    Users,
    Megaphone,
    Bookmark,
    Globe,
    Bot,
};

export const COMMON_EMOJIS = [
    '👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '🙏', '👏', '🎉', '✨', 
    '🤔', '🤯', '🤩', '🥳', '🤮', '💩', '🤡', '👻', '👽', '👾', 
    '🤖', '🎃', '😺', '🤟', '🤘'
];

const STANDARD_COLORS: Record<string, string> = {
  '0': '#000000',
  '1': '#0000AA',
  '2': '#00AA00',
  '3': '#00AAAA',
  '4': '#AA0000',
  '5': '#AA00AA',
  '6': '#FFAA00',
  '7': '#AAAAAA',
  '8': '#555555',
  '9': '#5555FF',
  'a': '#55FF55',
  'b': '#55FFFF',
  'c': '#FF5555',
  'd': '#FF55FF',
  'e': '#FFFF55',
  'f': '#FFFFFF',
};

const ColoredText = ({ text }: { text: string }) => {
  const regex = /(§[0-9a-fA-F]|§\[[0-9a-fA-F]{3,6}\])/g;
  const parts = text.split(regex);
  if (parts.length === 1) return <>{text}</>;
  let currentColor: string | undefined = undefined;
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('§')) {
          if (part.startsWith('§[')) {
            const hex = part.slice(2, -1);
            currentColor = `#${hex}`;
          } else {
            const code = part[1].toLowerCase();
            currentColor = STANDARD_COLORS[code];
          }
          return null; 
        }
        return <span key={i} style={{ color: currentColor }}>{part}</span>;
      })}
    </>
  );
};

const processMarkdownChildren = (children: any): any => {
    return React.Children.map(children, child => {
        if (typeof child === 'string') return <ColoredText text={child} />;
        if (React.isValidElement(child) && child.props.children) {
            return React.cloneElement(child, { children: processMarkdownChildren(child.props.children) } as any);
        }
        return child;
    });
};

const getSafeDate = (ts: any): Date => { if (ts && typeof ts.seconds === 'number') { return new Date(ts.seconds * 1000); } return new Date(); };

function DateSeparator({ date, rawDate, experimentalDesign, glassEffect }: { date: string, rawDate: string, experimentalDesign: boolean, glassEffect: boolean }) {
  return (
    <div className="relative my-6 flex items-center justify-center date-separator-marker" data-date={date}>
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-muted-foreground/10" />
      </div>
      <div className={cn(
          "relative px-4 py-1 rounded-full border border-border/50 shadow-sm transition-all",
          (experimentalDesign || glassEffect) ? "glass-panel backdrop-blur-xl border-white/20" : "bg-muted/80"
      )}>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">{date}</span>
      </div>
    </div>
  );
}

function PollDisplay({ poll, onVote, currentUserId, alignRight }: { poll: Poll, onVote: (index: number) => void, currentUserId: string, alignRight: boolean }) {
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0); const { t } = useLanguage();
    return (
        <div className={cn("space-y-3 my-2 min-w-[240px]", alignRight ? "text-white" : "text-card-foreground")}>
            <div className="font-bold text-base flex items-center gap-2"><ListTodo className="h-5 w-5 shrink-0 text-primary" />{poll.question}</div>
            <div className="space-y-2">{poll.options.map((option, index) => {
                const isVoted = option.votes.includes(currentUserId); const percentage = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
                return (<button key={index} onClick={() => onVote(index)} className="w-full group/poll relative text-left"><div className="flex justify-between items-center mb-1 text-xs font-bold px-1"><div className="flex items-center gap-1.5 truncate mr-2">{isVoted && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}<span className="truncate">{option.text}</span></div><span className="shrink-0 opacity-70">{percentage}%</span></div><div className={cn("h-2 w-full rounded-full overflow-hidden", alignRight ? "bg-black/20" : "bg-muted")}><div className={cn("h-full transition-all duration-500 rounded-full", alignRight ? "bg-white" : "bg-primary")} style={{ width: `${percentage}%` }} /></div></button>);
            })}</div>
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-60 px-1"><span>{t('poll_vote_count', { count: totalVotes })}</span>{poll.isAnonymous ? <span className="flex items-center gap-1"><Info className="h-2.5 w-2.5" /> {t('poll_anonymous_label')}</span> : <span>{t('poll_view_results')}</span>}</div>
        </div>
    );
}

function NewPollDialog({ open, onOpenChange, onCreate }: { open: boolean, onOpenChange: (o: boolean) => void, onCreate: (p: Poll) => void }) {
    const { t } = useLanguage(); const [question, setQuestion] = useState(''); const [options, setOptions] = useState(['', '']); const [isAnonymous, setIsAnonymous] = useState(false); const [isMultipleChoice, setIsMultipleChoice] = useState(false);
    const handleAddOption = () => { if (options.length < 10) setOptions([...options, '']); };
    const handleRemoveOption = (idx: number) => { if (options.length > 2) setOptions(options.filter((_, i) => i !== idx)); };
    const handleOptionChange = (idx: number, val: string) => { const newOpts = [...options]; newOpts[idx] = val; setOptions(newOpts); };
    const handleSubmit = () => { if (!question.trim() || options.some(o => !o.trim())) return; onCreate({ question: question.trim(), options: options.map(o => ({ text: o.trim(), votes: [] })), isAnonymous, isMultipleChoice }); onOpenChange(false); setQuestion(''); setOptions(['', '']); };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-3xl p-6 overflow-hidden">
                <DialogHeader><DialogTitle className="text-xl font-bold font-headline">{t('create_poll')}</DialogTitle></DialogHeader>
                <ScrollArea className="max-h-[60vh] py-4 pr-4">
                    <div className="space-y-6">
                        <div className="space-y-2"><Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{t('poll_question_label')}</Label><Textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Напр. Куда пойдем сегодня?" className="rounded-xl h-12 bg-muted/50 border-none font-bold" /></div>
                        <div className="space-y-3"><Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Варианты ответа</Label>
                            {options.map((opt, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <Input value={opt} onChange={e => handleOptionChange(idx, e.target.value)} placeholder={`Вариант ${idx + 1}`} className="rounded-xl h-11 bg-muted/50 border-none font-medium" />
                                    {options.length > 2 && <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(idx)} className="h-11 w-11 text-destructive shrink-0"><Trash className="h-4 w-4" /></Button>}
                                </div>
                            ))}
                            {options.length < 10 && <Button variant="outline" onClick={handleAddOption} className="w-full h-11 rounded-xl border-dashed font-bold"><Plus className="h-4 w-4 mr-2" /> Добавить вариант</Button>}
                        </div>
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"><Label htmlFor="anon-poll" className="font-bold cursor-pointer">Анонимный опрос</Label><Checkbox id="anon-poll" checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} /></div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"><Label htmlFor="multi-poll" className="font-bold cursor-pointer">Несколько вариантов</Label><Checkbox id="multi-poll" checked={isMultipleChoice} onCheckedChange={(v) => setIsMultipleChoice(!!v)} /></div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">{t('cancel')}</Button><Button onClick={handleSubmit} disabled={!question.trim() || options.some(o => !o.trim())} className="rounded-xl font-bold px-8">Создать</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CustomAudioPlayer({ src, isMusic = false, duration, fileName, hideTime = false, messageId, onMediaLoad }: { src: string | null | undefined, isMusic?: boolean, duration?: number, fileName?: string, hideTime?: boolean, messageId: string, onMediaLoad?: () => void }) {
    const audioRef = useRef<HTMLAudioElement>(null); const [isPlaying, setIsPlaying] = useState(false); const [currentTime, setCurrentTime] = useState(0); const [maxTime, setMaxTime] = useState(duration || 0);
    useEffect(() => { if (audioRef.current && src) audioRef.current.load(); }, [src]);
    useEffect(() => { const handleStop = (e: any) => { if (e.detail?.id !== messageId && isPlaying) { audioRef.current?.pause(); setIsPlaying(false); } }; window.addEventListener('stop-media', handleStop); return () => window.removeEventListener('stop-media', handleStop); }, [isPlaying, messageId]);
    const togglePlay = (e: React.MouseEvent) => { e.stopPropagation(); if (audioRef.current && src) { if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } else { window.dispatchEvent(new CustomEvent('stop-media', { detail: { id: messageId } })); audioRef.current.play(); setIsPlaying(true); } } };
    const onTimeUpdate = () => { if (audioRef.current) { setCurrentTime(audioRef.current.currentTime); const d = audioRef.current.duration; if (d && isFinite(d)) setMaxTime(d); } };
    const formatTime = (t: number) => { if (typeof t !== 'number' || isNaN(t) || !isFinite(t)) return "0:00"; const m = Math.floor(t / 60); const s = Math.floor(t % 60); return `${m}:${s.toString().padStart(2, '0')}`; };
    if (!src) return null;
    return (<div className={cn("flex items-center gap-3 w-full px-2 py-1.5 rounded-xl transition-all", isMusic ? "max-w-[400px]" : "min-w-[200px]", "bg-black/10 dark:bg-white/10")}><audio ref={audioRef} src={src} onTimeUpdate={onTimeUpdate} onEnded={() => setIsPlaying(false)} onLoadedMetadata={() => { onTimeUpdate(); onMediaLoad?.(); }} preload="metadata" /><button onClick={togglePlay} className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm shrink-0 transition-transform active:scale-95">{isPlaying ? <Pause className="h-5 w-5 text-primary fill-primary" /> : <Play className="h-5 w-5 ml-0.5 text-primary fill-primary" />}</button><div className="flex-1 min-w-0 flex flex-col justify-center">{isMusic && fileName && <div className="text-[10px] font-bold truncate mb-0.5 opacity-80">{fileName}</div>}<div className="relative h-1.5 w-full bg-white/20 rounded-full overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); if (audioRef.current && maxTime) { const rect = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * maxTime; } }}><div className="absolute h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${(currentTime / (maxTime || 1)) * 100}%` }} /></div>{!hideTime && <div className="flex justify-between items-center text-[9px] font-bold mt-1 opacity-70"><span>{formatTime(currentTime)} / {formatTime(maxTime)}</span></div>}</div></div>);
}

const AttachmentRenderer = ({ attachment, onPreviewImage, onMediaLoad }: { attachment: MessageAttachment, onPreviewImage: (url: string) => void, onMediaLoad: () => void }) => {
    const db = useFirestore(); const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    useEffect(() => {
        const load = async () => {
            const cacheId = `att-${attachment.id}`; const cached = await getCachedFile(cacheId);
            if (cached) { setMediaUrl(cached); onMediaLoad(); return; }
            if (attachment.url) { const url = await fetchAndCacheImage(cacheId, attachment.url); setMediaUrl(url); onMediaLoad(); } 
            else if (attachment.chunkIds && db) {
                try {
                    const colMap = { video: 'videoChunks', music: 'musicChunks', file: 'fileChunks', image: 'fileChunks' };
                    const col = colMap[attachment.type as keyof typeof colMap] || 'fileChunks';
                    const chunkSnaps = await Promise.all(attachment.chunkIds.map(id => getDoc(doc(db, col, id))));
                    const chunksData = chunkSnaps.filter(s => s.exists()).map(s => s.data() as { part: number, data: string });
                    chunksData.sort((a, b) => a.part - b.part); const assembled = chunksData.map(c => c.data).join('');
                    const dataUrl = `data:${attachment.fileMimeType || 'application/octet-stream'};base64,${assembled}`;
                    await cacheFile(cacheId, dataUrl); const finalUrl = await getCachedFile(cacheId);
                    setMediaUrl(finalUrl); onMediaLoad();
                } catch (e) { console.error("Attachment load failed", e); }
            }
        };
        load();
    }, [attachment, db, onMediaLoad]);
    if (!mediaUrl && attachment.type !== 'file') return <div className="h-20 w-full flex items-center justify-center bg-muted animate-pulse rounded-lg"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    switch (attachment.type) {
        case 'image': return <img src={mediaUrl!} onClick={() => onPreviewImage(mediaUrl!)} className="max-w-full max-h-[320px] w-auto object-contain rounded-lg cursor-pointer my-1" onLoad={onMediaLoad} alt="Attachment" />;
        case 'video': return <video src={mediaUrl!} controls className="max-full rounded-lg my-1" onLoadedData={onMediaLoad} />;
        case 'music': return <div className="my-1"><CustomAudioPlayer src={mediaUrl!} isMusic={true} fileName={attachment.fileName} messageId={attachment.id} onMediaLoad={onMediaLoad} /></div>;
        case 'file': return (<div className="flex items-center gap-2 p-2 bg-black/10 dark:bg-white/10 rounded-lg my-1"><FileIcon className="h-5 w-5 text-primary shrink-0" /><div className="min-w-0 flex-1"><p className="text-xs font-bold truncate">{attachment.fileName}</p><p className="text-[9px] opacity-60 uppercase">File</p></div>{mediaUrl && <a href={mediaUrl} download={attachment.fileName} className="p-1.5 hover:bg-black/5 rounded-full"><Download className="h-4 w-4" /></a>}</div>);
        default: return null;
    }
};

const ChatMessage = React.memo(({ message, sender, isCurrentUser, chatType, onAvatarClick, chat, currentUser, onReply, setEditingMessage, onMediaLoad, onPreviewImage, onForward, onVote, onDelete, onToggleReaction, isMobile, isActiveOnMobile, onToggleActiveOnMobile, experimentalDesign, glassEffect }: { message: Message, sender?: User, isCurrentUser: boolean, chatType: PopulatedChat['type'], onAvatarClick: (user: User) => void, chat: PopulatedChat, currentUser: AuthenticatedUser, onReply: (message: Message) => void, setEditingMessage: (message: Message | null) => void, onMediaLoad: () => void; onPreviewImage: (url: string) => void; onForward: (message: Message) => void; onVote: (index: number) => void; onDelete: (id: string) => void; onToggleReaction: (msgId: string, emoji: string) => void; isMobile: boolean; isActiveOnMobile?: boolean; onToggleActiveOnMobile?: () => void; experimentalDesign: boolean; glassEffect: boolean }) => {
    const { t } = useLanguage(); const db = useFirestore(); 
    const isChannelPost = !!message.fromChannelId;
    const alignRight = !isChannelPost && isCurrentUser && message.type !== 'announcement' && chatType !== 'channel';
    const isOfficialBotChat = chat.link === '/B/Infinite' || chat.name === 'Infinite';
    const showSenderAvatar = isChannelPost || (chatType !== 'channel' && !isOfficialBotChat && ((chatType === 'group' && !isCurrentUser) || (message.type === 'announcement' && chatType !== 'dm')));
    const [mediaUrl, setMediaUrl] = useState<string | null>(null); const circleVideoRef = useRef<HTMLVideoElement>(null); const [hasUnmutedCircle, setHasUnmutedCircle] = useState(false);
    const isCircleComplete = message.circleStatus === 'complete';
    const isRead = useMemo(() => { if (!isCurrentUser || !message.readBy) return false; if (chatType === 'dm') { const otherId = chat.members.find(id => id !== currentUser.uid); return otherId ? message.readBy.includes(otherId) : false; } return message.readBy.some(id => id !== currentUser.uid); }, [isCurrentUser, message.readBy, chat.members, chatType, currentUser.uid]);
    
    useEffect(() => { 
        const loadMedia = async () => { 
            const cached = await getCachedFile(message.id); 
            if (cached) { setMediaUrl(cached); onMediaLoad(); return; } 
            if (message.imageUrl) { 
                const url = await fetchAndCacheImage(message.id, message.imageUrl); 
                if (url) { setMediaUrl(url); onMediaLoad(); } 
                return; 
            } 
            if (!db) return; 
            if (message.videoStatus === 'complete' || message.musicStatus === 'complete' || message.voiceStatus === 'complete' || message.circleStatus === 'complete' || message.fileStatus === 'complete') { 
                try { 
                    const col = message.videoStatus === 'complete' ? 'videoChunks' : message.musicStatus === 'complete' ? 'musicChunks' : message.voiceStatus === 'complete' ? 'voiceChunks' : message.circleStatus === 'complete' ? 'circleChunks' : 'fileChunks'; 
                    const chunkIds = message.videoChunkIds || message.musicChunkIds || message.voiceChunkIds || message.circleChunkIds || message.fileChunkIds || []; 
                    const chunkSnaps = await Promise.all(chunkIds.map(id => getDoc(doc(db, col, id)))); 
                    const chunksData = chunkSnaps.filter(s => s.exists()).map(s => s.data() as { part: number, data: string }); 
                    chunksData.sort((a, b) => a.part - b.part); 
                    const assembled = chunksData.map(c => c.data).join(''); 
                    const mime = message.videoMimeType || message.musicMimeType || message.voiceMimeType || message.circleMimeType || message.fileMimeType || 'application/octet-stream'; 
                    const dataUrl = `data:${mime};base64,${assembled}`; 
                    await cacheFile(message.id, dataUrl); 
                    const finalUrl = await getCachedFile(message.id); 
                    if (finalUrl) { setMediaUrl(finalUrl); onMediaLoad(); } 
                } catch (e) { console.error("Media failed", e); } 
            } 
        }; 
        loadMedia(); 
    }, [message.id, db, message.videoStatus, message.musicStatus, message.voiceStatus, message.circleStatus, message.fileStatus, message.imageUrl, onMediaLoad, message.videoMimeType, message.musicMimeType, message.voiceMimeType, message.circleMimeType, message.fileMimeType]);

    const handleSaveToDevice = async () => { if (!mediaUrl) return; const fileName = message.fileName || `Infinite_${message.id}.${(message.imageUrl ? 'jpg' : (message.videoMimeType?.split('/')[1] || 'bin'))}`; if (Capacitor.isNativePlatform()) { try { const { Filesystem, Directory } = await import('@capacitor/filesystem'); const cleanBase64 = mediaUrl.includes(',') ? mediaUrl.split(',')[1] : mediaUrl; try { await Filesystem.mkdir({ path: 'Infinite', directory: Directory.Documents, recursive: true }); } catch (e) {} await Filesystem.writeFile({ path: `Infinite/${fileName}`, data: cleanBase64, directory: Directory.Documents, }); toast({ title: t('dm_success'), description: `Saved to Documents/Infinite/${fileName}` }); } catch (e) { console.error(e); } } else { const link = document.createElement('a'); link.href = mediaUrl; link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); } };
    const handleCircleClick = (e: React.MouseEvent) => { e.stopPropagation(); if (circleVideoRef.current) { window.dispatchEvent(new CustomEvent('stop-media', { detail: { id: message.id } })); circleVideoRef.current.currentTime = 0; if (!hasUnmutedCircle) { circleVideoRef.current.muted = false; setHasUnmutedCircle(true); } circleVideoRef.current.play(); } };
    const canCopy = message.content && !message.poll; const isAdmin = currentUser.username === '@Infinite'; const canDelete = isAdmin || (sender?.username !== '@Infinite' && (isCurrentUser || chat.ownerId === currentUser.uid || chat.type === 'dm'));
    const isLikedByMe = (emoji: string) => message.reactions?.[emoji]?.includes(currentUser.uid);
    const hasAttachments = !!(message.imageUrl || message.videoStatus === 'complete' || message.musicStatus === 'complete' || message.fileStatus === 'complete' || (message.attachments && message.attachments.length > 0));
    const canSave = hasAttachments && !message.voiceStatus && !message.circleStatus;
    const displayName = isChannelPost ? message.senderName : (message.type === 'announcement' ? (message.senderName || 'Infinite') : (sender?.isDeleted ? t('deleted_account') : sender?.name));
    const displayAvatar = isChannelPost ? message.senderAvatar : (message.type === 'announcement' ? message.senderAvatar : sender?.avatar);
    
    return (
        <div id={`message-${message.id}`} className={cn("group flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300", alignRight ? "flex-row-reverse outgoing-msg" : "flex-row incoming-msg")} onClick={() => isMobile && onToggleActiveOnMobile?.()}>
            {showSenderAvatar ? (
                <div className="w-10 h-10 flex-shrink-0">
                    <button onClick={() => !isChannelPost && sender && onAvatarClick(sender)} disabled={isCurrentUser || isChannelPost || (sender && !!sender.isDeleted)}><UserAvatarWithStatus user={isChannelPost ? ({ id: 'channel', name: displayName, avatar: displayAvatar } as any) : (message.type === 'announcement' ? { id: 'bot', name: displayName, avatar: displayAvatar, isBot: true } as any : sender!)} /></button>
                </div>
            ) : (chatType === 'group' && !alignRight && !isOfficialBotChat) ? <div className="w-10 flex-shrink-0" /> : null}
            <div className={cn("min-w-0 flex flex-col relative transition-all duration-300", isCircleComplete ? "bg-transparent shadow-none p-0" : (alignRight ? "bg-primary text-primary-foreground shadow-sm" : "bg-card text-card-foreground shadow-sm"), isCircleComplete ? "rounded-full" : (alignRight ? "rounded-lg rounded-br-none" : "rounded-lg rounded-bl-none"), !isCircleComplete && "px-2 pb-1 pt-1.5", "max-w-[85%] md:max-w-[70%]", glassEffect && "glass-msg", glassEffect && alignRight && "align-right")}>
                {isChannelPost && <div className="absolute -top-3 -right-1 z-10 flex items-center bg-background/50 backdrop-blur-md px-1.5 rounded-full border border-primary/20 shadow-sm pointer-events-none"><span className="text-[8px] font-black uppercase tracking-tighter text-primary/80">{t('channel_badge')}</span></div>}
                {(isChannelPost || (chatType === 'group' && !isCurrentUser) || chatType === 'channel' || message.type === 'announcement') && !isCircleComplete && (<div className="font-bold text-[13px] flex items-center gap-2 mb-0.5 px-0.5"><span className="truncate">{displayName}</span>{(isChannelPost && chat.link === '/C/Infinite') && <VerifiedBadge className='w-3 h-3' />}{(!isChannelPost && sender?.username === '@InfiniteBot') && <VerifiedBadge className='w-3 h-3' />}</div>)}
                {message.replyTo && !isCircleComplete && (<div onClick={(e) => { e.stopPropagation(); document.getElementById(`message-${message.replyTo!.messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className={cn("mb-1.5 p-1.5 border-l-4 rounded-r-md cursor-pointer transition-colors max-w-full overflow-hidden flex flex-col", alignRight ? "bg-black/10 border-white/50 hover:bg-black/20" : "bg-primary/5 border-primary hover:bg-primary/10")}><p className={cn("text-[11px] font-bold truncate", alignRight ? "text-white" : "text-primary")}>{message.replyTo.senderName}</p><p className={cn("text-[11px] truncate line-clamp-1 opacity-80 italic", alignRight ? "text-white" : "text-muted-foreground")}>{message.replyTo.content}</p></div>)}
                {message.imageUrl && !isCircleComplete && (<div className={cn("w-full flex mb-1", alignRight ? "justify-end" : "justify-start")}><img src={message.imageUrl} onClick={() => onPreviewImage(message.imageUrl!)} className="max-w-full max-h-[320px] w-auto object-contain rounded-lg cursor-pointer" onLoad={onMediaLoad} alt="Message" /></div>)}
                {message.videoStatus === 'complete' && mediaUrl && !isCircleComplete && (<div className="pt-1"><video src={message.videoMimeType && message.videoMimeType.includes('mp4') ? `${mediaUrl}#t=0.1` : mediaUrl} controls className="max-full rounded-lg" onLoadedData={onMediaLoad} /></div>)}
                {(message.musicStatus === 'complete' || message.voiceStatus === 'complete') && mediaUrl && !isCircleComplete && (<div className="pt-1"><CustomAudioPlayer src={mediaUrl} isMusic={!!message.musicStatus} fileName={message.fileName} messageId={message.id} onMediaLoad={onMediaLoad} /></div>)}
                {message.fileStatus === 'complete' && mediaUrl && !isCircleComplete && (<AttachmentRenderer attachment={{ id: message.id, type: 'file', fileName: message.fileName, fileMimeType: message.fileMimeType, chunkIds: message.fileChunkIds }} onPreviewImage={onPreviewImage} onMediaLoad={onMediaLoad} />)}
                {message.attachments && message.attachments.length > 0 && (<div className="flex flex-col gap-1 w-full mb-1">{message.attachments.map(att => (<AttachmentRenderer key={att.id} attachment={att} onPreviewImage={onPreviewImage} onMediaLoad={onMediaLoad} />))}</div>)}
                {isCircleComplete && mediaUrl && (<div className={cn("rounded-full overflow-hidden bg-black aspect-square shrink-0 cursor-pointer w-48 h-48")} onClick={handleCircleClick}><video ref={circleVideoRef} src={mediaUrl} loop muted playsInline className="w-full h-full object-cover" onLoadedData={onMediaLoad} /></div>)}
                {message.poll && !isCircleComplete && <PollDisplay poll={message.poll} onVote={onVote} currentUserId={currentUser.uid} alignRight={alignRight} />}
                {message.content && !message.poll && !isCircleComplete && (<div className={cn("text-sm break-words whitespace-pre-wrap pt-0 px-0.5")}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({node, ...p}) => <a className={cn("underline font-bold", alignRight ? "text-white" : "text-primary")} target="_blank" href={p.href}>{p.children}</a>, p: ({children}) => <p>{processMarkdownChildren(children)}</p>, li: ({children}) => <li>{processMarkdownChildren(children)}</li>, h1: ({children}) => <h1 className="text-xl font-bold">{processMarkdownChildren(children)}</h1>, h2: ({children}) => <h2 className="text-lg font-bold">{processMarkdownChildren(children)}</h2>, h3: ({children}) => <h3 className="text-base font-bold">{processMarkdownChildren(children)}</h3>, }}>{message.content}</ReactMarkdown></div>)}
                {chatType === 'channel' && chat.discussionChatId && !isCircleComplete && (<button onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('open-chat', { detail: { chatId: chat.discussionChatId } })); }} className={cn("mt-2 mb-1 flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-xl transition-all active:scale-95 w-fit border border-transparent shadow-sm", alignRight ? "bg-white/20 text-white hover:bg-white/30" : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/5")}><MessageSquare className="h-3.5 w-3.5" />{t('comments')}</button>)}
                {message.reactions && Object.keys(message.reactions).length > 0 && !isCircleComplete && (<div className={cn("flex flex-wrap gap-1.5 mt-2", alignRight ? "justify-end" : "justify-start")}>{Object.entries(message.reactions).map(([emoji, uids]) => { if (uids.length === 0) return null; const hasReacted = uids.includes(currentUser.uid); return (<button key={emoji} onClick={(e) => { e.stopPropagation(); onToggleReaction(message.id, emoji); }} className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-black border transition-all active:scale-90", hasReacted ? "bg-white/20 border-white/50 text-white" : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted", alignRight && "text-white border-white/30")}><span>{emoji}</span><span className={cn(alignRight && "text-white")}>{uids.length}</span></button>); })}</div>)}
                {!isCircleComplete && (<div className={cn("flex items-center gap-1 mt-0.5 text-[9px] self-end opacity-70")}>{message.editedAt && <span className="font-bold">{t('edited')}</span>}<span>{format(getSafeDate(message.timestamp), 'HH:mm')}</span>{isCurrentUser && !isChannelPost && (<span className="ml-0.5">{isRead ? <CheckDouble className="h-3 w-3" /> : <Check className="h-2.5 w-2.5" />}</span>)}</div>)}
            </div>
            <div className={cn("flex-shrink-0 self-center w-8 flex justify-center transition-all", isMobile ? (isActiveOnMobile ? "opacity-100" : "opacity-0 pointer-events-none") : "opacity-0 group-hover:opacity-100", !alignRight && "order-last")}>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align={alignRight ? 'end' : 'start'} collisionPadding={16} className={cn("p-1 shadow-2xl border-none z-[100] max-h-[85vh]", (experimentalDesign || glassEffect) ? "glass-menu flex flex-row gap-1 w-auto" : "bg-popover rounded-xl flex flex-col w-56")}>
                        {(experimentalDesign || glassEffect) ? (
                            <>
                                <div className="grid grid-cols-5 gap-1 p-2 bg-muted/20 rounded-2xl border border-white/5 shrink-0 w-[180px]">
                                    {COMMON_EMOJIS.map(emoji => { const sel = isLikedByMe(emoji); return (<button key={emoji} onClick={() => onToggleReaction(message.id, emoji)} className={cn("h-8 w-8 flex items-center justify-center transition-all active:scale-150 hover:bg-primary/20 rounded-lg text-lg", sel && "bg-primary/30 scale-110")}>{emoji}</button>); })}
                                </div>
                                <div className="w-[180px] flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between px-3 h-10 bg-primary text-white rounded-xl mb-1 font-bold text-sm shining-gold-element"><div className="flex items-center gap-2"><Smile className="h-4 w-4" />{t('reactions')}</div><ChevronRight className="h-4 w-4" /></div>
                                    <DropdownMenuItem onSelect={() => onReply(message)} className="h-10 rounded-xl px-3 focus:bg-primary/10 font-bold"><Reply className="mr-3 h-4 w-4 text-primary" />{t('reply')}</DropdownMenuItem>
                                    {canCopy && <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(message.content); toast({ title: t('copy_success_toast') }); }} className="h-10 rounded-xl px-3 focus:bg-primary/10 font-bold"><Copy className="mr-3 h-4 w-4 text-primary" />{t('copy_text')}</DropdownMenuItem>}
                                    {canSave && <DropdownMenuItem onSelect={handleSaveToDevice} className="h-10 rounded-xl px-3 focus:bg-primary/10 font-bold"><Download className="mr-3 h-4 w-4 text-primary" />{t('save_to_device')}</DropdownMenuItem>}
                                    <DropdownMenuItem onSelect={() => onForward(message)} className="h-10 rounded-xl px-3 focus:bg-primary/10 font-bold"><Forward className="mr-3 h-4 w-4 text-primary" />{t('forward')}</DropdownMenuItem>
                                    {canDelete && <DropdownMenuItem onSelect={() => onDelete(message.id)} className="text-destructive h-10 rounded-xl px-3 focus:bg-destructive/10 font-bold"><Trash2 className="mr-3 h-4 w-4" />{t('delete_message')}</DropdownMenuItem>}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="px-2 py-2 mb-1 flex flex-wrap items-center gap-1 bg-muted/40 rounded-lg border border-border/20 shadow-inner max-h-[120px] overflow-y-auto no-scrollbar">{COMMON_EMOJIS.map(emoji => { const sel = isLikedByMe(emoji); return (<button key={emoji} onClick={() => onToggleReaction(message.id, emoji)} className={cn("h-7 w-7 flex items-center justify-center rounded-md text-base", sel && "bg-primary/20")}>{emoji}</button>); })}</div>
                                <DropdownMenuItem onSelect={() => onReply(message)}><Reply className="mr-2 h-4 w-4" />{t('reply')}</DropdownMenuItem>
                                {canCopy && <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(message.content); toast({ title: t('copy_success_toast') }); }}><Copy className="mr-2 h-4 w-4" />{t('copy_text')}</DropdownMenuItem>}
                                {canSave && <DropdownMenuItem onSelect={handleSaveToDevice}><Download className="mr-2 h-4 w-4" />{t('save_to_device')}</DropdownMenuItem>}
                                <DropdownMenuItem onSelect={() => onForward(message)}><Forward className="mr-2 h-4 w-4" />{t('forward')}</DropdownMenuItem>
                                {canDelete && <DropdownMenuItem onSelect={() => onDelete(message.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />{t('delete_message')}</DropdownMenuItem>}
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
});
ChatMessage.displayName = 'ChatMessage';

export function ChatView({ item: initialItem, onClose, currentUser, onSelectChat }: { item: PopulatedChat, onClose: () => void, currentUser: AuthenticatedUser, onSelectChat: (chat: PopulatedChat) => void }) {
  const db = useFirestore(); const { t } = useLanguage(); const { toast } = useToast(); const { theme: colorTheme, sendOnEnter, smoothScroll, experimentalDesign, glassEffect } = useTheme(); 
  const isMobile = useIsMobile();
  const isPrem = currentUser.subscriptionTier === 'prem'; const maxSizeText = isPrem ? '4GB' : '1GB'; const maxSizeInBytes = isPrem ? 4 * 1024 * 1024 * 1024 : 1 * 1024 * 1024 * 1024;
  const [messageContent, setMessageContent] = useState(''); const [isSending, setIsSending] = useState(false); const [profileDialogUser, setProfileDialogUser] = useState<User | null>(null); const [showChatProfile, setShowChatProfile] = useState(false); const [replyToMessage, setReplyToMessage] = useState<Message | null>(null); const [editingMessage, setEditingMessage] = useState<Message | null>(null); 
  const [filesToSend, setFilesToSend] = useState<Array<{file: File, previewUrl: string, type: 'image' | 'video' | 'music' | 'file'}>>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null); const [activeMessageId, setActiveMessageId] = useState<string | null>(null); const [messageLimit, setMessageLimit] = useState(50); const [hasMore, setHasMore] = useState(true); const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); const listInnerRef = useRef<HTMLDivElement>(null); const fileInputRef = useRef<HTMLInputElement>(null); const prevScrollHeightRef = useRef<number>(0); const isAtBottomRef = useRef(true); const autoScrollGuardRef = useRef<number>(0); const [stickyDate, setStickyDate] = useState<string | null>(null); const [showStickyDate, setShowStickyDate] = useState(false); const stickyHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false); const [showNewPoll, setShowNewPoll] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false); const [isRecordingCircle, setIsRecordingCircle] = useState(false); const [isRecordingLocked, setIsRecordingLocked] = useState(false); const [recordingDuration, setRecordingDuration] = useState(0); const mediaRecorderRef = useRef<MediaRecorder | null>(null); const chunksRef = useRef<Blob[]>([]); const timerRef = useRef<NodeJS.Timeout | null>(null); const activeStreamRef = useRef<MediaStream | null>(null);
  const isRecordingCanceledRef = useRef(false); const [isMutedLocal, setIsMutedLocal] = useState(false);

  const isMember = useMemo(() => initialItem?.members?.includes(currentUser.uid!) ?? false, [initialItem?.members, currentUser.uid]);
  const chatDocRef = useMemoFirebase(() => db ? doc(db, 'chats', initialItem.id) : null, [db, initialItem.id]); const { data: liveChatData } = useDoc<Chat>(chatDocRef); const item = useMemo(() => { if (!liveChatData) return initialItem; return { ...initialItem, ...liveChatData }; }, [initialItem, liveChatData]);
  const messagesQuery = useMemoFirebase(() => { if (!db || !isMember) return null; return query(collection(db, 'chats', item.id, 'messages'), orderBy('timestamp', 'desc'), limit(messageLimit)); }, [db, item.id, isMember, messageLimit]); const { data: rawMessages, loading: messagesLoading } = useCollection<Message>(messagesQuery); const messages = useMemo(() => rawMessages ? [...rawMessages].reverse() : null, [rawMessages]);
  const allUserIds = useMemo(() => { const ids = new Set<string>(item.members || []); messages?.forEach(m => ids.add(m.senderId)); return Array.from(ids); }, [item.members, messages]); const { users: memberDetails } = useBatchUsers(allUserIds);
  
  const scrollToBottom = useCallback((b: ScrollBehavior = 'auto') => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight; }, []);
  const handleScroll = useCallback(() => { if (!scrollContainerRef.current) return; const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current; const atBottom = scrollHeight - scrollTop - clientHeight < 300; isAtBottomRef.current = atBottom; if (!atBottom && Date.now() - autoScrollGuardRef.current > 10000) autoScrollGuardRef.current = 0; if (scrollTop < 50 && hasMore && !messagesLoading && messages && messages.length >= messageLimit) { prevScrollHeightRef.current = scrollHeight; setMessageLimit(p => p + 50); } setShowStickyDate(true); if (stickyHideTimeoutRef.current) clearTimeout(stickyHideTimeoutRef.current); stickyHideTimeoutRef.current = setTimeout(() => setShowStickyDate(false), 1000); const markers = scrollContainerRef.current.querySelectorAll('.date-separator-marker'); let currentTopDate = null; markers.forEach((marker: any) => { if (marker.offsetTop <= scrollTop + 100) { currentTopDate = marker.getAttribute('data-date'); } }); setStickyDate(currentTopDate); setShowScrollDown(!atBottom); }, [hasMore, messagesLoading, messages, messageLimit]);
  
  useEffect(() => { const ro = new ResizeObserver(() => { if (isAtBottomRef.current || (Date.now() - autoScrollGuardRef.current < 10000)) requestAnimationFrame(() => { scrollToBottom(); setTimeout(scrollToBottom, 50); }); }); if (listInnerRef.current) ro.observe(listInnerRef.current); return () => ro.disconnect(); }, [scrollToBottom]);
  useEffect(() => { if (prevScrollHeightRef.current > 0 && scrollContainerRef.current) { scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - prevScrollHeightRef.current; prevScrollHeightRef.current = 0; } else if (isAtBottomRef.current) { autoScrollGuardRef.current = Date.now(); scrollToBottom(smoothScroll ? 'smooth' : 'auto'); } }, [messages, smoothScroll, scrollToBottom]);
  useEffect(() => { autoScrollGuardRef.current = Date.now(); scrollToBottom(); }, [item.id, scrollToBottom]);
  
  useEffect(() => { const handleSystemBack = () => { if (previewImage) setPreviewImage(null); else if (showChatProfile) setShowChatProfile(false); else if (profileDialogUser) setProfileDialogUser(null); else if (showNewPoll) setShowNewPoll(false); else if (replyToMessage) setReplyToMessage(null); else if (filesToSend.length > 0) setFilesToSend([]); else if (isRecordingVoice || isRecordingCircle) stopRecording(true); else onClose(); }; let backListener: any; if (Capacitor.isNativePlatform()) { import('@capacitor/app').then(({ App }) => { backListener = App.addListener('backButton', handleSystemBack); }); } return () => { if (backListener) { backListener.then((l: any) => l.remove()); } }; }, [onClose, previewImage, showChatProfile, profileDialogUser, showNewPoll, replyToMessage, filesToSend.length, isRecordingVoice, isRecordingCircle]);
  
  const startRecording = async (type: 'voice' | 'circle') => {
    try {
      const constraints = { audio: true, video: type === 'circle' ? { facingMode: 'user' as const, width: 480, height: 480 } : false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints); activeStreamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: type === 'circle' ? 'video/webm' : 'audio/webm' }); mediaRecorderRef.current = mr;
      chunksRef.current = []; isRecordingCanceledRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0 && !isRecordingCanceledRef.current) { chunksRef.current.push(e.data); } };
      mr.onstop = async () => { 
          if (!isRecordingCanceledRef.current && chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: mr.mimeType }); 
            if (blob.size > 500) handleSendMediaMessage(blob, type); 
          }
          stream.getTracks().forEach(t => t.stop()); activeStreamRef.current = null;
      };
      mr.start(500); if (type === 'voice') setIsRecordingVoice(true); else setIsRecordingCircle(true); 
      setRecordingDuration(0); setIsRecordingLocked(false); timerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (e) { console.error(e); toast({ variant: 'destructive', title: t('microphone_error_title'), description: t('microphone_error_desc') }); }
  };
  const stopRecording = (canceled: boolean) => { if (timerRef.current) clearInterval(timerRef.current); isRecordingCanceledRef.current = canceled; if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { mediaRecorderRef.current.stop(); } setIsRecordingVoice(false); setIsRecordingCircle(false); setIsRecordingLocked(false); };
  
  const otherUser = useMemo(() => { const id = item.type === 'dm' ? item.members.find(m => m !== currentUser.uid) : null; return id ? memberDetails[id] : null; }, [item, currentUser.uid, memberDetails]);
  const botDocRef = useMemoFirebase(() => (db && otherUser?.isCustomBot) ? doc(db, 'customBots', otherUser.id) : null, [db, otherUser?.id, otherUser?.isCustomBot]);
  const { data: botConfig } = useDoc<CustomBot>(botDocRef); const botApps = botConfig?.miniApps || [];
  
  const getStatusLine = () => { if (item.id === currentUser.uid) return null; if (item.id === 'GENERAL_CHAT') return t('public_chat_description'); if (item.type === 'dm' && otherUser) { if (otherUser.isBot) return t('bot_status'); if (otherUser.status === 'online') return <span className="text-primary font-bold">{t('online')}</span>; if (otherUser.lastSeen) return `${t('was_online')} ${format(new Date(otherUser.lastSeen.seconds * 1000), 'dd.MM.yyyy, HH:mm')}`; return t('offline'); } if (item.type === 'group') return t('members_count', { count: item.members?.length || 0 }); if (item.type === 'channel') return t('subscribers_count', { count: item.members?.length || 0 }); return null; };
  
  const handleClearHistory = async () => { if (!db || item.id === 'GENERAL_CHAT') return; try { const snap = await getDocs(collection(db, 'chats', item.id, 'messages')); const batch = writeBatch(db); snap.forEach(d => batch.delete(d.ref)); await batch.commit(); await updateDoc(doc(db, 'chats', item.id), { lastMessage: deleteField() }); toast({ title: t('dm_success') }); } catch(e) { console.error(e); } };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files); const newFiles: Array<{file: File, previewUrl: string, type: 'image' | 'video' | 'music' | 'file'}> = [];
      for (const file of selectedFiles) {
        if (file.size > maxSizeInBytes) { toast({ variant: 'destructive', title: t('video_too_large', { size: maxSizeText }) }); continue; }
        const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'music' : 'file';
        if (type === 'image') { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => { setFilesToSend(prev => [...prev, { file, previewUrl: reader.result as string, type }]); }; } 
        else { newFiles.push({ file, previewUrl: '', type }); }
      }
      if (newFiles.length > 0) setFilesToSend(prev => [...prev, ...newFiles]);
    }
  };
  const removeFileToSend = (index: number) => { setFilesToSend(prev => prev.filter((_, i) => i !== index)); };
  
  const handleSendMessage = async (customPoll?: Poll) => {
    const finalC = messageContent; if ((!finalC.trim() && filesToSend.length === 0 && !customPoll) || !db) return;
    setIsSending(true); setMessageContent(''); setFilesToSend([]); setReplyToMessage(null); autoScrollGuardRef.current = Date.now();
    try {
        const mref = doc(collection(db, 'chats', item.id, 'messages')); const ts = serverTimestamp();
        const data: any = { senderId: currentUser.uid, content: finalC.trim(), timestamp: ts, readBy: [], senderName: currentUser.name || currentUser.username, attachments: [], ...(customPoll && { poll: customPoll }), ...(replyToMessage && { replyTo: { messageId: replyToMessage.id, content: replyToMessage.content || (replyToMessage.imageUrl ? t('photo') : t('file')), senderName: memberDetails[replyToMessage.senderId]?.name || 'User' } }) };
        for (const fItem of filesToSend) {
            const attachment: MessageAttachment = { id: Math.random().toString(36).substring(7), type: fItem.type, fileName: fItem.file.name, fileMimeType: fItem.file.type, status: 'complete' };
            if (fItem.type === 'image') { attachment.url = fItem.previewUrl; data.attachments.push(attachment); } 
            else {
                const reader = new FileReader(); reader.readAsDataURL(fItem.file);
                await new Promise<void>((resolve, reject) => {
                    reader.onload = async () => {
                        try {
                            const base64String = (reader.result as string).split(',')[1]; const CHUNK_SIZE = 900 * 1024; const chunkIds: string[] = [];
                            const col = fItem.type === 'video' ? 'videoChunks' : fItem.type === 'music' ? 'musicChunks' : 'fileChunks';
                            for (let i = 0; i < base64String.length; i += CHUNK_SIZE) {
                                const cref = doc(collection(db, col)); await setDoc(cref, { data: base64String.substring(i, i + CHUNK_SIZE), part: i/CHUNK_SIZE, senderId: currentUser.uid }); chunkIds.push(cref.id);
                            }
                            attachment.chunkIds = chunkIds; data.attachments.push(attachment); resolve();
                        } catch(e) { reject(e); }
                    };
                });
            }
        }
        await setDoc(mref, data);

        if (item.type === 'channel' && item.discussionChatId) {
            const discRef = doc(collection(db, 'chats', item.discussionChatId, 'messages'));
            await setDoc(discRef, { ...data, fromChannelId: item.id, channelMessageId: mref.id });
            await updateDoc(doc(db, 'chats', item.discussionChatId), { lastMessage: { id: discRef.id, content: data.content || (data.attachments?.length > 0 ? t(data.attachments[0].type as any) : ''), senderId: currentUser.uid, senderName: currentUser.name || currentUser.username, timestamp: Timestamp.now() } });
        }

        let lastMsgContent = finalC.trim();
        if (customPoll) lastMsgContent = `Poll: ${customPoll.question}`;
        else if (!lastMsgContent && data.attachments.length > 0) { lastMsgContent = data.attachments.length === 1 ? t(data.attachments[0].type as any) : `${t('file')} (${data.attachments.length})`; }
        await updateDoc(doc(db, 'chats', item.id), { lastMessage: { id: mref.id, content: lastMsgContent, senderId: currentUser.uid, senderName: currentUser.name || currentUser.username, timestamp: Timestamp.now() } });
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };
  
  const handleSendMediaMessage = async (blob: Blob, type: 'voice' | 'circle') => {
    if (!db || blob.size < 500) return; setIsSending(true);
    try {
      const reader = new FileReader(); reader.readAsDataURL(blob);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]; const chunkCol = type === 'voice' ? 'voiceChunks' : 'circleChunks';
        const mref = doc(collection(db, chunkCol)); await setDoc(mref, { data: base64, part: 0, senderId: currentUser.uid });
        const ts = serverTimestamp(); const msgData: any = { senderId: currentUser.uid, timestamp: ts, readBy: [], senderName: currentUser.name || currentUser.username, content: '' };
        if (type === 'voice') { msgData.voiceMimeType = blob.type; msgData.voiceStatus = 'complete'; msgData.voiceChunkIds = [mref.id]; msgData.voiceDuration = recordingDuration; } 
        else { msgData.circleMimeType = blob.type; msgData.circleStatus = 'complete'; msgData.circleChunkIds = [mref.id]; msgData.circleDuration = recordingDuration; }
        const msgRef = doc(collection(db, 'chats', item.id, 'messages')); await setDoc(msgRef, msgData); await updateDoc(doc(db, 'chats', item.id), { lastMessage: { ...msgData, id: msgRef.id, content: type === 'voice' ? t('voice_message_short') : '[Video Circle]', timestamp: Timestamp.now() } });
      };
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };
  
  const handleToggleReaction = async (mid: string, e: string) => { if (!db) return; const mref = doc(db, 'chats', item.id, 'messages', mid); try { await runTransaction(db, async (tx) => { const snap = await tx.get(mref); if (!snap.exists()) return; const rs = snap.data().reactions || {}; let ex: string | null = null; for (const [k, u] of Object.entries(rs)) if ((u as string[]).includes(currentUser.uid!)) { ex = k; break; } const up: any = {}; if (ex) { const nu = (rs[ex] as string[]).filter(u => u !== currentUser.uid); if (nu.length === 0) up[`reactions.${ex}`] = deleteField(); else up[`reactions.${e}`] = nu; if (ex === e) { tx.update(mref, up); return; } } up[`reactions.${e}`] = arrayUnion(currentUser.uid); tx.update(mref, up); }); } catch (e) { console.error(e); } };
  const handleVote = async (msgId: string, index: number) => { if (!db) return; const mref = doc(db, 'chats', item.id, 'messages', msgId); try { await runTransaction(db, async (tx) => { const snap = await tx.get(mref); if (!snap.exists()) return; const poll = snap.data().poll as Poll; if (!poll) return; const newOptions = poll.options.map((opt, i) => { const votes = [...opt.votes]; const alreadyVoted = votes.includes(currentUser.uid!); if (i === index) { if (alreadyVoted) votes.splice(votes.indexOf(currentUser.uid!), 1); else votes.push(currentUser.uid!); } else if (!poll.isMultipleChoice) { const idx = votes.indexOf(currentUser.uid!); if (idx !== -1) votes.splice(idx, 1); } return { ...opt, votes }; }); tx.update(mref, { 'poll.options': newOptions }); }); } catch (e) { console.error("Voting failed", e); } };
  const handleDeleteMessage = async (msgId: string) => { if (!db) return; try { await deleteDoc(doc(db, 'chats', item.id, 'messages', msgId)); toast({ title: t('dm_success'), description: t('delete_message') }); } catch (e) { console.error(e); } };
  const handleAttachmentSelection = (type: string) => { let a = '*/*'; if (type === 'photo') a = 'image/*'; else if (type === 'video') a = 'video/*'; else if (type === 'music') a = 'audio/*'; if (fileInputRef.current) { fileInputRef.current.accept = a; fileInputRef.current.click(); } };

  const isOwner = item.ownerId === currentUser.uid; const isAdminUser = currentUser.username === '@Infinite'; const isDM = item.type === 'dm'; const isSavedMessages = item.id === currentUser.uid; const isGeneralChat = item.id === 'GENERAL_CHAT'; const canWrite = item.type !== 'channel' || isOwner;
  
  const headerContent = (
    <div className={cn("flex items-center w-full transition-all duration-300 gap-2", experimentalDesign ? "h-14 px-1" : "p-2 h-14")}>
        <div className={cn(experimentalDesign ? "glass-panel backdrop-blur-xl rounded-2xl h-12 w-12 flex items-center justify-center border-white/20 shadow-lg" : "flex items-center", experimentalDesign && !glassEffect && "bg-card/40")}>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10"><X className="h-5 w-5" /></Button>
        </div>
        <div className={cn("flex-1 flex items-center min-w-0 h-full", experimentalDesign && "glass-panel backdrop-blur-xl rounded-2xl h-12 px-1 border-white/20 shadow-lg", experimentalDesign && !glassEffect && "bg-card/40")}>
            <button disabled={isGeneralChat} className="flex items-center text-left hover:bg-accent/40 px-3 py-1 rounded-xl transition-colors min-w-0 flex-1 h-full disabled:hover:bg-transparent" onClick={() => isDM ? setProfileDialogUser(otherUser) : (isGeneralChat ? null : setShowChatProfile(true))}>
                <div className='shrink-0 h-9 w-9'>{isDM ? (<UserAvatarWithStatus user={otherUser} isSavedMessages={isSavedMessages} isSelected={true} className="h-9 w-9" />) : (<Avatar className="h-9 w-9"><AvatarImage src={item.avatar} /><AvatarFallback>{isGeneralChat ? <Globe className="h-5 w-5 text-primary" /> : (item.type === 'group' ? <Users className='h-4 w-4 text-muted-foreground' /> : <Megaphone className='h-4 w-4 text-muted-foreground' />)}</AvatarFallback></Avatar>)}</div>
                <div className="ml-2.5 min-w-0 flex flex-col justify-center h-full"><div className="flex items-center gap-1.5"><h2 className={cn("text-[15px] font-bold font-headline truncate leading-none")}>{isSavedMessages ? t('saved_messages') : (isGeneralChat ? t('general_chat') : (isDM ? otherUser?.name : item.name))}</h2>{(item.link === '/G/Infinite' || item.link === '/C/Infinite') && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}</div><p className="text-[9px] text-muted-foreground truncate font-black uppercase tracking-widest mt-0.5">{getStatusLine()}</p></div>
            </button>
        </div>
        {!isGeneralChat && (
            <div className={cn("flex items-center shrink-0 h-full", experimentalDesign && "glass-panel backdrop-blur-xl rounded-2xl h-12 px-1 border-white/20 shadow-lg", experimentalDesign && !glassEffect && "bg-card/40")}>
                {isDM && !otherUser?.isBot && !isSavedMessages ? (
                    <div className="flex items-center"><Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: item, otherUser, isVideo: false } }))}><Phone className="h-5 w-5" /></Button><DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-full"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" collisionPadding={16} className={cn("w-64 rounded-xl p-1 shadow-2xl z-[100]", (experimentalDesign || glassEffect) ? "glass-menu" : "bg-popover/95 backdrop-blur-xl")}><DropdownMenuItem onSelect={() => setProfileDialogUser(otherUser)}><Info className="mr-3 h-4 w-4 text-primary" /><span className="font-bold">{t('view_profile')}</span></DropdownMenuItem><DropdownMenuItem onSelect={handleClearHistory} className="text-destructive focus:bg-destructive/10"><Eraser className="mr-3 h-4 w-4" /><span className="font-bold">{t('clear_history')}</span></DropdownMenuItem><DropdownMenuItem onSelect={() => setShowChatProfile(true)} className="text-destructive focus:bg-destructive/10"><Trash2 className="mr-3 h-4 w-4" /><span className="font-bold">{t('delete_chat')}</span></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
                ) : (
                    <DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-full"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" collisionPadding={16} className={cn("w-64 rounded-xl p-1 shadow-2xl z-[100]", (experimentalDesign || glassEffect) ? "glass-menu" : "bg-popover/95 backdrop-blur-xl")}>{!isSavedMessages && (<DropdownMenuItem onSelect={() => setShowChatProfile(true)}><Info className="mr-3 h-4 w-4 text-primary" /><span className="font-bold">{t('view_profile')}</span></DropdownMenuItem>)}{(isOwner || isAdminUser || isDM || isSavedMessages) && (<DropdownMenuItem onSelect={handleClearHistory} className="text-destructive focus:bg-destructive/10"><Eraser className="mr-3 h-4 w-4" /><span className="font-bold">{t('clear_history')}</span></DropdownMenuItem>)}{!isSavedMessages && (isOwner || isAdminUser || isDM) && (<DropdownMenuItem onSelect={() => setShowChatProfile(true)} className="text-destructive focus:bg-destructive/10"><Trash2 className="mr-3 h-4 w-4" /><span className="font-bold">{t('delete_chat')}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
                )}
            </div>
        )}
    </div>
  );
  
  return (
    <div className={cn("relative flex flex-col h-svh h-full-safe bg-background overflow-hidden animate-in fade-in duration-300", isMobile ? 'w-screen' : 'w-full')}>
      <header className={cn("flex-shrink-0 z-30 transition-all duration-300", experimentalDesign ? "fixed top-[env(safe-area-inset-top)] left-4 right-4 mt-2" : "flex flex-col border-b pt-[calc(0.5rem+env(safe-area-inset-top))] bg-background sticky top-0")}>
        {experimentalDesign ? (<div className="bg-transparent overflow-hidden">{headerContent}</div>) : (<>{headerContent}<div className={cn("absolute top-[calc(56px+env(safe-area-inset-top)+8px)] left-1/2 -translate-x-1/2 z-20 transition-all duration-300 pointer-events-none", showStickyDate && stickyDate ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2")}><div className={cn("px-4 py-1.5 rounded-full border border-border/50 shadow-lg transition-all", glassEffect ? "glass-panel backdrop-blur-xl" : "bg-muted/95")}><span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">{stickyDate}</span></div></div></>)}
      </header>
      <div className="relative flex-1 bg-background overflow-hidden min-h-0 z-10">
        <div ref={scrollContainerRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto px-2 md:px-4 flex flex-col overscroll-behavior-y-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div ref={listInnerRef} className="space-y-1.5 py-2 flex flex-col min-h-full">
            <div className={cn("flex-1", experimentalDesign && "min-h-[80px]")} />
            {messages?.map((m, i) => {
                const msgDate = getSafeDate(m.timestamp); const prevMsg = messages[i - 1]; const showDate = !prevMsg || !isSameDay(msgDate, getSafeDate(prevMsg.timestamp));
                let dateStr = ""; if (isSameDay(msgDate, new Date())) dateStr = t('today_is'); else if (isYesterday(msgDate)) dateStr = t('yesterday'); else dateStr = format(msgDate, 'dd.MM.yyyy');
                return (<React.Fragment key={m.id}>{showDate && <DateSeparator date={dateStr} rawDate={format(msgDate, 'yyyy-MM-dd')} experimentalDesign={experimentalDesign} glassEffect={glassEffect} />}<ChatMessage message={m} sender={memberDetails[m.senderId]} isCurrentUser={m.senderId === currentUser.uid} chatType={item.type} onAvatarClick={setProfileDialogUser} chat={item} currentUser={currentUser} onReply={setReplyToMessage} setEditingMessage={setEditingMessage} onMediaLoad={scrollToBottom} onPreviewImage={setPreviewImage} onForward={setForwardingMessage} onVote={(idx) => handleVote(m.id, idx)} onDelete={handleDeleteMessage} onToggleReaction={handleToggleReaction} isMobile={isMobile || false} isActiveOnMobile={activeMessageId === m.id} onToggleActiveOnMobile={() => setActiveMessageId(p => p === m.id ? null : m.id)} experimentalDesign={experimentalDesign} glassEffect={glassEffect} /></React.Fragment>);
            })}
            <div className={cn("shrink-0 pointer-events-none", (experimentalDesign || glassEffect) ? "h-20" : "h-2")} aria-hidden="true" />
          </div>
        </div>
        <div className={cn("absolute right-4 z-[110] transition-all duration-300 transform", showScrollDown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none", experimentalDesign ? "bottom-24" : "bottom-4")}>
            <Button variant="secondary" size="icon" onClick={() => scrollToBottom('smooth')} className={cn("w-10 h-10 rounded-full shadow-2xl border border-border/50", glassEffect ? "glass-button" : "bg-card hover:bg-muted")}><ChevronDown className="h-6 w-6" /></Button>
        </div>
      </div>
      {isDM && otherUser?.isCustomBot && botApps.length > 0 && (<div className={cn("absolute bottom-[calc(60px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[45] animate-in slide-in-from-bottom-4 duration-500", (experimentalDesign || glassEffect) ? "mb-6" : "mb-2")}><Button onClick={() => setProfileDialogUser(otherUser)} className={cn("rounded-full shadow-2xl text-white font-bold h-12 px-8 flex items-center gap-2 border-2 border-white/20 hover:scale-105 active:scale-95 transition-all", glassEffect ? "glass-button bg-primary/60" : "bg-primary")}><LayoutGrid className="h-5 w-5" />{botApps.length === 1 ? t('open_mini_app_button') : t('open_mini_apps_menu')}</Button></div>)}
      {isMember && (canWrite ? (
        <footer className={cn("flex-shrink-0 p-2 md:p-3 h-auto flex flex-col pb-[calc(0.5rem+env(safe-area-inset-bottom))] relative z-40 transition-all duration-300", (experimentalDesign || glassEffect) ? "bg-transparent absolute bottom-0 left-0 right-0" : "bg-background border-t")}>
          {(isRecordingVoice || isRecordingCircle) && (
            <div className="absolute inset-0 z-[120] flex items-center justify-between px-4 animate-in slide-in-from-bottom-2 shadow-2xl bg-background w-full h-full">
              <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /><span className="font-mono font-bold text-base">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span><span className="text-[10px] text-muted-foreground ml-2 font-black uppercase tracking-widest">{isRecordingCircle ? 'VIDEO CIRCLE' : t('voice_message')}</span>{isRecordingLocked && <div className="flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-full"><Clock className="h-3 w-3 text-red-500" /><span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">LOCKED</span></div>}</div>
              <div className="flex items-center gap-2"><Button variant="ghost" onClick={() => stopRecording(true)} className="text-destructive font-black uppercase text-[10px] tracking-widest">{t('cancel')}</Button>{(isRecordingLocked || !isMobile) && <Button onClick={() => stopRecording(false)} className="rounded-full h-10 w-10 bg-primary text-white shadow-lg"><Square className="h-4 w-4 fill-white" /></Button>}</div>
            </div>
          )}
          <div className="max-w-3xl mx-auto w-full h-full flex flex-col">
            {replyToMessage && (
                <div className="flex items-center justify-between bg-muted p-2 rounded-xl mb-2 animate-in slide-in-from-bottom-2">
                    <Reply className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0 truncate text-xs mx-2 flex-1">{replyToMessage.content || (replyToMessage.imageUrl ? t('photo') : t('file'))}</div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setReplyToMessage(null)}><X className="h-4 w-4" /></Button>
                </div>
            )}
            {filesToSend.length > 0 && (<div className="bg-muted p-2 rounded-xl mb-2 animate-in slide-in-from-bottom-2"><ScrollArea className="w-full"><div className="flex items-center gap-3 pb-2">{filesToSend.map((fItem, idx) => (<div key={idx} className="relative group shrink-0"><div className="w-16 h-16 rounded-lg overflow-hidden border bg-background flex items-center justify-center">{fItem.type === 'image' ? <img src={fItem.previewUrl} className="w-full h-full object-cover" alt="Preview" /> : fItem.type === 'video' ? <VideoIcon className="h-6 w-6 text-orange-500" /> : fItem.type === 'music' ? <MusicIcon className="h-6 w-6 text-purple-500" /> : <FileIcon className="h-6 w-6 text-primary" />}</div><Button variant="destructive" size="icon" className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full shadow-md" onClick={() => removeFileToSend(idx)}><X className="h-3 w-3" /></Button></div>))}</div><ScrollBar orientation="horizontal" /></ScrollArea></div>)}
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-end gap-2 relative w-full"><Textarea placeholder={item.type === 'channel' ? t('publish_placeholder') : t('message_placeholder')} value={messageContent} onChange={(e) => setMessageContent(e.target.value)} onKeyDown={(e) => { if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} className={cn("min-h-[44px] h-[44px] max-h-32 py-3 resize-none border rounded-2xl transition-all duration-300", (experimentalDesign || glassEffect) ? "glass-input backdrop-blur-xl bg-card/40 border-white/20" : "bg-muted/50 border-input")} /><div className="flex items-center gap-1.5 shrink-0 h-[44px]"><DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className={cn("h-10 w-10 text-muted-foreground transition-all", (experimentalDesign || glassEffect) ? "glass-panel bg-card/40 backdrop-blur-xl border border-white/20 rounded-xl" : "rounded-full")}><Paperclip className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" side="top" className={cn("w-56 rounded-xl p-1 shadow-2xl", (experimentalDesign || glassEffect) ? "glass-menu backdrop-blur-2xl" : "bg-popover/95 backdrop-blur-xl")}><DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-50 px-2 py-2">{t('max_file_size_label', { size: maxSizeText })}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => handleAttachmentSelection('photo')} className="font-bold"><ImageIcon className="mr-3 h-4 w-4 text-blue-500" /> {t('photo')}</DropdownMenuItem><DropdownMenuItem onSelect={() => handleAttachmentSelection('video')} className="font-bold"><VideoIcon className="mr-3 h-4 w-4 text-orange-500" /> {t('video')}</DropdownMenuItem><DropdownMenuItem onSelect={() => handleAttachmentSelection('music')} className="font-bold"><MusicIcon className="mr-3 h-4 w-4 text-purple-500" /> {t('music')}</DropdownMenuItem><DropdownMenuItem onSelect={() => handleAttachmentSelection('file')} className="font-bold"><FileIcon className="mr-3 h-4 w-4 text-green-500" /> {t('file')}</DropdownMenuItem><DropdownMenuItem onSelect={() => setShowNewPoll(true)} className="font-bold"><ListTodo className="mr-3 h-4 w-4 text-red-500" /> {t('poll')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu><input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple />{messageContent.trim() || filesToSend.length > 0 ? <Button type="submit" size="icon" disabled={isSending} className={cn("h-10 w-10 rounded-full transition-all active:scale-95", (experimentalDesign || glassEffect) ? "bg-primary/60 backdrop-blur-xl border border-white/20" : "")}>{isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}</Button> : <div className="flex items-center gap-1.5"><Button type="button" variant="ghost" size="icon" className={cn("h-10 w-10 text-muted-foreground transition-all", (experimentalDesign || glassEffect) ? "glass-panel bg-card/40 backdrop-blur-xl border border-white/20 rounded-xl" : "rounded-full")} onMouseDown={() => startRecording('circle')} onTouchStart={(e) => { e.preventDefault(); startRecording('circle'); }} onMouseUp={() => { if (recordingDuration < 1.5) stopRecording(false); else setIsRecordingLocked(true); }} onTouchEnd={() => { if (recordingDuration < 1.5) stopRecording(false); else setIsRecordingLocked(true); }}><Camera className="h-5 w-5" /></Button><Button type="button" variant="ghost" size="icon" className={cn("h-10 w-10 text-muted-foreground transition-all", (experimentalDesign || glassEffect) ? "glass-panel bg-card/40 backdrop-blur-xl border border-white/20 rounded-xl" : "rounded-full")} onMouseDown={() => startRecording('voice')} onTouchStart={(e) => { e.preventDefault(); startRecording('voice'); }} onMouseUp={() => { if (recordingDuration < 1.5) stopRecording(false); else setIsRecordingLocked(true); }} onTouchEnd={() => { if (recordingDuration < 1.5) stopRecording(false); else setIsRecordingLocked(true); }}><Mic className="h-5 w-5" /></Button></div>}</div></form>
          </div>
        </footer>
      ) : (
        <footer className={cn("flex-shrink-0 p-3 h-auto min-h-[56px] flex items-center justify-center z-40 pb-[calc(1rem+env(safe-area-inset-bottom))]", (experimentalDesign || glassEffect) ? "bg-transparent absolute bottom-0 left-0 right-0 p-4" : "bg-background border-t")}><Button variant="ghost" className={cn("w-full h-12 font-bold uppercase tracking-widest gap-2 shadow-lg transition-all active:scale-95", (experimentalDesign || glassEffect) ? "glass-panel bg-card/40 backdrop-blur-xl border-white/20 text-primary rounded-2xl" : "text-primary")} onClick={() => { setIsMutedLocal(!isMutedLocal); toast({ title: isMutedLocal ? t('unmute') : t('mute') }); }}>{isMutedLocal ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}{isMutedLocal ? t('unmute') : t('mute')}</Button></footer>
      ))}
      {profileDialogUser && <UserProfileDialog user={profileDialogUser} recipient={profileDialogUser} currentUser={currentUser} open={!!profileDialogUser} onOpenChange={(o) => !o && setProfileDialogUser(null)} onSendMessage={() => {}} />}
      {showChatProfile && <ChatProfileDialog chat={item} members={[]} currentUser={currentUser} open={showChatProfile} onOpenChange={setShowChatProfile} onCloseChat={onClose} />}
      <NewPollDialog open={showNewPoll} onOpenChange={setShowNewPoll} onCreate={(p) => handleSendMessage(p)} />
    </div>
  );
}
