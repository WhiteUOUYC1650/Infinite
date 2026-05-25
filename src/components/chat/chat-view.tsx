
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat, Poll } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X, MoreVertical, Info, Trash2, Users, Megaphone, CheckCheck, Bookmark, Globe, Bot, Copy, Edit, Reply, Image as ImageIcon, Music as MusicIcon, Video as VideoIcon, Clock, Check, CheckCheck as CheckDouble, File as FileIcon, Mic, Camera, Pause, Play, ListTodo, Plus, CheckCircle2, Forward, Bell, BellOff, ThumbsUp, ChevronDown, ChevronUp, Smile, Radio, Eraser, LogOut, ChevronRight } from 'lucide-react';
import { UserAvatarWithStatus, InfiniteLogo } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, setDoc, arrayUnion, deleteDoc, serverTimestamp, orderBy, limit, arrayRemove, query, runTransaction, deleteField, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { format, isSameDay, isYesterday } from 'date-fns';
import { useLanguage } from '@/context/language-context';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '../ui/badge';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { VerifiedBadge } from '../ui/verified-badge';
import { useTheme } from '@/context/theme-context';
import { getCachedFile, cacheFile, fetchAndCacheImage } from '@/lib/cache-utils';

export const COMMON_EMOJIS = [
    '👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '🙏', '👏', '🎉', '✨', 
    '🤔', '🤯', '🤩', '🥳', '🤮', '💩', '🤡', '👻', '👽', '👾', 
    '🤖', '🎃', '😺', '🤟', '🤘'
];

const getSafeDate = (ts: any): Date => { if (ts && typeof ts.seconds === 'number') { return new Date(ts.seconds * 1000); } return new Date(); };

function DateSeparator({ date, rawDate, experimentalDesign }: { date: string, rawDate: string, experimentalDesign: boolean }) {
  return (
    <div className="relative my-6 flex items-center justify-center date-separator-marker" data-date={date}>
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-muted-foreground/10" />
      </div>
      <div className={cn(
          "relative px-4 py-1 rounded-full border border-border/50 shadow-sm transition-all",
          experimentalDesign ? "bg-card/45 backdrop-blur-xl border-white/20" : "bg-muted/80"
      )}>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
          {date}
        </span>
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

const ChatMessage = React.memo(({ message, sender, isCurrentUser, chatType, onAvatarClick, chat, currentUser, onReply, setEditingMessage, onMediaLoad, onPreviewImage, onForward, onVote, onDelete, onToggleReaction, isMobile, isActiveOnMobile, onToggleActiveOnMobile, experimentalDesign }: { message: Message, sender?: User, isCurrentUser: boolean, chatType: PopulatedChat['type'], onAvatarClick: (user: User) => void, chat: PopulatedChat, currentUser: AuthenticatedUser, onReply: (message: Message) => void, setEditingMessage: (message: Message | null) => void, onMediaLoad: () => void; onPreviewImage: (url: string) => void; onForward: (message: Message) => void; onVote: (index: number) => void; onDelete: (id: string) => void; onToggleReaction: (msgId: string, emoji: string) => void; isMobile: boolean; isActiveOnMobile?: boolean; onToggleActiveOnMobile?: () => void; experimentalDesign: boolean }) => {
    const { t } = useLanguage(); const { toast } = useToast(); const db = useFirestore(); const alignRight = isCurrentUser && message.type !== 'announcement' && chatType !== 'channel'; const isOfficialBotChat = chat.link === '/B/Infinite' || chat.name === 'Infinite'; const showSenderAvatar = chatType !== 'channel' && !isOfficialBotChat && ((chatType === 'group' && !isCurrentUser) || (message.type === 'announcement' && chatType !== 'dm')); const [mediaUrl, setMediaUrl] = useState<string | null>(null); const circleVideoRef = useRef<HTMLVideoElement>(null); const [hasUnmutedCircle, setHasUnmutedCircle] = useState(false);
    const isCircleComplete = message.circleStatus === 'complete';
    const isRead = useMemo(() => { if (!isCurrentUser || !message.readBy) return false; if (chatType === 'dm') { const otherId = chat.members.find(id => id !== currentUser.uid); return otherId ? message.readBy.includes(otherId) : false; } return message.readBy.some(id => id !== currentUser.uid); }, [isCurrentUser, message.readBy, chat.members, chatType, currentUser.uid]);
    useEffect(() => { const loadMedia = async () => { const cached = await getCachedFile(message.id); if (cached) { setMediaUrl(cached); onMediaLoad(); return; } if (message.imageUrl) { const url = await fetchAndCacheImage(message.id, message.imageUrl); if (url) { setMediaUrl(url); onMediaLoad(); } return; } if (!db) return; if (message.videoStatus === 'complete' || message.musicStatus === 'complete' || message.voiceStatus === 'complete' || message.circleStatus === 'complete' || message.fileStatus === 'complete') { try { const col = message.videoStatus === 'complete' ? 'videoChunks' : message.musicStatus === 'complete' ? 'musicChunks' : message.voiceStatus === 'complete' ? 'voiceChunks' : message.circleStatus === 'complete' ? 'circleChunks' : 'fileChunks'; const chunkIds = message.videoChunkIds || message.musicChunkIds || message.voiceChunkIds || message.circleChunkIds || message.fileChunkIds || []; const chunkSnaps = await Promise.all(chunkIds.map(id => getDoc(doc(db, col, id)))); const chunksData = chunkSnaps.map(s => s.data() as { part: number, data: string }); chunksData.sort((a, b) => a.part - b.part); const assembled = chunksData.map(c => c.data).join(''); const mime = message.videoMimeType || message.musicMimeType || message.voiceMimeType || message.circleMimeType || message.fileMimeType || 'application/octet-stream'; const dataUrl = `data:${mime};base64,${assembled}`; await cacheFile(message.id, dataUrl); const finalUrl = await getCachedFile(message.id); if (finalUrl) { setMediaUrl(finalUrl); onMediaLoad(); } } catch (e) { console.error("Media failed", e); } } }; loadMedia(); }, [message.id, db, message.videoStatus, message.musicStatus, message.voiceStatus, message.circleStatus, message.fileStatus, message.imageUrl, onMediaLoad]);
    const handleCircleClick = (e: React.MouseEvent) => { e.stopPropagation(); if (circleVideoRef.current) { window.dispatchEvent(new CustomEvent('stop-media', { detail: { id: message.id } })); circleVideoRef.current.currentTime = 0; if (!hasUnmutedCircle) { circleVideoRef.current.muted = false; setHasUnmutedCircle(true); } circleVideoRef.current.play(); } };
    const handleSaveToGallery = async () => { if (!mediaUrl) return; if (Capacitor.isNativePlatform()) { try { const { Filesystem, Directory } = await import('@capacitor/filesystem'); const cleanBase64 = mediaUrl.split(',')[1]; const ext = message.imageUrl ? 'jpg' : (message.videoStatus ? 'mp4' : (message.musicStatus ? 'mp3' : 'bin')); const fileName = `Infinite_${message.id}_${Date.now()}.${ext}`; await Filesystem.writeFile({ path: fileName, data: cleanBase64, directory: Directory.Documents }); toast({ title: t('dm_success'), description: t('save_to_device') }); } catch (e) { console.error(e); toast({ variant: 'destructive', title: 'Error', description: 'Failed to save file.' }); } } else { const link = document.createElement('a'); link.href = mediaUrl; link.download = message.fileName || `Infinite_${message.id}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); toast({ title: t('dm_success') }); } };
    const canCopy = message.content && !message.poll; const canEdit = isCurrentUser && !message.poll && !message.voiceStatus && !message.circleStatus; const isAdmin = currentUser.username === '@Infinite'; const canDelete = isAdmin || (sender?.username !== '@Infinite' && (isCurrentUser || chat.ownerId === currentUser.uid || chat.type === 'dm'));
    const isLikedByMe = (emoji: string) => message.reactions?.[emoji]?.includes(currentUser.uid);
    return (
        <div id={`message-${message.id}`} className={cn("group flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300", alignRight ? "flex-row-reverse outgoing-msg" : "flex-row incoming-msg")} onClick={() => isMobile && onToggleActiveOnMobile?.()}>
            {showSenderAvatar ? (<div className="w-10 h-10 flex-shrink-0"><button onClick={() => sender && onAvatarClick(sender)} disabled={isCurrentUser || (sender && !!sender.isDeleted)}><UserAvatarWithStatus user={message.type === 'announcement' ? { id: 'bot', name: message.senderName || 'Infinite', avatar: message.senderAvatar, isBot: true } as any : sender!} /></button></div>) : (chatType === 'group' && !alignRight && !isOfficialBotChat) ? <div className="w-10 flex-shrink-0" /> : null}
            <div className={cn(
                "min-w-0 flex flex-col relative transition-all duration-300",
                isCircleComplete ? "bg-transparent shadow-none p-0" : (alignRight ? "bg-primary text-white shadow-sm" : "bg-card text-card-foreground shadow-sm"),
                isCircleComplete ? "rounded-full" : (alignRight ? "rounded-lg rounded-br-none" : "rounded-lg rounded-bl-none"),
                !isCircleComplete && "px-2 pb-1 pt-1.5",
                "max-w-[85%] md:max-w-[70%]"
            )}>
                {((chatType === 'group' && !isCurrentUser) || chatType === 'channel' || message.type === 'announcement') && !isCircleComplete && (<div className="font-bold text-[13px] flex items-center gap-2 mb-0.5 px-0.5"><span className="truncate">{message.type === 'announcement' ? (message.senderName || 'Infinite') : (sender?.isDeleted ? t('deleted_account') : sender?.name)}</span>{sender?.username === '@InfiniteBot' && <VerifiedBadge className='w-3 h-3 shrink-0' />}</div>)}
                {message.replyTo && !isCircleComplete && (
                    <div onClick={(e) => { e.stopPropagation(); document.getElementById(`message-${message.replyTo!.messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className={cn("mb-1.5 p-1.5 border-l-4 rounded-r-md cursor-pointer transition-colors max-w-full overflow-hidden flex flex-col", alignRight ? "bg-black/10 border-white/50 hover:bg-black/20" : "bg-primary/5 border-primary hover:bg-primary/10")}>
                        <p className={cn("text-[11px] font-bold truncate", alignRight ? "text-white" : "text-primary")}>{message.replyTo.senderName}</p>
                        <p className={cn("text-[11px] truncate line-clamp-1 opacity-80 italic", alignRight ? "text-white" : "text-muted-foreground")}>{message.replyTo.content}</p>
                    </div>
                )}
                {message.imageUrl && !isCircleComplete && (<div className={cn("w-full flex mb-1", alignRight ? "justify-end" : "justify-start")}><img src={message.imageUrl} onClick={() => onPreviewImage(message.imageUrl!)} className="max-w-full max-h-[320px] w-auto object-contain rounded-lg cursor-pointer" onLoad={onMediaLoad} /></div>)}
                {message.videoStatus === 'complete' && mediaUrl && !isCircleComplete && (<div className="pt-1"><video src={mediaUrl} controls className="max-full rounded-lg" onLoadedData={onMediaLoad} /></div>)}
                {isCircleComplete && mediaUrl && (<div className={cn("rounded-full overflow-hidden bg-black aspect-square shrink-0 cursor-pointer w-48 h-48")} onClick={handleCircleClick}><video ref={circleVideoRef} src={mediaUrl} loop muted playsInline className="w-full h-full object-cover" onLoadedData={onMediaLoad} /></div>)}
                {(message.musicStatus === 'complete' || message.voiceStatus === 'complete') && mediaUrl && !isCircleComplete && (<div className="pt-1"><CustomAudioPlayer src={mediaUrl} isMusic={!!message.musicStatus} fileName={message.fileName} messageId={message.id} onMediaLoad={onMediaLoad} /></div>)}
                {message.poll && !isCircleComplete && <PollDisplay poll={message.poll} onVote={onVote} currentUserId={currentUser.uid} alignRight={alignRight} />}
                {message.content && !message.poll && !isCircleComplete && (<div className={cn("text-sm break-words whitespace-pre-wrap pt-0 px-0.5")}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({node, ...p}) => <a className={cn("underline font-bold", alignRight ? "text-white" : "text-primary")} target="_blank">{p.children}</a> }}>{message.children || message.content}</ReactMarkdown></div>)}
                {message.reactions && Object.keys(message.reactions).length > 0 && !isCircleComplete && (<div className={cn("flex flex-wrap gap-1.5 mt-2", alignRight ? "justify-end" : "justify-start")}>{Object.entries(message.reactions).map(([emoji, uids]) => { if (uids.length === 0) return null; const hasReacted = uids.includes(currentUser.uid); return (<button key={emoji} onClick={(e) => { e.stopPropagation(); onToggleReaction(message.id, emoji); }} className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-black border transition-all active:scale-90", hasReacted ? "bg-white/20 border-white/50 text-white" : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted", alignRight && "text-white border-white/30")}><span>{emoji}</span><span className={cn(alignRight && "text-white")}>{uids.length}</span></button>); })}</div>)}
                {!isCircleComplete && (<div className={cn("flex items-center gap-1 mt-0.5 text-[9px] self-end opacity-70")}>{message.editedAt && <span className="font-bold">{t('edited')}</span>}<span>{format(getSafeDate(message.timestamp), 'HH:mm')}</span>{isCurrentUser && (<span className="ml-0.5">{isRead ? <CheckDouble className="h-3 w-3" /> : <Check className="h-2.5 w-2.5" />}</span>)}</div>)}
            </div>
            <div className={cn("flex-shrink-0 self-center w-8 flex justify-center transition-all", isMobile ? (isActiveOnMobile ? "opacity-100" : "opacity-0 pointer-events-none") : "opacity-0 group-hover:opacity-100", !alignRight && "order-last")}>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align={alignRight ? 'end' : 'start'} collisionPadding={16} className={cn("p-1 shadow-2xl border-none z-[100] max-h-[85vh]", experimentalDesign ? "glass-menu flex flex-row gap-1 w-auto" : "bg-popover rounded-xl flex flex-col w-56")}>
                        {experimentalDesign ? (
                            <>
                                <div className="grid grid-cols-5 gap-1 p-2 bg-muted/20 rounded-2xl border border-white/5 shrink-0 w-[180px]">
                                    {COMMON_EMOJIS.map(emoji => { const sel = isLikedByMe(emoji); return (<button key={emoji} onClick={() => onToggleReaction(message.id, emoji)} className={cn("h-8 w-8 flex items-center justify-center transition-all active:scale-150 hover:bg-primary/20 rounded-lg text-lg", sel && "bg-primary/30 scale-110")}>{emoji}</button>); })}
                                </div>
                                <div className="w-[180px] flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between px-3 h-10 bg-primary text-white rounded-xl mb-1 font-bold text-sm">
                                        <div className="flex items-center gap-2"><Smile className="h-4 w-4" />{t('reactions')}</div>
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                    <DropdownMenuItem onSelect={() => onReply(message)} className="h-10 rounded-xl px-3 focus:bg-primary/10 font-bold"><Reply className="mr-3 h-4 w-4 text-primary" />{t('reply')}</DropdownMenuItem>
                                    {canCopy && <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(message.content); toast({ title: t('copy_success_toast') }); }} className="h-10 rounded-xl px-3 focus:bg-primary/10 font-bold"><Copy className="mr-3 h-4 w-4 text-primary" />{t('copy_text')}</DropdownMenuItem>}
                                    <DropdownMenuItem onSelect={() => onForward(message)} className="h-10 rounded-xl px-3 focus:bg-primary/10 font-bold"><Forward className="mr-3 h-4 w-4 text-primary" />{t('forward')}</DropdownMenuItem>
                                    {canDelete && <DropdownMenuItem onSelect={() => onDelete(message.id)} className="text-destructive h-10 rounded-xl px-3 focus:bg-destructive/10 font-bold"><Trash2 className="mr-3 h-4 w-4" />{t('delete_message')}</DropdownMenuItem>}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="px-2 py-2 mb-1 flex flex-wrap items-center gap-1 bg-muted/40 rounded-lg border border-border/20 shadow-inner max-h-[120px] overflow-y-auto no-scrollbar">
                                    {COMMON_EMOJIS.map(emoji => { const sel = isLikedByMe(emoji); return (<button key={emoji} onClick={() => onToggleReaction(message.id, emoji)} className={cn("h-7 w-7 flex items-center justify-center rounded-md text-base", sel && "bg-primary/20")}>{emoji}</button>); })}
                                </div>
                                <DropdownMenuItem onSelect={() => onReply(message)}><Reply className="mr-2 h-4 w-4" />{t('reply')}</DropdownMenuItem>
                                {canCopy && <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(message.content); toast({ title: t('copy_success_toast') }); }}><Copy className="mr-2 h-4 w-4" />{t('copy_text')}</DropdownMenuItem>}
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
  const db = useFirestore(); const { t } = useLanguage(); const { toast } = useToast(); const { theme: colorTheme, sendOnEnter, smoothScroll, experimentalDesign } = useTheme(); const isMobile = useIsMobile();
  const isPrem = currentUser.subscriptionTier === 'prem'; const maxSizeText = isPrem ? '4GB' : '1GB'; const maxFileSizeInBytes = isPrem ? 4 * 1024 * 1024 * 1024 : 1 * 1024 * 1024 * 1024;
  
  const [messageContent, setMessageContent] = useState(''); const [isSending, setIsSending] = useState(false); const [profileDialogUser, setProfileDialogUser] = useState<User | null>(null); const [showChatProfile, setShowChatProfile] = useState(false); const [replyToMessage, setReplyToMessage] = useState<Message | null>(null); const [editingMessage, setEditingMessage] = useState<Message | null>(null); const [fileToSend, setFileToSend] = useState<{file: File, previewUrl: string, type: 'image' | 'video' | 'music' | 'file'} | null>(null); const [previewImage, setPreviewImage] = useState<string | null>(null); const [activeMessageId, setActiveMessageId] = useState<string | null>(null); const [messageLimit, setMessageLimit] = useState(50); const [hasMore, setHasMore] = useState(true); const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); const listInnerRef = useRef<HTMLDivElement>(null); const fileInputRef = useRef<HTMLInputElement>(null); const prevScrollHeightRef = useRef<number>(0); const isAtBottomRef = useRef(true); const autoScrollGuardRef = useRef<number>(0); const [stickyDate, setStickyDate] = useState<string | null>(null); const [showStickyDate, setShowStickyDate] = useState(false); const stickyHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isRecordingVoice, setIsRecordingVoice] = useState(false); const [isRecordingCircle, setIsRecordingCircle] = useState(false); const [recordingDuration, setRecordingDuration] = useState(0); const mediaRecorderRef = useRef<MediaRecorder | null>(null); const chunksRef = useRef<Blob[]>([]); const timerRef = useRef<NodeJS.Timeout | null>(null); const activeStreamRef = useRef<MediaStream | null>(null);
  
  const isMember = useMemo(() => initialItem?.members?.includes(currentUser.uid) ?? false, [initialItem?.members, currentUser.uid]);
  const chatDocRef = useMemoFirebase(() => db ? doc(db, 'chats', initialItem.id) : null, [db, initialItem.id]); const { data: liveChatData } = useDoc<Chat>(chatDocRef); const item = useMemo(() => { if (!liveChatData) return initialItem; return { ...initialItem, ...liveChatData }; }, [initialItem, liveChatData]);
  const messagesQuery = useMemoFirebase(() => { if (!db || !isMember) return null; return query(collection(db, 'chats', item.id, 'messages'), orderBy('timestamp', 'desc'), limit(messageLimit)); }, [db, item.id, isMember, messageLimit]); const { data: rawMessages, loading: messagesLoading } = useCollection<Message>(messagesQuery); const messages = useMemo(() => rawMessages ? [...rawMessages].reverse() : null, [rawMessages]);
  const allUserIds = useMemo(() => { const ids = new Set<string>(item.members || []); messages?.forEach(m => ids.add(m.senderId)); return Array.from(ids); }, [item.members, messages]); const { users: memberDetails } = useBatchUsers(allUserIds);
  const scrollToBottom = useCallback((b: ScrollBehavior = 'auto') => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight; }, []);
  
  const handleScroll = useCallback(() => { if (!scrollContainerRef.current) return; const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current; const atBottom = scrollHeight - scrollTop - clientHeight < 300; isAtBottomRef.current = atBottom; if (!atBottom && Date.now() - autoScrollGuardRef.current > 10000) autoScrollGuardRef.current = 0; if (scrollTop < 50 && hasMore && !messagesLoading && messages && messages.length >= messageLimit) { prevScrollHeightRef.current = scrollHeight; setMessageLimit(p => p + 50); } setShowStickyDate(true); if (stickyHideTimeoutRef.current) clearTimeout(stickyHideTimeoutRef.current); stickyHideTimeoutRef.current = setTimeout(() => setShowStickyDate(false), 1000); const markers = scrollContainerRef.current.querySelectorAll('.date-separator-marker'); let currentTopDate = null; markers.forEach((marker: any) => { if (marker.offsetTop <= scrollTop + 100) { currentTopDate = marker.getAttribute('data-date'); } }); setStickyDate(currentTopDate); }, [hasMore, messagesLoading, messages, messageLimit]);
  useEffect(() => { const ro = new ResizeObserver(() => { if (isAtBottomRef.current || (Date.now() - autoScrollGuardRef.current < 10000)) requestAnimationFrame(() => { scrollToBottom(); setTimeout(scrollToBottom, 50); }); }); if (listInnerRef.current) ro.observe(listInnerRef.current); return () => ro.disconnect(); }, [scrollToBottom]);
  useEffect(() => { if (!db || !currentUser.uid || !item.id || !messages) return; const markRead = async () => { if (item.unreadCounts?.[currentUser.uid] > 0) await updateDoc(doc(db, 'chats', item.id), { [`unreadCounts.${currentUser.uid}`]: 0 }); }; markRead(); }, [item.id, messages, currentUser.uid, db, item.unreadCounts]);
  useLayoutEffect(() => { if (prevScrollHeightRef.current > 0 && scrollContainerRef.current) { scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - prevScrollHeightRef.current; prevScrollHeightRef.current = 0; } else if (isAtBottomRef.current) { autoScrollGuardRef.current = Date.now(); scrollToBottom(smoothScroll ? 'smooth' : 'auto'); } }, [messages, smoothScroll, scrollToBottom]);
  useEffect(() => { autoScrollGuardRef.current = Date.now(); scrollToBottom(); }, [item.id, scrollToBottom]);

  const startRecording = async (type: 'voice' | 'circle') => {
    try {
      const constraints = { audio: true, video: type === 'circle' ? { facingMode: 'user', width: 480, height: 480 } : false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints); activeStreamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: type === 'circle' ? 'video/webm' : 'audio/webm' }); mediaRecorderRef.current = mr;
      chunksRef.current = []; mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => { const blob = new Blob(chunksRef.current, { type: mr.mimeType }); if (blob.size > 50) handleSendMediaMessage(blob, type); stream.getTracks().forEach(t => t.stop()); };
      mr.start(); if (type === 'voice') setIsRecordingVoice(true); else setIsRecordingCircle(true); setRecordingDuration(0); timerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (e) { console.error(e); toast({ variant: 'destructive', title: t('microphone_error_title'), description: t('microphone_error_desc') }); }
  };
  const stopRecording = (canceled: boolean) => { if (timerRef.current) clearInterval(timerRef.current); if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { if (canceled) chunksRef.current = []; mediaRecorderRef.current.stop(); } setIsRecordingVoice(false); setIsRecordingCircle(false); };
  
  const otherUser = useMemo(() => { const id = item.type === 'dm' ? item.members.find(m => m !== currentUser.uid) : null; return id ? memberDetails[id] : null; }, [item, currentUser.uid, memberDetails]);
  
  const getStatusLine = () => {
      if (item.id === currentUser.uid) return null;
      if (item.id === 'GENERAL_CHAT') return t('public_chat_description');
      if (item.type === 'dm' && otherUser) {
          if (otherUser.isBot) return t('bot_status');
          if (otherUser.status === 'online') return <span className="text-primary font-bold">{t('online')}</span>;
          if (otherUser.lastSeen) return `${t('was_online')} ${format(new Date(otherUser.lastSeen.seconds * 1000), 'dd.MM.yyyy, HH:mm')}`;
          return t('offline');
      }
      if (item.type === 'group') return t('members_count', { count: item.members?.length || 0 });
      if (item.type === 'channel') return t('subscribers_count', { count: item.members?.length || 0 });
      return null;
  };

  const handleSendMessage = async (customC?: string, immediateFile?: any) => {
    const finalC = customC !== undefined ? customC : messageContent; const finalF = immediateFile || fileToSend; if ((!finalC.trim() && !finalF) || !db) return;
    setIsSending(true); setMessageContent(''); setFileToSend(null); setReplyToMessage(null); autoScrollGuardRef.current = Date.now();
    try {
        const mref = doc(collection(db, 'chats', item.id, 'messages')); const ts = serverTimestamp();
        const data: any = { senderId: currentUser.uid, content: finalC.trim(), timestamp: ts, readBy: [], senderName: currentUser.name || currentUser.username, ...(replyToMessage && { replyTo: { messageId: replyToMessage.id, content: replyToMessage.content || (replyToMessage.imageUrl ? t('photo') : t('file')), senderName: memberDetails[replyToMessage.senderId]?.name || 'User' } }) };
        if (finalF?.type === 'image') data.imageUrl = finalF.previewUrl; await setDoc(mref, data);
        await updateDoc(doc(db, 'chats', item.id), { lastMessage: { id: mref.id, content: finalC.trim() || t('image_attachment_placeholder'), senderId: currentUser.uid, senderName: currentUser.name || currentUser.username, timestamp: Timestamp.now() } });
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };
  const handleSendMediaMessage = async (blob: Blob, type: 'voice' | 'circle') => {
    if (!db) return; setIsSending(true);
    try {
      const reader = new FileReader(); reader.readAsDataURL(blob);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const mref = doc(collection(db, 'chats', item.id, 'messages')); const chunkRef = doc(collection(db, type === 'voice' ? 'voiceChunks' : 'circleChunks')); await setDoc(chunkRef, { data: base64, part: 0, senderId: currentUser.uid });
        const ts = serverTimestamp(); const msgData: any = { senderId: currentUser.uid, timestamp: ts, readBy: [], senderName: currentUser.name || currentUser.username, content: '' };
        if (type === 'voice') { msgData.voiceMimeType = blob.type; msgData.voiceStatus = 'complete'; msgData.voiceChunkIds = [chunkRef.id]; msgData.voiceDuration = recordingDuration; } 
        else { msgData.circleMimeType = blob.type; msgData.circleStatus = 'complete'; msgData.circleChunkIds = [chunkRef.id]; msgData.circleDuration = recordingDuration; }
        await setDoc(mref, msgData); await updateDoc(doc(db, 'chats', item.id), { lastMessage: { ...msgData, id: mref.id, content: type === 'voice' ? t('voice_message_short') : '[Video Circle]', timestamp: Timestamp.now() } });
      };
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };
  const handleToggleReaction = async (mid: string, e: string) => { if (!db) return; const mref = doc(db, 'chats', item.id, 'messages', mid); try { await runTransaction(db, async (tx) => { const snap = await tx.get(mref); if (!snap.exists()) return; const rs = snap.data().reactions || {}; let ex: string | null = null; for (const [k, u] of Object.entries(rs)) if ((u as string[]).includes(currentUser.uid)) { ex = k; break; } const up: any = {}; if (ex) { const nu = (rs[ex] as string[]).filter(u => u !== currentUser.uid); if (nu.length === 0) up[`reactions.${ex}`] = deleteField(); else up[`reactions.${ex}`] = nu; if (ex === e) { tx.update(mref, up); return; } } up[`reactions.${e}`] = arrayUnion(currentUser.uid); tx.update(mref, up); }); } catch (e) { console.error(e); } };
  const handleVote = async (msgId: string, index: number) => { if (!db) return; const mref = doc(db, 'chats', item.id, 'messages', msgId); try { await runTransaction(db, async (tx) => { const snap = await tx.get(mref); if (!snap.exists()) return; const poll = snap.data().poll as Poll; if (!poll) return; const newOptions = poll.options.map((opt, i) => { const votes = [...opt.votes]; const alreadyVoted = votes.includes(currentUser.uid); if (i === index) { if (alreadyVoted) votes.splice(votes.indexOf(currentUser.uid), 1); else votes.push(currentUser.uid); } else if (!poll.isMultipleChoice) { const idx = votes.indexOf(currentUser.uid); if (idx !== -1) votes.splice(idx, 1); } return { ...opt, votes }; }); tx.update(mref, { 'poll.options': newOptions }); }); } catch (e) { console.error("Voting failed", e); } };
  const handleDeleteMessage = async (msgId: string) => { if (!db) return; try { await deleteDoc(doc(db, 'chats', item.id, 'messages', msgId)); toast({ title: t('dm_success'), description: t('delete_message') }); } catch (e) { console.error(e); } };
  const handleAttachmentSelection = (type: string) => { let a = '*/*'; if (type === 'photo') a = 'image/*'; else if (type === 'video') a = 'video/*'; else if (type === 'music') a = 'audio/*'; if (fileInputRef.current) { fileInputRef.current.accept = a; fileInputRef.current.click(); } };

  const handleClearHistory = async () => {
    if (!db || item.id === 'GENERAL_CHAT') return;
    try {
        const snap = await getDocs(collection(db, 'chats', item.id, 'messages'));
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        await updateDoc(doc(db, 'chats', item.id), { lastMessage: deleteField() });
        toast({ title: t('dm_success') });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to clear history.' });
    }
  };

  const isOwner = item.ownerId === currentUser.uid;
  const isAdmin = currentUser.username === '@Infinite';
  const isDM = item.type === 'dm';
  const isSavedMessages = item.id === currentUser.uid;
  const isGeneralChat = item.id === 'GENERAL_CHAT';
  
  const canWrite = item.type !== 'channel' || isOwner || isAdmin;

  return (
    <div className={cn("relative flex flex-col h-svh h-full-safe bg-background overflow-hidden", isMobile ? 'w-screen' : 'w-full')}>
      <header className={cn("flex-shrink-0 flex flex-col border-b pt-[calc(0.5rem+env(safe-area-inset-top))] bg-background sticky top-0 z-30", colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background')}>
        <div className="flex items-center p-2 h-14">
            <Button variant="ghost" size="icon" onClick={onClose} className="mr-2 shrink-0"><X className="h-5 w-5" /></Button>
            <div className="flex-1 flex items-center min-w-0 h-12">
                <button className="flex items-center text-left hover:bg-accent px-3 py-1 rounded-md transition-colors min-w-0 flex-1 h-full" onClick={() => isDM ? setProfileDialogUser(otherUser) : setShowChatProfile(true)}>
                    <div className='shrink-0 h-10 w-10'>
                        {isDM ? (<UserAvatarWithStatus user={otherUser} isSavedMessages={isSavedMessages} isSelected={true} />) : (<Avatar className="h-10 w-10"><AvatarImage src={item.avatar} /><AvatarFallback>{isGeneralChat ? <Globe className="h-6 w-6 text-primary" /> : (item.type === 'group' ? <Users className='h-5 w-5 text-muted-foreground' /> : <Megaphone className='h-5 w-5 text-muted-foreground' />)}</AvatarFallback></Avatar>)}
                    </div>
                    <div className="ml-3 min-w-0 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold font-headline truncate leading-none">{isSavedMessages ? t('saved_messages') : (isGeneralChat ? t('general_chat') : (isDM ? otherUser?.name : item.name))}</h2>
                            {(item.link === '/G/Infinite' || item.link === '/C/Infinite') && <VerifiedBadge className="shrink-0" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate font-medium mt-0.5">{getStatusLine()}</p>
                    </div>
                </button>
            </div>
            {!isGeneralChat && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 ml-2">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={16} className={cn("w-64 rounded-xl p-1 shadow-2xl z-[100]", experimentalDesign ? "glass-menu" : "bg-popover/95 backdrop-blur-xl")}>
                  {!isSavedMessages && (
                      <DropdownMenuItem onSelect={() => isDM ? setProfileDialogUser(otherUser) : setShowChatProfile(true)}>
                        <Info className="mr-3 h-4 w-4 text-primary" />
                        <span>{t('view_profile')}</span>
                      </DropdownMenuItem>
                  )}
                  {isDM && !otherUser?.isBot && !isSavedMessages && (
                    <>
                        <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: item, otherUser, isVideo: false } }))}>
                            <Phone className="mr-3 h-4 w-4 text-primary" />
                            <span>{t('audio_call')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: item, otherUser, isVideo: true } }))}>
                            <Video className="mr-3 h-4 w-4 text-primary" />
                            <span>{t('video_call')}</span>
                        </DropdownMenuItem>
                    </>
                  )}
                  {(isOwner || isAdmin) && item.type === 'group' && (
                    <DropdownMenuItem onSelect={() => setShowChatProfile(true)}>
                      <Video className="mr-3 h-4 w-4 text-primary" />
                      <span>{t('video_chat_title')}</span>
                    </DropdownMenuItem>
                  )}
                  {(isOwner || isAdmin) && item.type === 'channel' && (
                    <DropdownMenuItem onSelect={() => setShowChatProfile(true)}>
                      <Radio className="mr-3 h-4 w-4 text-primary" />
                      <span>{t('broadcast_title')}</span>
                    </DropdownMenuItem>
                  )}
                  {(isOwner || isAdmin || isDM || isSavedMessages) && (
                      <DropdownMenuItem onSelect={handleClearHistory} className="text-destructive focus:bg-destructive/10">
                        <Eraser className="mr-3 h-4 w-4" />
                        <span>{t('clear_history')}</span>
                      </DropdownMenuItem>
                  )}
                  {!isSavedMessages && (isOwner || isAdmin || isDM) && (
                      <DropdownMenuItem onSelect={() => setShowChatProfile(true)} className="text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-3 h-4 w-4" />
                        <span>{t('delete_chat')}</span>
                      </DropdownMenuItem>
                  )}
                  {!isSavedMessages && !isOwner && !isAdmin && (item.type === 'group' || item.type === 'channel') && (
                      <DropdownMenuItem onSelect={() => setShowChatProfile(true)} className="text-destructive focus:bg-destructive/10">
                        <LogOut className="mr-3 h-4 w-4" />
                        <span>{t('leave')}</span>
                      </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
        </div>
        <div className={cn("absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-40 transition-all duration-300 pointer-events-none", showStickyDate && stickyDate ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2")}>
            <div className={cn("px-4 py-1.5 rounded-full border border-border/50 shadow-lg transition-all", experimentalDesign ? "glass-panel" : "bg-muted/95")}>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">{stickyDate}</span>
            </div>
        </div>
      </header>
      <div className="relative flex-1 bg-background overflow-hidden min-h-0">
        <div ref={scrollContainerRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto px-2 md:px-4 flex flex-col overscroll-behavior-y-contain">
          <div ref={listInnerRef} className="space-y-1.5 py-2 flex flex-col min-h-full">
            <div className="flex-1" />
            {messages?.map((m, i) => {
                const msgDate = getSafeDate(m.timestamp); const prevMsg = messages[i - 1]; const showDate = !prevMsg || !isSameDay(msgDate, getSafeDate(prevMsg.timestamp));
                let dateStr = ""; if (isSameDay(msgDate, new Date())) dateStr = t('today_is'); else if (isYesterday(msgDate)) dateStr = t('yesterday'); else dateStr = format(msgDate, 'dd.MM.yyyy');
                return (
                    <React.Fragment key={m.id}>
                        {showDate && <DateSeparator date={dateStr} rawDate={format(msgDate, 'yyyy-MM-dd')} experimentalDesign={experimentalDesign} />}
                        <ChatMessage message={m} sender={memberDetails[m.senderId]} isCurrentUser={m.senderId === currentUser.uid} chatType={item.type} onAvatarClick={setProfileDialogUser} chat={item} currentUser={currentUser} onReply={setReplyToMessage} setEditingMessage={setEditingMessage} onMediaLoad={scrollToBottom} onPreviewImage={setPreviewImage} onForward={setForwardingMessage} onVote={(idx) => handleVote(m.id, idx)} onDelete={handleDeleteMessage} onToggleReaction={handleToggleReaction} isMobile={isMobile} isActiveOnMobile={activeMessageId === m.id} onToggleActiveOnMobile={() => setActiveMessageId(p => p === m.id ? null : m.id)} experimentalDesign={experimentalDesign} />
                    </React.Fragment>
                );
            })}
            <div className={cn("shrink-0 pointer-events-none", experimentalDesign ? "h-20" : "h-2")} aria-hidden="true" />
          </div>
        </div>
      </div>
      {isMember && canWrite && <footer className={cn(
          "flex-shrink-0 p-2 md:p-3 h-auto flex flex-col pb-[calc(0.5rem+env(safe-area-inset-bottom))] relative z-40 transition-all duration-300",
          experimentalDesign ? "bg-transparent border-none absolute bottom-0 left-0 right-0" : "bg-background border-t"
      )}>
        {(isRecordingVoice || isRecordingCircle) && (
          <div className={cn("absolute inset-0 z-50 flex items-center justify-between px-4 animate-in slide-in-from-bottom-2", experimentalDesign ? "glass-panel rounded-none" : "bg-background/95 backdrop-blur-md")}>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono font-bold text-base">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
              <span className="text-xs text-muted-foreground ml-2 font-bold uppercase tracking-widest">{isRecordingCircle ? 'VIDEO CIRCLE' : t('voice_message')}</span>
            </div>
            <div className="flex items-center gap-2"><Button variant="ghost" onClick={() => stopRecording(true)} className="text-destructive font-black uppercase text-[10px] tracking-widest">{t('cancel')}</Button></div>
          </div>
        )}
        <div className="max-w-3xl mx-auto w-full h-full flex items-center">
          <div className="flex flex-col gap-2 w-full">
            {replyToMessage && <div className="flex items-center justify-between bg-muted p-2 rounded-md"><Reply className="h-4 w-4 text-primary shrink-0" /><div className="min-w-0 truncate text-xs">{replyToMessage.content || (replyToMessage.imageUrl ? t('photo') : t('file'))}</div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyToMessage(null)}><X className="h-4 w-4" /></Button></div>}
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-end gap-2 relative w-full">
              <Textarea 
                placeholder={t('message_placeholder')} 
                value={messageContent} 
                onChange={(e) => setMessageContent(e.target.value)} 
                onKeyDown={(e) => { if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} 
                className={cn(
                    "min-h-[40px] h-[40px] max-h-32 resize-none border rounded-2xl transition-all duration-300",
                    experimentalDesign ? "glass-input backdrop-blur-xl bg-card/40 border-white/20" : "bg-muted/50 border-input"
                )} 
              />
              <div className="flex items-center gap-1.5 shrink-0 h-[40px]">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className={cn("h-9 w-9 text-muted-foreground transition-all", experimentalDesign ? "glass-circle bg-card/40 backdrop-blur-xl border border-white/20 rounded-xl" : "rounded-full")}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top" className={cn("w-56 rounded-xl p-1 shadow-2xl", experimentalDesign ? "glass-menu backdrop-blur-2xl" : "bg-popover/95 backdrop-blur-xl")}>
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-50 px-2 py-2">{t('max_file_size_label', { size: maxSizeText })}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => handleAttachmentSelection('photo')}><ImageIcon className="mr-3 h-4 w-4 text-blue-500" /> {t('photo')}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleAttachmentSelection('video')}><VideoIcon className="mr-3 h-4 w-4 text-orange-500" /> {t('video')}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleAttachmentSelection('music')}><MusicIcon className="mr-3 h-4 w-4 text-purple-500" /> {t('music')}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleAttachmentSelection('file')}><FileIcon className="mr-3 h-4 w-4 text-green-500" /> {t('file')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <input type="file" ref={fileInputRef} className="hidden" />
                
                {messageContent.trim() || fileToSend ? (
                  <Button type="submit" size="icon" disabled={isSending} className={cn("h-9 w-9 rounded-full transition-all active:scale-95", experimentalDesign ? "bg-primary/45 backdrop-blur-xl border border-white/20" : "")}><Send className="h-5 w-5" /></Button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className={cn("h-9 w-9 text-muted-foreground transition-all", experimentalDesign ? "glass-circle bg-card/40 backdrop-blur-xl border border-white/20 rounded-xl" : "rounded-full")} 
                      onMouseDown={() => startRecording('circle')} 
                      onTouchStart={(e) => { e.preventDefault(); startRecording('circle'); }} 
                      onMouseUp={() => stopRecording(false)} 
                      onTouchEnd={(e) => { e.preventDefault(); stopRecording(false); }} 
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className={cn("h-9 w-9 text-muted-foreground transition-all", experimentalDesign ? "glass-circle bg-card/40 backdrop-blur-xl border border-white/20 rounded-xl" : "rounded-full")} 
                      onMouseDown={() => startRecording('voice')} 
                      onTouchStart={(e) => { e.preventDefault(); startRecording('voice'); }} 
                      onMouseUp={() => stopRecording(false)} 
                      onTouchEnd={(e) => { e.preventDefault(); stopRecording(false); }} 
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </footer>}
      {profileDialogUser && <UserProfileDialog user={profileDialogUser} open={!!profileDialogUser} onOpenChange={(o) => !o && setProfileDialogUser(null)} onSendMessage={() => {}} />}
      {showChatProfile && <ChatProfileDialog chat={item} members={[]} currentUser={currentUser} open={showChatProfile} onOpenChange={setShowChatProfile} onCloseChat={onClose} />}
    </div>
  );
}

