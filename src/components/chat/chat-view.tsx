'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat, Call, Poll } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X, MoreVertical, User as UserIcon, Info, Trash2, Users, Megaphone, CheckCheck, Bookmark, Globe, Bot, Copy, Edit, Reply, CornerDownLeft, Image as ImageIcon, Music as MusicIcon, Video as VideoIcon, Clock, Check, CheckCheck as CheckCheckIcon, File as FileIcon, Download, Save, Maximize2, SmilePlus, Radio, Mic, Camera, Play, Pause, Trash, Lock, CircleHelp, PhoneOff, LogOut, ListTodo, Plus, Minus, CheckCircle2, Forward, Search, PlayCircle, Cake, Gift, Coins, ChevronRight } from 'lucide-react';
import { UserAvatarWithStatus, InfiniteLogo } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, addDoc, increment, getDoc, setDoc, writeBatch, arrayUnion, deleteDoc, serverTimestamp, onSnapshot, orderBy, limit, arrayRemove, query, deleteField, getDocs, runTransaction, where } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format, isSameDay } from 'date-fns';
import { useLanguage } from '@/context/language-context';
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUpdatePrompt } from '@/context/update-prompt-context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '../ui/badge';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { VerifiedBadge } from '../ui/verified-badge';
import { useTheme } from '@/context/theme-context';
import { getCachedFile, cacheFile, fetchAndCacheImage } from '@/lib/cache-utils';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';

export const COMMON_EMOJIS = [
    '👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '🙏', 
    '👏', '🎉', '🤔', '🤩', '😡', '💩', '💯', 
    '👀', '✅', '❌', '✨', '⚡️', '🚀', '🤝', '🤡', '💘', '🌚'
];

const getSafeDate = (ts: any): Date => {
  if (ts && typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000);
  }
  return new Date();
};

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="relative my-4" data-date-separator={date}>
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-3 text-sm font-medium text-muted-foreground">
          {date}
        </span>
      </div>
    </div>
  );
}

const iconMap = {
    Users,
    Megaphone,
    Bookmark,
    Globe,
    Bot,
};

const compressImage = (file: File, quality = 0.85, maxDimension = 1920): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxDimension) { height *= maxDimension / width; width = maxDimension; }
        } else {
          if (height > maxDimension) { width *= maxDimension / height; height = maxDimension; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type, 0.85));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

function PollDisplay({ poll, onVote, currentUserId, alignRight }: { poll: Poll, onVote: (index: number) => void, currentUserId: string, alignRight: boolean, memberDetails: Record<string, User> }) {
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
    const { t } = useLanguage();
    return (
        <div className={cn("space-y-3 my-2 min-w-[240px]", alignRight ? "text-white" : "text-card-foreground")}>
            <div className="font-bold text-base flex items-center gap-2">
                <ListTodo className="h-5 w-5 shrink-0 text-primary" />
                {poll.question}
            </div>
            <div className="space-y-2">
                {poll.options.map((option, index) => {
                    const isVoted = option.votes.includes(currentUserId);
                    const percentage = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
                    return (
                        <button key={index} onClick={() => onVote(index)} className="w-full group/poll relative text-left">
                            <div className="flex justify-between items-center mb-1 text-xs font-bold px-1">
                                <div className="flex items-center gap-1.5 truncate mr-2">
                                    {isVoted && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                                    <span className="truncate">{option.text}</span>
                                </div>
                                <span className="shrink-0 opacity-70">{percentage}%</span>
                            </div>
                            <div className={cn("h-2 w-full rounded-full overflow-hidden", alignRight ? "bg-black/20" : "bg-muted")}>
                                <div className={cn("h-full transition-all duration-500 rounded-full", alignRight ? "bg-white" : "bg-primary")} style={{ width: `${percentage}%` }} />
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-60 px-1">
                <span>{t('poll_vote_count', { count: totalVotes })}</span>
                {poll.isAnonymous ? <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> {t('poll_anonymous_label')}</span> : <span>{t('poll_view_results')}</span>}
            </div>
        </div>
    );
}

function CustomAudioPlayer({ src, isMusic = false, duration, fileName, hideTime = false, messageId, onMediaLoad }: { src: string | null | undefined, isMusic?: boolean, duration?: number, fileName?: string, hideTime?: boolean, messageId: string, onMediaLoad?: () => void }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [maxTime, setMaxTime] = useState(duration || 0);
    useEffect(() => { if (audioRef.current && src) audioRef.current.load(); }, [src]);
    useEffect(() => {
        const handleStop = (e: any) => { if (e.detail?.id !== messageId && isPlaying) { audioRef.current?.pause(); setIsPlaying(false); } };
        window.addEventListener('stop-media', handleStop);
        return () => window.removeEventListener('stop-media', handleStop);
    }, [isPlaying, messageId]);
    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current && src) {
            if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
            else { window.dispatchEvent(new CustomEvent('stop-media', { detail: { id: messageId } })); audioRef.current.play(); setIsPlaying(true); }
        }
    };
    const onTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            const d = audioRef.current.duration;
            if (d && isFinite(d)) setMaxTime(d);
        }
    };
    const formatTime = (time: number) => {
        if (typeof time !== 'number' || isNaN(time) || !isFinite(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    if (!src) return null;
    return (
        <div className={cn("flex items-center gap-3 w-full px-2 py-1.5 rounded-xl transition-all", isMusic ? "max-w-[400px]" : "min-w-[200px]", "bg-black/10 dark:bg-white/10")}>
            <audio ref={audioRef} src={src} onTimeUpdate={onTimeUpdate} onEnded={() => setIsPlaying(false)} onLoadedMetadata={() => { onTimeUpdate(); onMediaLoad?.(); }} preload="metadata" />
            <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm shrink-0 transition-transform active:scale-95">
                {isPlaying ? <Pause className="h-5 w-5 text-primary fill-primary" /> : <Play className="h-5 w-5 ml-0.5 text-primary fill-primary" />}
            </button>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                {isMusic && fileName && <div className="text-[10px] font-bold truncate mb-0.5 opacity-80">{fileName}</div>}
                <div className="relative h-1.5 w-full bg-white/20 rounded-full overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); if (audioRef.current && maxTime) { const rect = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * maxTime; } }}>
                    <div className="absolute h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${(currentTime / (maxTime || 1)) * 100}%` }} />
                </div>
                {!hideTime && <div className="flex justify-between items-center text-[9px] font-bold mt-1 opacity-70"><span>{formatTime(currentTime)} / {formatTime(maxTime)}</span></div>}
            </div>
        </div>
    );
}

function ForwardMessageDialog({ open, onOpenChange, onForward, currentUser }: { open: boolean, onOpenChange: (v: boolean) => void, onForward: (id: string) => void, currentUser: AuthenticatedUser }) {
    const { t } = useLanguage();
    const db = useFirestore();
    const [search, setSearch] = useState('');
    const chatsQuery = useMemoFirebase(() => {
        if (!db || !currentUser.uid) return null;
        return query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid));
    }, [db, currentUser.uid]);
    const { data: chats, loading } = useCollection<Chat>(chatsQuery);
    const filteredChats = useMemo(() => {
        if (!chats) return [];
        return chats.filter(c => {
            if (c.id === 'GENERAL_CHAT') return true;
            if (c.type === 'dm') return true;
            return (c.name || '').toLowerCase().includes(search.toLowerCase());
        });
    }, [chats, search]);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl flex flex-col h-[70vh]">
                <DialogHeader><DialogTitle>{t('forward_to')}</DialogTitle></DialogHeader>
                <div className="px-1 py-2"><Input placeholder={t('search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} className="rounded-xl bg-muted/50 border-none" /></div>
                <ScrollArea className="flex-1 pr-2"><div className="space-y-1">{loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div> : filteredChats.length > 0 ? filteredChats.map(chat => (
                    <button key={chat.id} onClick={() => { onForward(chat.id); onOpenChange(false); }} className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-xl transition-colors text-left">
                        <Avatar className="h-10 w-10 shrink-0">{chat.avatar ? <AvatarImage src={chat.avatar} /> : <AvatarFallback><InfiniteLogo /></AvatarFallback>}</Avatar>
                        <div className="flex-1 truncate"><p className="font-bold text-sm truncate">{chat.id === 'GENERAL_CHAT' ? t('general_chat') : (chat.name || chat.id)}</p><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t(chat.type as any || 'direct_message_tab')}</p></div>
                    </button>
                )) : <div className="p-8 text-center text-sm text-muted-foreground">{t('no_results_found')}</div>}</div></ScrollArea>
                <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full rounded-xl">{t('cancel')}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function NewPollDialog({ open, onOpenChange, onSubmit }: { open: boolean, onOpenChange: (v: boolean) => void, onSubmit: (poll: Poll) => void }) {
    const { t } = useLanguage();
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [isMultipleChoice, setIsMultipleChoice] = useState(false);
    const handleCreate = () => {
        if (!question.trim() || options.some(opt => !opt.trim())) return;
        onSubmit({ question: question.trim(), options: options.map(opt => ({ text: opt.trim(), votes: [] })), isAnonymous, isMultipleChoice });
        onOpenChange(false); setQuestion(''); setOptions(['', '']);
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader><DialogTitle>{t('create_poll')}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2"><Label>{t('poll_question_label')}</Label><Input placeholder={t('poll_question_placeholder')} value={question} onChange={e => setQuestion(e.target.value)} className="rounded-xl h-12 bg-muted/50 border-none" /></div>
                    <div className="space-y-2"><Label>{t('poll')}</Label><div className="space-y-2">{options.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                            <Input placeholder={t('poll_option_placeholder')} value={opt} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} className="rounded-xl h-11 bg-muted/50 border-none" />
                            {options.length > 2 && <Button variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, idx) => idx !== i))} className="h-11 w-11 rounded-xl text-destructive"><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                    ))}</div>{options.length < 10 && <Button variant="ghost" className="w-full text-primary font-bold text-xs" onClick={() => setOptions([...options, ''])}><Plus className="mr-2 h-3 w-3" /> {t('poll_add_option')}</Button>}</div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"><Label>{t('poll_anonymous_label')}</Label><Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} /></div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"><Label>{t('poll_multiple_choice_label')}</Label><Switch checked={isMultipleChoice} onCheckedChange={setIsMultipleChoice} /></div>
                </div>
                <DialogFooter className="gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl flex-1">{t('cancel')}</Button><Button onClick={handleCreate} disabled={!question.trim() || options.some(opt => !opt.trim())} className="rounded-xl flex-[2] font-bold">{t('create_poll')}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ChatView({ item: initialItem, onClose, currentUser, onSelectChat }: { item: PopulatedChat, onClose: () => void, currentUser: AuthenticatedUser, onSelectChat: (chat: PopulatedChat) => void }) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { theme: colorTheme, sendOnEnter, smoothScroll, experimentalDesign } = useTheme();
  
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState<User | null>(null);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [showNewPoll, setShowNewPoll] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [fileToSend, setFileToSend] = useState<{file: File, previewUrl: string, type: 'image' | 'video' | 'music' | 'file' | 'voice' | 'circle'} | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null); 
  const isMobile = useIsMobile();

  const [messageLimit, setMessageLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [isMutedLocal, setIsMutedLocal] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listInnerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const isAtBottomRef = useRef(true);
  const [stickyDate, setStickyDate] = useState<string | null>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingCircle, setIsRecordingCircle] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const chatDocRef = useMemoFirebase(() => db ? doc(db, 'chats', initialItem.id) : null, [db, initialItem.id]);
  const { data: liveChatData } = useDoc<Chat>(chatDocRef);

  const item = useMemo(() => {
    if (!liveChatData) return initialItem;
    const newChatData = { ...initialItem, ...liveChatData };
    if (newChatData.type === 'dm' && newChatData.id === currentUser.uid) { newChatData.icon = 'Bookmark'; }
    return newChatData;
  }, [initialItem, liveChatData, currentUser.uid]);

  const isMember = useMemo(() => item?.members?.includes(currentUser.uid) ?? false, [item?.members, currentUser.uid]);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !isMember) return null;
    return query(collection(db, 'chats', item.id, 'messages'), orderBy('timestamp', 'desc'), limit(messageLimit));
  }, [db, item.id, isMember, messageLimit]);

  const { data: rawMessages, loading: messagesLoading } = useCollection<Message>(messagesQuery);
  const messages = useMemo(() => rawMessages ? [...rawMessages].reverse() : null, [rawMessages]);

  const isPrem = currentUser.subscriptionTier === 'prem';
  const maxSizeText = isPrem ? '4GB' : '1GB';
  const maxFileSizeInBytes = isPrem ? 4 * 1024 * 1024 * 1024 : 1024 * 1024 * 1024;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (messagesEndRef.current) { messagesEndRef.current.scrollIntoView({ behavior }); }
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
    
    const dateSeparators = container.querySelectorAll<HTMLElement>('[data-date-separator]');
    let currentStickyDate: string | null = null;
    if (dateSeparators.length > 0) {
        for (let i = 0; i < dateSeparators.length; i++) {
            const separator = dateSeparators[i];
            if (separator && separator.offsetTop <= scrollTop + 5) { currentStickyDate = separator.dataset.dateSeparator || null; } else break;
        }
    }
    setStickyDate(currentStickyDate);
    if (scrollTop < 100 && hasMore && !messagesLoading) { 
        prevScrollHeightRef.current = scrollHeight;
        setMessageLimit(prev => prev + 50); 
    }
  }, [hasMore, messagesLoading]);

  const handleMediaLoad = useCallback(() => {
    if (isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom('auto'));
    }
  }, [scrollToBottom]);

  const allUserIdsToFetch = useMemo(() => {
    const ids = new Set<string>(item.members || []);
    messages?.forEach(m => {
        ids.add(m.senderId);
        if (m.reactions) { Object.values(m.reactions).flat().forEach(uid => ids.add(uid as string)); }
    });
    return Array.from(ids);
  }, [item.members, messages]);

  const { users: memberDetails } = useBatchUsers(allUserIdsToFetch);

  // Mark messages as read and clear unread count
  useEffect(() => {
    if (!db || !currentUser.uid || !item.id || !messages) return;

    const markAsRead = async () => {
        try {
            // 1. Clear unread count for current user in the chat document
            if (item.unreadCounts?.[currentUser.uid] && item.unreadCounts[currentUser.uid] > 0) {
                await updateDoc(doc(db, 'chats', item.id), {
                    [`unreadCounts.${currentUser.uid}`]: 0
                });
            }

            // 2. Mark individual messages as read (the ones currently visible/loaded)
            const unreadMessages = messages.filter(m => 
                m.senderId !== currentUser.uid && 
                (!m.readBy || !m.readBy.includes(currentUser.uid))
            );

            if (unreadMessages.length > 0) {
                const batch = writeBatch(db);
                unreadMessages.forEach(m => {
                    const mref = doc(db, 'chats', item.id, 'messages', m.id);
                    batch.update(mref, { readBy: arrayUnion(currentUser.uid) });
                });
                await batch.commit();
            }
        } catch (e) {
            console.error("Mark read failed:", e);
        }
    };

    markAsRead();
  }, [item.id, messages, currentUser.uid, db, item.unreadCounts]);

  useEffect(() => {
    const listElement = listInnerRef.current;
    if (!listElement) return;
    const observer = new ResizeObserver(() => {
        if (isAtBottomRef.current) {
            requestAnimationFrame(() => scrollToBottom('auto'));
        }
    });
    observer.observe(listElement);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current > 0) {
        // Restore scroll position after loading more messages
        const newHeight = container.scrollHeight;
        container.scrollTop = newHeight - prevScrollHeightRef.current;
        prevScrollHeightRef.current = 0;
    } else if (isAtBottomRef.current) {
        scrollToBottom(smoothScroll ? 'smooth' : 'auto');
    }
  }, [messages, smoothScroll, scrollToBottom]);

  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom('auto'), 150);
    return () => clearTimeout(timer);
  }, [item.id, scrollToBottom]);

  const otherUserId = useMemo(() => item.type === 'dm' ? item.members.find(id => id !== currentUser.uid) || currentUser.uid : null, [item, currentUser.uid]);
  const otherUser = useMemo(() => otherUserId ? memberDetails[otherUserId] : null, [otherUserId, memberDetails]);
  const isOtherUserTyping = item.type === 'dm' && otherUserId ? item.typingStatus?.[otherUserId] === true : false;

  const handleSendMessage = async (customContent?: string, immediateFile?: {file: File, type: 'voice' | 'circle', duration: number}) => {
    const finalContent = customContent !== undefined ? customContent : messageContent;
    const finalFile = immediateFile || fileToSend;
    if ((!finalContent.trim() && !finalFile) || !db) return;
    setIsSending(true);
    const originalContent = finalContent;
    const originalReplyTo = replyToMessage;
    
    let resolvedReplySenderName = originalReplyTo?.senderName || 'User';
    if (originalReplyTo && memberDetails[originalReplyTo.senderId]) {
      resolvedReplySenderName = memberDetails[originalReplyTo.senderId].name;
    }

    setMessageContent(''); setFileToSend(null); setReplyToMessage(null);
    try {
        if (finalFile?.type === 'video') await handleSendVideo(finalFile, originalContent, originalReplyTo, resolvedReplySenderName);
        else if (finalFile?.type === 'voice') await handleSendVoice(finalFile, originalContent, originalReplyTo, finalFile.duration, resolvedReplySenderName);
        else if (finalFile?.type === 'circle') await handleSendCircle(finalFile, originalContent, originalReplyTo, finalFile.duration, resolvedReplySenderName);
        else if (finalFile?.type === 'music') await handleSendMusic(finalFile, originalContent, originalReplyTo, resolvedReplySenderName);
        else if (finalFile?.type === 'file') await handleSendGenericFile(finalFile, originalContent, originalReplyTo, resolvedReplySenderName);
        else await handleSendTextOrImage(finalFile?.previewUrl, originalContent, originalReplyTo, resolvedReplySenderName);
    } catch (error) { console.error(error); setMessageContent(originalContent); setReplyToMessage(originalReplyTo); }
    finally { setIsSending(false); }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!db || !currentUser.uid) return;
    const messageRef = doc(db, 'chats', item.id, 'messages', messageId);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(messageRef);
        if (!snap.exists()) return;
        const reactions = { ...(snap.data().reactions || {}) };
        let existingEmoji: string | null = null;
        for (const [key, uids] of Object.entries(reactions)) { if (uids.includes(currentUser.uid)) { existingEmoji = key; break; } }
        const updates: any = {};
        if (existingEmoji) {
            const newUids = (reactions[existingEmoji] || []).filter(u => u !== currentUser.uid);
            if (newUids.length === 0) updates[`reactions.${existingEmoji}`] = deleteField();
            else updates[`reactions.${existingEmoji}`] = newUids;
            if (existingEmoji === emoji) { transaction.update(messageRef, updates); return; }
        }
        updates[`reactions.${emoji}`] = arrayUnion(currentUser.uid);
        transaction.update(messageRef, updates);
      });
    } catch (e) { console.error("Reaction failed", e); }
  };

  const startRecording = async (type: 'voice' | 'circle') => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'circle' ? { facingMode: 'user', width: 480, height: 480 } : false });
        activeStreamRef.current = stream;
        const options = { mimeType: type === 'voice' ? 'audio/webm' : 'video/webm;codecs=vp8,opus' };
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder; chunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = async () => {
            if (chunksRef.current.length > 0) {
                const blob = new Blob(chunksRef.current, { type: options.mimeType });
                const file = new File([blob], type === 'voice' ? 'voice.webm' : 'circle.webm', { type: blob.type });
                handleSendMessage('', { file, type, duration: recordingDuration });
            }
            if (activeStreamRef.current) { activeStreamRef.current.getTracks().forEach(t => t.stop()); activeStreamRef.current = null; }
        };
        recorder.start();
        if (type === 'voice') setIsRecordingVoice(true); else setIsRecordingCircle(true);
        setRecordingDuration(0); timerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (e) { toast({ variant: 'destructive', title: 'Error', description: t('microphone_error_desc') }); }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { mediaRecorderRef.current.stop(); }
    setIsRecordingVoice(false); setIsRecordingCircle(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!db) return;
    try { await deleteDoc(doc(db, 'chats', item.id, 'messages', messageId)); toast({ title: t('dm_success') }); } catch (e) { console.error("Delete failed", e); }
  };

  const handleSendVoice = async (p: any, c: string, r: any, d: number, sname: string) => {
    if (!db) return;
    const mref = doc(collection(db, 'chats', item.id, 'messages'));
    const ts = Timestamp.now();
    const data = { senderId: currentUser.uid, content: c, timestamp: ts, voiceMimeType: p.file.type, voiceStatus: 'uploading', voiceDuration: d, readBy: [], senderName: currentUser.name || currentUser.username, ...(r && { replyTo: { messageId: r.id, content: r.content, senderName: sname } }) };
    const batch = writeBatch(db);
    batch.set(mref, data);
    batch.update(doc(db, 'chats', item.id), { lastMessage: { id: mref.id, content: t('voice_message_short'), senderId: currentUser.uid, senderName: currentUser.name || currentUser.username, timestamp: ts } });
    await batch.commit();
    const b64 = await new Promise<string>(res => { const reader = new FileReader(); reader.readAsDataURL(p.file); reader.onload = () => res((reader.result as string).split(',')[1]); });
    const cids: string[] = [];
    for (let i = 0; i < b64.length; i += 900*1024) { const cref = doc(collection(db, 'voiceChunks')); await setDoc(cref, { data: b64.substring(i, i + 900*1024), part: i/(900*1024), senderId: currentUser.uid }); cids.push(cref.id); }
    await updateDoc(mref, { voiceStatus: 'complete', voiceChunkIds: cids }); await cacheFile(mref.id, p.file);
  };

  const handleSendCircle = async (p: any, c: string, r: any, d: number, sname: string) => {
    if (!db) return;
    const mref = doc(collection(db, 'chats', item.id, 'messages'));
    const ts = Timestamp.now();
    const data = { senderId: currentUser.uid, content: c, timestamp: ts, circleMimeType: p.file.type, circleStatus: 'uploading', circleDuration: d, readBy: [], senderName: currentUser.name || currentUser.username, ...(r && { replyTo: { messageId: r.id, content: r.content, senderName: sname } }) };
    const batch = writeBatch(db);
    batch.set(mref, data);
    batch.update(doc(db, 'chats', item.id), { lastMessage: { id: mref.id, content: t('video_attachment_placeholder'), senderId: currentUser.uid, senderName: currentUser.name || currentUser.username, timestamp: ts } });
    await batch.commit();
    const b64 = await new Promise<string>(res => { const reader = new FileReader(); reader.readAsDataURL(p.file); reader.onload = () => res((reader.result as string).split(',')[1]); });
    const cids: string[] = [];
    for (let i = 0; i < b64.length; i += 900*1024) { const cref = doc(collection(db, 'circleChunks')); await setDoc(cref, { data: b64.substring(i, i + 900*1024), part: i/(900*1024), senderId: currentUser.uid }); cids.push(cref.id); }
    await updateDoc(mref, { circleStatus: 'complete', circleChunkIds: cids }); await cacheFile(mref.id, p.file);
  };

  const handleSendTextOrImage = async (i: any, c: string, r: any, sname: string) => {
    if (!db) return;
    const ts = Timestamp.now();
    const mref = doc(collection(db, 'chats', item.id, 'messages'));
    const data = { senderId: currentUser.uid, content: c.trim(), timestamp: ts, type: 'user', readBy: [], senderName: currentUser.name || currentUser.username, ...(i && { imageUrl: i }), ...(r && { replyTo: { messageId: r.id, content: r.content, senderName: sname } }) };
    const batch = writeBatch(db);
    batch.set(mref, data);
    const upd: any = { lastMessage: { id: mref.id, content: c.trim() || (i ? t('image_attachment_placeholder') : ''), senderId: currentUser.uid, senderName: currentUser.name || currentUser.username, timestamp: ts } };
    if (item.type !== 'channel') item.members.forEach(id => { if (id !== currentUser.uid) upd[`unreadCounts.${id}`] = increment(1); });
    batch.update(doc(db, 'chats', item.id), upd);
    await batch.commit(); if (i) fetchAndCacheImage(mref.id, i);
  };

  const handleSendVideo = async (p: any, c: string, r: any, sname: string) => {
    if (!db) return;
    const mref = doc(collection(db, 'chats', item.id, 'messages'));
    const ts = Timestamp.now();
    const data = { senderId: currentUser.uid, content: c, timestamp: ts, videoMimeType: p.file.type, videoStatus: 'uploading', readBy: [], senderName: currentUser.name || currentUser.username, ...(r && { replyTo: { messageId: r.id, content: r.content, senderName: sname } }) };
    const batch = writeBatch(db);
    batch.set(mref, data);
    batch.update(doc(db, 'chats', item.id), { lastMessage: { id: mref.id, content: c || t('video_attachment_placeholder'), senderId: currentUser.uid, senderName: currentUser.name || currentUser.username, timestamp: ts } });
    await batch.commit();
    const b64 = await new Promise<string>(res => { const reader = new FileReader(); reader.readAsDataURL(p.file); reader.onload = () => res((reader.result as string).split(',')[1]); });
    const cids: string[] = [];
    for (let i = 0; i < b64.length; i += 900*1024) { const cref = doc(collection(db, 'videoChunks')); await setDoc(cref, { data: b64.substring(i, i + 900*1024), part: i/(900*1024), senderId: currentUser.uid }); cids.push(cref.id); }
    await updateDoc(mref, { videoStatus: 'complete', videoChunkIds: cids }); await cacheFile(mref.id, p.file);
  };

  const handleSendMusic = async (p: any, c: string, r: any, sname: string) => {
    if (!db) return;
    const mref = doc(collection(db, 'chats', item.id, 'messages'));
    const ts = Timestamp.now();
    const data = { senderId: currentUser.uid, content: c, timestamp: ts, fileName: p.file.name, musicMimeType: p.file.type, musicStatus: 'uploading', readBy: [], senderName: currentUser.name || currentUser.username, ...(r && { replyTo: { messageId: r.id, content: r.content, senderName: sname } }) };
    const batch = writeBatch(db);
    batch.set(mref, data);
    batch.update(doc(db, 'chats', item.id), { lastMessage: { id: mref.id, content: c || t('music_attachment_placeholder'), senderId: currentUser.uid, senderName: currentUser.name || currentUser.username, timestamp: ts } });
    await batch.commit();
    const b64 = await new Promise<string>(res => { const reader = new FileReader(); reader.readAsDataURL(p.file); reader.onload = () => res((reader.result as string).split(',')[1]); });
    const cids: string[] = [];
    for (let i = 0; i < b64.length; i += 900*1024) { const cref = doc(collection(db, 'musicChunks')); await setDoc(cref, { data: b64.substring(i, i + 900*1024), part: i/(900*1024), senderId: currentUser.uid }); cids.push(cref.id); }
    await updateDoc(mref, { musicStatus: 'complete', musicChunkIds: cids }); await cacheFile(mref.id, p.file);
  };

  const handleSendGenericFile = async (p: any, c: string, r: any, sname: string) => {
    if (!db) return;
    const mref = doc(collection(db, 'chats', item.id, 'messages'));
    const ts = Timestamp.now();
    const data = { senderId: currentUser.uid, content: c, timestamp: ts, fileName: p.file.name, fileMimeType: p.file.type, fileSize: p.file.size, fileStatus: 'uploading', readBy: [], senderName: currentUser.name || currentUser.username, ...(r && { replyTo: { messageId: r.id, content: r.content, senderName: sname } }) };
    const batch = writeBatch(db);
    batch.set(mref, data);
    batch.update(doc(db, 'chats', item.id), { lastMessage: { id: mref.id, content: c || t('file_attachment_placeholder'), senderId: currentUser.uid, senderName: currentUser.name || currentUser.username, timestamp: ts } });
    await batch.commit();
    const b64 = await new Promise<string>(res => { const reader = new FileReader(); reader.readAsDataURL(p.file); reader.onload = () => res((reader.result as string).split(',')[1]); });
    const cids: string[] = [];
    for (let i = 0; i < b64.length; i += 900*1024) { const cref = doc(collection(db, 'fileChunks')); await setDoc(cref, { data: b64.substring(i, i + 900*1024), part: i/(900*1024), senderId: currentUser.uid }); cids.push(cref.id); }
    await updateDoc(mref, { fileStatus: 'complete', fileChunkIds: cids }); await cacheFile(mref.id, p.file);
  };

  const handleInternalLinkClick = async (href: string) => {
    if (!db || !currentUser) return;
    try {
        const lowerHref = href.toLowerCase();
        if (lowerHref.startsWith('/iv/v/')) { const vid = href.substring(6); if (vid) window.dispatchEvent(new CustomEvent('open-infvid', { detail: { videoId: vid } })); return; }
        let target: Chat | null = null;
        if (href.startsWith('@')) {
            const snap = await getDoc(doc(db, 'usernames', href));
            if (snap.exists()) {
                const uid = snap.data().uid; const mem = [currentUser.uid, uid].sort();
                const cid = uid === currentUser.uid ? currentUser.uid : mem.join('_');
                const csnap = await getDoc(doc(db, 'chats', cid));
                if (csnap.exists()) target = { id: csnap.id, ...csnap.data() } as Chat;
                else { await setDoc(doc(db, 'chats', cid), { type: 'dm', members: mem, icon: uid === currentUser.uid ? 'Bookmark' : null }); target = { id: cid, type: 'dm', members: mem, icon: uid === currentUser.uid ? 'Bookmark' : null } as Chat; }
            }
        } else if (lowerHref.startsWith('/g/') || lowerHref.startsWith('/c/')) {
            const linkRef = doc(db, 'chatLinks', encodeURIComponent((lowerHref.startsWith('/g/') ? '/G/' : '/C/') + href.substring(3)));
            const linkSnap = await getDoc(linkRef);
            if (linkSnap.exists()) { const csnap = await getDoc(doc(db, 'chats', linkSnap.data().chatId)); if (csnap.exists()) target = { id: csnap.id, ...csnap.data() } as Chat; }
        }
        if (target) {
            const iconName = (target.icon === 'Drum' || target.name === 'Infinite') ? 'Bot' : target.icon as any;
            onSelectChat({ ...target, iconComponent: iconName ? iconMap[iconName as keyof typeof iconMap] : undefined } as PopulatedChat);
        }
    } catch (e) { console.error(e); }
  };

  const getChatIcon = () => {
    if (item.id === 'GENERAL_CHAT') return <Globe className="h-5 w-5" />;
    if (item.name === 'Infinite' || item.icon === 'Bot' || item.link === '/B/Infinite') return <Bot className="h-5 w-5" />;
    if (item.type === 'channel') return <Megaphone className="h-5 w-5" />;
    if (item.type === 'group') return <Users className="h-5 w-5" />;
    return <UserIcon className="h-5 w-5" />;
  };

  const isSavedMessages = item.type === 'dm' && item.id === currentUser.uid;

  return (
    <div className={cn("relative flex flex-col h-full bg-background overflow-hidden", isMobile ? 'w-screen' : 'w-full')}>
      {(isRecordingVoice || isRecordingCircle) && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-300 pointer-events-none">
            <div className="bg-card border-2 border-primary/30 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    <div className="relative bg-primary text-primary-foreground p-6 rounded-full shadow-lg">{isRecordingCircle ? <Camera className="h-10 w-10" /> : <Mic className="h-10 w-10" />}</div>
                </div>
                <div className="text-center space-y-2">
                    <div className="text-4xl font-black font-mono tracking-tighter text-primary">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</div>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t('is_recording_locked_placeholder')}</p>
                </div>
            </div>
        </div>
      )}

      <header className={cn("flex-shrink-0 flex flex-col border-b pt-[calc(0.5rem+env(safe-area-inset-top))] bg-background sticky top-0 z-30", colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background')}>
        <div className="flex items-center p-2 h-14">
            <Button variant="ghost" size="icon" onClick={onClose} className="mr-2 shrink-0"><X className="h-5 w-5" /></Button>
            <div className="flex-1 flex items-center min-w-0 overflow-hidden h-12">
                <button className="flex items-center text-left hover:bg-accent px-3 py-1 rounded-md transition-colors min-w-0 flex-1 overflow-hidden h-full disabled:cursor-default" onClick={() => { if (isSavedMessages || item.id === 'GENERAL_CHAT') return; if (item.type === 'dm') setProfileDialogUser(otherUser); else setShowChatProfile(true); }} disabled={isSavedMessages || item.id === 'GENERAL_CHAT'}>
                    <div className='shrink-0 h-10 w-10'>{item.type === 'dm' ? <UserAvatarWithStatus user={otherUser} isSavedMessages={isSavedMessages} isSelected={true} /> : <Avatar className="h-10 w-10"><AvatarImage src={item.avatar} /><AvatarFallback>{getChatIcon()}</AvatarFallback></Avatar>}</div>
                    <div className="ml-3 min-w-0 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 min-0"><h2 className="text-lg font-semibold font-headline truncate leading-none">{isSavedMessages ? t('saved_messages') : (item.id === 'GENERAL_CHAT' ? t('general_chat') : (item.type === 'dm' ? (otherUser?.name || t('direct_message_tab')) : item.name))}</h2>{(item.link === '/G/Infinite' || item.link === '/C/Infinite') && <VerifiedBadge className="shrink-0" />}</div>
                        {!isSavedMessages && <div className="text-sm text-muted-foreground truncate h-5 mt-1 leading-none">{item.type === 'dm' ? (isOtherUserTyping ? <span className="text-primary font-bold animate-pulse">{t('searching')}</span> : (otherUser?.isBot ? <span className="font-bold text-primary">{t('bot_status')}</span> : (otherUser?.status === 'online' ? t('online') : (otherUser?.lastSeen ? `${t('was_online')} ${format(getSafeDate(otherUser.lastSeen), 'dd.MM, HH:mm')}` : t('offline'))))) : (item.id === 'GENERAL_CHAT' ? t('public_chat_description') : t(item.type === 'channel' ? 'subscribers_count' : 'members_count', { count: item.members?.length || 0 }))}</div>}
                    </div>
                </button>
            </div>
            <div className="flex items-center gap-1 ml-2 shrink-0">{item.type === 'dm' && !isSavedMessages && otherUser && !otherUser.isBot && <><Phone className="h-5 w-5 cursor-pointer hover:text-primary ml-2" onClick={() => window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: item, otherUser, isVideo: false } }))} /><Video className="h-5 w-5 cursor-pointer hover:text-primary ml-2" onClick={() => window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: item, otherUser, isVideo: true } }))} /></>}{item.id !== 'GENERAL_CHAT' && (
                    <DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 ml-1"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-xl">{item.id !== currentUser.uid && <DropdownMenuItem onSelect={() => setShowChatProfile(true)}><Info className="mr-2 h-4 w-4" /><span>{t('info')}</span></DropdownMenuItem>}<DropdownMenuItem onSelect={() => setShowClearConfirm(true)}><Trash className="mr-2 h-4 w-4" /><span>{t('clear_history')}</span></DropdownMenuItem>{item.id !== currentUser.uid && <><DropdownMenuSeparator />{item.ownerId === currentUser.uid || item.type === 'dm' ? <DropdownMenuItem onSelect={() => setShowDeleteConfirm(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>{t('delete_chat')}</span></DropdownMenuItem> : <DropdownMenuItem onSelect={() => setShowLeaveConfirm(true)} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /><span>{t('leave')}</span></DropdownMenuItem>}</>}</DropdownMenuContent></DropdownMenu>
                )}
            </div>
        </div>
      </header>

      <div className="relative flex-1 bg-background overflow-hidden min-h-0">
          <div ref={scrollContainerRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto px-2 md:px-4 flex flex-col overscroll-behavior-y-contain">
              {messagesLoading && messageLimit === 50 ? <div className="flex h-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div> : messages && messages.length > 0 ? (
                  <div ref={listInnerRef} className="space-y-1.5 py-2 flex flex-col min-h-full"><div className="flex-1" />
                      {messages.map((m, i) => {
                          const sd = getSafeDate(m.timestamp);
                          const showSep = !i || !isSameDay(sd, getSafeDate(messages[i-1].timestamp));
                          return <React.Fragment key={m.id}>{showSep && <DateSeparator date={format(sd, 'dd.MM.yyyy')} />}<ChatMessage message={m} sender={memberDetails[m.senderId]} isCurrentUser={m.senderId === currentUser.uid} chatType={item.type} onAvatarClick={setProfileDialogUser} chat={item} currentUser={currentUser} onInternalLinkClick={handleInternalLinkClick} onReply={setReplyToMessage} setEditingMessage={setEditingMessage} onMediaLoad={handleMediaLoad} onPreviewImage={setPreviewImage} onForward={setForwardingMessage} onVote={() => {}} onDelete={handleDeleteMessage} onToggleReaction={handleToggleReaction} isMobile={isMobile} isActiveOnMobile={activeMessageId === m.id} onToggleActiveOnMobile={() => setActiveMessageId(p => p === m.id ? null : m.id)} memberDetails={memberDetails} /></React.Fragment>;
                      })}
                      <div ref={messagesEndRef} className="h-px shrink-0" /></div>
              ) : <div className="flex h-full flex-col items-center justify-center text-muted-foreground p-4">{isMember ? <p>{t('no_messages_yet')}</p> : <><Users className="h-16 w-16 mb-4 opacity-50" /><h3 className="text-xl font-semibold">{t('you_left_the_group')}</h3></>}</div>}
          </div>
          {stickyDate && <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none"><Badge variant="secondary" className="opacity-90">{stickyDate}</Badge></div>}
      </div>

      {isMember && <footer className={cn("flex-shrink-0 p-2 md:p-3 border-t bg-background h-auto flex items-center pb-[calc(0.5rem+env(safe-area-inset-bottom))]", colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background')}><div className="max-w-3xl mx-auto w-full h-full flex items-center">
            {(item.type === 'channel' && item.ownerId !== currentUser.uid) ? <div className="flex items-center justify-center w-full h-full"><Button variant="ghost" className="w-full h-full rounded-xl font-bold gap-2 text-primary" onClick={() => setIsMutedLocal(!isMutedLocal)}>{isMutedLocal ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}{isMutedLocal ? t('unmute') : t('mute')}</Button></div> : <div className="flex flex-col gap-2 w-full">
                  {replyToMessage && <div className="flex items-center justify-between bg-muted p-2 rounded-md"><div className="flex items-center gap-2 min-0"><Reply className="h-4 w-4 text-primary shrink-0" /><div className="min-w-0"><div className="text-xs font-bold text-primary truncate">{replyToMessage.senderName || memberDetails[replyToMessage.senderId]?.name || 'User'}</div><div className="text-xs text-muted-foreground truncate">{replyToMessage.content}</div></div></div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyToMessage(null)}><X className="h-4 w-4" /></Button></div>}
                  {editingMessage && <div className="flex items-center justify-between bg-muted p-2 rounded-md"><div className="flex items-center gap-2 min-0"><Edit className="h-4 w-4 text-primary shrink-0" /><div className="min-w-0"><div className="text-xs font-bold text-primary">{t('editing_message')}</div><div className="text-xs text-muted-foreground truncate">{editingMessage.content}</div></div></div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingMessage(null)}><X className="h-4 w-4" /></Button></div>}
                  {fileToSend && <div className="flex items-center justify-between bg-muted p-2 rounded-md"><div className="flex items-center gap-2 min-0">{fileToSend.type === 'image' ? <ImageIcon className="h-4 w-4 text-primary" /> : fileToSend.type === 'video' ? <VideoIcon className="h-4 w-4 text-primary" /> : fileToSend.type === 'music' ? <MusicIcon className="h-4 w-4 text-primary" /> : <FileIcon className="h-4 w-4 text-primary" />}<div className="min-w-0"><div className="text-xs font-bold text-primary">{fileToSend.file.name || t('image_attachment_alt')}</div></div></div><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFileToSend(null)}><X className="h-4 w-4" /></Button></div>}
                  <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-end gap-2 relative w-full"><div className="relative flex-1"><Textarea placeholder={item.type === 'channel' ? t('publish_placeholder') : t('message_placeholder')} value={messageContent} onChange={(e) => setMessageContent(e.target.value)} onKeyDown={(e) => { if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} className="min-h-[38px] h-[38px] max-h-32 resize-none bg-muted/50 border-none rounded-2xl" /></div><div className="flex items-center gap-1 shrink-0 h-[38px]"><DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-9 w-9"><Paperclip className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" side="top" className="w-48 rounded-xl"><DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center py-2 border-b">{t('max_file_size_label', { size: maxSizeText })}</DropdownMenuLabel><DropdownMenuItem onSelect={() => fileInputRef.current?.click()} className="py-2"><ImageIcon className="mr-2 h-4 w-4 text-blue-500" /> {t('photo')}</DropdownMenuItem><DropdownMenuItem onSelect={() => {}} className="py-2"><VideoIcon className="mr-2 h-4 w-4 text-orange-500" /> {t('video')}</DropdownMenuItem><DropdownMenuItem onSelect={() => {}} className="py-2"><MusicIcon className="mr-2 h-4 w-4 text-purple-500" /> {t('music')}</DropdownMenuItem><DropdownMenuItem onSelect={() => {}} className="py-2"><FileIcon className="mr-2 h-4 w-4 text-green-500" /> {t('file')}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setShowNewPoll(true)} className="py-2"><ListTodo className="mr-2 h-4 w-4 text-teal-500" /> {t('poll')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu><input type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files?.[0]) { const f = e.target.files[0]; if (f.size > maxFileSizeInBytes) { toast({ variant: 'destructive', title: t('file_too_large', { size: maxSizeText }) }); return; } compressImage(f).then(p => setFileToSend({ file: f, previewUrl: p, type: 'image' })); } }} className="hidden" />{(messageContent.trim() || fileToSend) ? <Button type="submit" size="icon" disabled={isSending} className="h-9 w-9 rounded-full"><Send className="h-5 w-5" /></Button> : <div className="flex items-center gap-1"><Button type="button" size="icon" variant="ghost" className={cn("h-9 w-9 rounded-full touch-none", isRecordingVoice && "text-primary animate-pulse")} onPointerDown={() => startRecording('voice')} onPointerUp={stopRecording} onPointerLeave={stopRecording}><Mic className="h-5 w-5" /></Button><Button type="button" size="icon" variant="ghost" className={cn("h-9 w-9 rounded-full touch-none", isRecordingCircle && "text-primary animate-pulse")} onPointerDown={() => startRecording('circle')} onPointerUp={stopRecording} onPointerLeave={stopRecording}><Camera className="h-5 w-5" /></Button></div>}</div></form></div>}
          </div></footer>}

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}><AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t('clear_history')}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => {}} className="rounded-xl bg-destructive">{t('delete')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}><AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t('delete_chat_confirm')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => {}} className="rounded-xl bg-destructive">{t('delete')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}><AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t(item.type === 'group' ? 'leave_group_confirm' : 'leave_channel_confirm')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => {}} className="rounded-xl bg-destructive">{t('delete')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      {profileDialogUser && <UserProfileDialog user={profileDialogUser} open={!!profileDialogUser} onOpenChange={(open) => !open && setProfileDialogUser(null)} onSendMessage={() => {}} />}
      {showChatProfile && <ChatProfileDialog chat={item} members={Object.values(memberDetails).filter(m => item.members.includes(m.id))} currentUser={currentUser} open={showChatProfile} onOpenChange={setShowChatProfile} onCloseChat={onClose} onJoinDiscussion={() => {}} />}
      <NewPollDialog open={showNewPoll} onOpenChange={setShowNewPoll} onSubmit={(poll) => { if (!db) return; addDoc(collection(db, 'chats', item.id, 'messages'), { senderId: currentUser.uid, timestamp: Timestamp.now(), poll, readBy: [], senderName: currentUser.name || currentUser.username }); }} />
      <ForwardMessageDialog open={!!forwardingMessage} onOpenChange={(open) => !open && setForwardingMessage(null)} onForward={(cid) => { 
          if (!db || !forwardingMessage) return; 
          const { id: _, ...messageData } = forwardingMessage; 
          addDoc(collection(db, 'chats', cid, 'messages'), { 
              ...messageData, 
              senderId: currentUser.uid, 
              timestamp: Timestamp.now(), 
              readBy: [],
              senderName: currentUser.name || currentUser.username
          }); 
          toast({ title: t('message_forwarded_success') }); 
      }} currentUser={currentUser} />
    </div>
  );
}

function ChatMessage({ message, sender, isCurrentUser, chatType, onAvatarClick, chat, currentUser, onInternalLinkClick, onReply, setEditingMessage, onMediaLoad, onPreviewImage, onForward, onVote, onDelete, onToggleReaction, isMobile, isActiveOnMobile, onToggleActiveOnMobile, memberDetails }: { message: Message, sender?: User, isCurrentUser: boolean, chatType: PopulatedChat['type'], onAvatarClick: (user: User) => void, chat: PopulatedChat, currentUser: AuthenticatedUser, onInternalLinkClick: (href: string) => Promise<void>, onReply: (message: Message) => void, setEditingMessage: (message: Message | null) => void, onMediaLoad: () => void; onPreviewImage: (url: string) => void; onForward: (message: Message) => void; onVote: (index: number) => void; onDelete: (id: string) => void; onToggleReaction: (msgId: string, emoji: string) => void; isMobile: boolean; isActiveOnMobile?: boolean; onToggleActiveOnMobile?: () => void; memberDetails: Record<string, User> }) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const db = useFirestore(); 
    const { experimentalDesign } = useTheme();
    const alignRight = isCurrentUser && message.type !== 'announcement' && chatType !== 'channel';
    const isOfficialBotChat = chat.link === '/B/Infinite' || chat.name === 'Infinite';
    const showSenderAvatar = chatType !== 'channel' && !isOfficialBotChat && ((chatType === 'group' && !isCurrentUser) || (message.type === 'announcement' && chatType !== 'dm'));

    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const circleVideoRef = useRef<HTMLVideoElement>(null);
    const [hasUnmutedCircle, setHasUnmutedCircle] = useState(false);
    const [isUserActive, setIsUserActive] = useState(false);

    const isRead = useMemo(() => {
        if (!isCurrentUser || !message.readBy) return false;
        if (chatType === 'dm') { const otherId = chat.members.find(id => id !== currentUser.uid); return otherId ? message.readBy.includes(otherId) : false; }
        return message.readBy.some(id => id !== currentUser.uid);
    }, [isCurrentUser, message.readBy, chat.members, chatType, currentUser.uid]);

    useEffect(() => {
        const loadMedia = async () => {
            const cached = await getCachedFile(message.id);
            if (cached) {
                setMediaUrl(cached);
                requestAnimationFrame(() => { onMediaLoad(); });
                return;
            }
            if (!db) return;
            if (message.videoStatus === 'complete' || message.musicStatus === 'complete' || message.voiceStatus === 'complete' || message.circleStatus === 'complete' || message.fileStatus === 'complete') {
                try {
                    const col = message.videoStatus === 'complete' ? 'videoChunks' : message.musicStatus === 'complete' ? 'musicChunks' : message.voiceStatus === 'complete' ? 'voiceChunks' : message.circleStatus === 'complete' ? 'circleChunks' : 'fileChunks';
                    const chunkIds = message.videoChunkIds || message.musicChunkIds || message.voiceChunkIds || message.circleChunkIds || message.fileChunkIds || [];
                    const chunkSnaps = await Promise.all(chunkIds.map(id => getDoc(doc(db, col, id))));
                    const chunksData = chunkSnaps.map(s => s.data() as { part: number, data: string });
                    chunksData.sort((a, b) => a.part - b.part);
                    const assembled = chunksData.map(c => c.data).join('');
                    const mime = message.videoMimeType || message.musicMimeType || message.voiceMimeType || message.circleMimeType || message.fileMimeType || 'application/octet-stream';
                    const dataUrl = `data:${mime};base64,${assembled}`;
                    await cacheFile(message.id, dataUrl);
                    const finalUrl = await getCachedFile(message.id);
                    if (finalUrl) { setMediaUrl(finalUrl); requestAnimationFrame(() => { onMediaLoad(); }); }
                } catch (e) { console.error("Media failed", e); }
            }
        };
        loadMedia();
    }, [message.id, db, onMediaLoad, message.videoStatus, message.musicStatus, message.voiceStatus, message.circleStatus, message.fileStatus]);

    useEffect(() => {
        if (circleVideoRef.current && mediaUrl && message.circleStatus === 'complete' && !isUserActive) {
            circleVideoRef.current.muted = true;
            circleVideoRef.current.play().catch(() => {});
        }
    }, [mediaUrl, message.circleStatus, isUserActive]);

    const handleCircleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (circleVideoRef.current) {
            window.dispatchEvent(new CustomEvent('stop-media', { detail: { id: message.id } }));
            circleVideoRef.current.currentTime = 0; setIsUserActive(true);
            if (!hasUnmutedCircle) { circleVideoRef.current.muted = false; setHasUnmutedCircle(true); }
            circleVideoRef.current.play();
        }
    };

    const handleSaveToDevice = async () => {
      if (!mediaUrl) return;
      if (Capacitor.isNativePlatform()) {
        try {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const cleanBase64 = mediaUrl.split(',')[1];
          const ext = message.imageUrl ? 'jpg' : message.videoStatus ? 'mp4' : message.musicStatus ? 'mp3' : 'bin';
          const fileName = `Infinite_${message.id}.${ext}`;
          
          await Filesystem.writeFile({
            path: fileName,
            data: cleanBase64,
            directory: Directory.Documents,
          });
          toast({ title: t('dm_success'), description: t('save_to_device') });
        } catch (e) {
          console.error(e);
          toast({ variant: 'destructive', title: 'Error', description: "Failed to save file." });
        }
      } else {
        const link = document.createElement('a');
        link.href = mediaUrl;
        link.download = message.fileName || `Infinite_${message.id}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: t('dm_success') });
      }
    };

    const isCircleOnly = message.circleStatus === 'complete' && !message.content;
    const canCopy = message.content && !message.poll;
    const canEdit = isCurrentUser && !message.poll && !message.voiceStatus && !message.circleStatus;
    
    const isAdmin = currentUser.username === '@Infinite';
    const isSender = isCurrentUser;
    const isOwner = chat.ownerId === currentUser.uid;
    const isTargetAdmin = sender?.username === '@Infinite';
    const canDelete = isAdmin || (!isTargetAdmin && (isSender || isOwner || chat.type === 'dm'));

    const hasSaveableMedia = (message.imageUrl || message.videoStatus === 'complete' || message.musicStatus === 'complete' || message.fileStatus === 'complete') && !message.voiceStatus && !message.circleStatus;

    return (
        <div id={`message-${message.id}`} className={cn("group flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300", alignRight ? "flex-row-reverse outgoing-msg" : "flex-row incoming-msg")} onClick={() => isMobile && onToggleActiveOnMobile?.()}>
            {showSenderAvatar ? (
                 <div className="w-10 h-10 flex-shrink-0"><button onClick={() => sender && onAvatarClick(sender)} disabled={isCurrentUser || (sender && !!sender.isDeleted)}><UserAvatarWithStatus user={message.type === 'announcement' ? { id: 'bot', name: message.senderName || 'Infinite', avatar: message.senderAvatar, isBot: true } as any : sender!} /></button></div>
            ) : (chatType === 'group' && !alignRight && !isOfficialBotChat) ? <div className="w-10 flex-shrink-0" /> : null}

            <div className={cn("min-w-0 flex flex-col relative transition-all duration-300 max-w-[75%] md:max-w-[60%]", !isCircleOnly && (alignRight ? "bg-primary text-white rounded-lg px-2 pb-1 rounded-br-none pt-1.5" : "bg-card text-card-foreground rounded-lg px-2 pb-1 rounded-bl-none pt-1.5"))}>
                {message.replyTo && (
                    <div onClick={(e) => { e.stopPropagation(); document.getElementById(`message-${message.replyTo!.messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className={cn("mb-1.5 p-1.5 border-l-4 rounded-r-md cursor-pointer transition-colors max-w-full overflow-hidden", alignRight ? "bg-black/10 border-white/50 hover:bg-black/20" : "bg-primary/5 border-primary hover:bg-primary/10")}>
                        <p className={cn("text-[10px] font-bold truncate", alignRight ? "text-white" : "text-primary")}>{message.replyTo.senderName}</p>
                        <p className={cn("text-[11px] truncate line-clamp-1 opacity-80 italic", alignRight ? "text-white" : "text-muted-foreground")}>{message.replyTo.content}</p>
                    </div>
                )}
                {((chatType === 'group' && !isCurrentUser) || chatType === 'channel' || message.type === 'announcement') && (<div className="font-semibold text-[13px] flex items-center gap-2 mb-0"><span className="truncate">{message.type === 'announcement' ? (message.senderName || 'Infinite') : (sender?.isDeleted ? t('deleted_account') : sender?.name)}</span>{sender?.username === '@InfiniteBot' && <VerifiedBadge className='w-3 h-3 shrink-0' />}</div>)}
                {message.imageUrl && (<div className={cn("w-full flex mb-1", alignRight ? "justify-end" : "justify-start")}><img src={message.imageUrl} onClick={() => onPreviewImage(message.imageUrl!)} className="max-w-full max-h-[320px] w-auto object-contain rounded-lg cursor-pointer" onLoad={onMediaLoad} /></div>)}
                {message.videoStatus === 'complete' && mediaUrl && (<div className="pt-1"><video src={mediaUrl} controls className="max-w-full rounded-lg" onLoadedData={onMediaLoad} /></div>)}
                {message.circleStatus === 'complete' && mediaUrl && (<div className={cn("rounded-full overflow-hidden border-2 border-primary/20 bg-black aspect-square shrink-0 cursor-pointer shadow-lg", isCircleOnly ? "w-40 h-40" : "w-40 h-40 mt-1")} onClick={handleCircleClick}><video ref={circleVideoRef} src={mediaUrl} loop muted playsInline className="w-full h-full object-cover" onLoadedData={onMediaLoad} /></div>)}
                {(message.musicStatus === 'complete' || message.voiceStatus === 'complete') && mediaUrl && (<div className="pt-1"><CustomAudioPlayer src={mediaUrl} isMusic={!!message.musicStatus} fileName={message.fileName} messageId={message.id} onMediaLoad={onMediaLoad} /></div>)}
                {message.poll && <PollDisplay poll={message.poll} onVote={onVote} currentUserId={currentUser.uid} alignRight={alignRight} memberDetails={memberDetails} />}
                {message.content && !message.poll && <div className={cn("text-sm break-words whitespace-pre-wrap pt-0")}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({node, ...p}) => <a onClick={(e) => { if (p.href?.startsWith('@') || p.href?.startsWith('/')) { e.preventDefault(); onInternalLinkClick(p.href); } }} className={cn("underline font-bold", alignRight ? "text-white" : "text-primary")} target={p.href?.startsWith('http') ? "_blank" : undefined}>{p.children}</a> }}>{message.content}</ReactMarkdown></div>}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className={cn("flex flex-wrap gap-1.5 mt-2", alignRight ? "justify-end" : "justify-start")}>
                        {Object.entries(message.reactions).map(([emoji, uids]) => { 
                            if (uids.length === 0) return null;
                            const hasReacted = uids.includes(currentUser.uid); 
                            const isChannel = chatType === 'channel';
                            return (
                                <button key={emoji} onClick={(e) => { e.stopPropagation(); onToggleReaction(message.id, emoji); }} className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-black border transition-all active:scale-90", hasReacted ? "bg-white/20 border-white/50 text-white" : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted", alignRight && !isChannel && "text-white border-white/30")}>
                                    <span>{emoji}</span>
                                    {isChannel ? (
                                        <span className={cn(alignRight && "text-white")}>{uids.length}</span>
                                    ) : (
                                        <div className="flex -space-x-1.5 items-center">
                                            {uids.slice(0, 4).map((uid) => {
                                                const reactor = memberDetails[uid];
                                                return (
                                                    <Avatar key={uid} className="h-4 w-4 border-2 border-background ring-1 ring-border/20 shrink-0">
                                                        <AvatarImage src={reactor?.avatar} />
                                                        <AvatarFallback className="text-[6px] font-black">{reactor?.name?.charAt(0) || '?'}</AvatarFallback>
                                                    </Avatar>
                                                );
                                            })}
                                            {uids.length > 4 && <span className={cn("ml-1.5 text-[9px] font-black opacity-80", alignRight && "text-white")}>+{uids.length - 4}</span>}
                                        </div>
                                    )}
                                </button>
                            ); 
                        })}
                    </div>
                )}
                <div className={cn("flex items-center gap-1 mt-0.5 text-[9px] self-end opacity-70", isCircleOnly && "bg-black/40 text-white rounded-full px-2 py-0.5 mt-2 absolute bottom-2 right-2 shadow-sm")}>{message.editedAt && <span className="font-bold">{t('edited')}</span>}<span>{format(getSafeDate(message.timestamp), 'HH:mm')}</span>{isCurrentUser && (<span className="ml-0.5">{isRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}</span>)}</div>
            </div>

            <div className={cn("flex-shrink-0 self-center w-8 flex justify-center transition-all", isMobile ? (isActiveOnMobile ? "opacity-100" : "opacity-0 pointer-events-none") : "opacity-0 group-hover:opacity-100", !alignRight && "order-last")}>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    {experimentalDesign ? (
                      <DropdownMenuContent align={alignRight ? 'end' : 'start'} className="w-48 p-1 shadow-2xl border-none rounded-2xl animate-in zoom-in-95 duration-200">
                          <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="h-10 rounded-xl"><SmilePlus className="mr-3 h-4 w-4 text-primary" /><span>{t('reactions')}</span></DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                  <DropdownMenuSubContent className="p-1.5 w-52 border-none shadow-2xl rounded-2xl max-h-[70svh] overflow-y-auto">
                                      <div className="grid grid-cols-5 gap-0.5">
                                          {COMMON_EMOJIS.map(emoji => { 
                                              const sel = message.reactions?.[emoji]?.includes(currentUser.uid); 
                                              return (<button key={emoji} onClick={() => { onToggleReaction(message.id, emoji); }} className={cn("h-9 w-9 flex items-center justify-center transition-all active:scale-125 hover:bg-primary/10 rounded-lg text-lg", sel && "bg-primary/20 scale-110 shadow-inner")}>{emoji}</button>); 
                                          })}
                                      </div>
                                  </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuItem onSelect={() => onReply(message)} className="h-10 rounded-xl"><Reply className="mr-3 h-4 w-4" /><span>{t('reply')}</span></DropdownMenuItem>
                          {canCopy && <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(message.content); toast({ title: t('copy_success_toast') }); }} className="h-10 rounded-xl"><Copy className="mr-3 h-4 w-4" /><span>{t('copy_text')}</span></DropdownMenuItem>}
                          {hasSaveableMedia && <DropdownMenuItem onSelect={handleSaveToDevice} className="h-10 rounded-xl"><Save className="mr-3 h-4 w-4" /><span>{t('save_to_device')}</span></DropdownMenuItem>}
                          <DropdownMenuItem onSelect={() => onForward(message)} className="h-10 rounded-xl"><Forward className="mr-3 h-4 w-4" /><span>{t('forward')}</span></DropdownMenuItem>
                          {canEdit && <DropdownMenuItem onSelect={() => setEditingMessage(message)} className="h-10 rounded-xl"><Edit className="mr-3 h-4 w-4" /><span>{t('edit_message')}</span></DropdownMenuItem>}
                          {canDelete && <DropdownMenuItem onSelect={() => onDelete(message.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10 h-10 rounded-xl"><Trash2 className="mr-3 h-4 w-4" /><span>{t('delete_message')}</span></DropdownMenuItem>}
                      </DropdownMenuContent>
                    ) : (
                      <DropdownMenuContent align={alignRight ? 'end' : 'start'} className="w-44 p-1 animate-in fade-in duration-200 rounded-lg">
                          <DropdownMenuSub>
                              <DropdownMenuSubTrigger><SmilePlus className="mr-2 h-4 w-4" /><span>{t('reactions')}</span></DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                  <DropdownMenuSubContent className="p-1 w-52 max-h-[70svh] overflow-y-auto rounded-lg">
                                      <div className="grid grid-cols-5 gap-0.5">
                                          {COMMON_EMOJIS.map(emoji => { 
                                              const sel = message.reactions?.[emoji]?.includes(currentUser.uid); 
                                              return (<button key={emoji} onClick={() => { onToggleReaction(message.id, emoji); }} className={cn("h-9 w-9 flex items-center justify-center hover:bg-accent rounded-md text-lg", sel && "bg-accent")}>{emoji}</button>); 
                                          })}
                                      </div>
                                  </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuItem onSelect={() => onReply(message)}><Reply className="mr-2 h-4 w-4" /><span>{t('reply')}</span></DropdownMenuItem>
                          {canCopy && <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(message.content); toast({ title: t('copy_success_toast') }); }}><Copy className="mr-2 h-4 w-4" /><span>{t('copy_text')}</span></DropdownMenuItem>}
                          {hasSaveableMedia && <DropdownMenuItem onSelect={handleSaveToDevice}><Save className="mr-2 h-4 w-4" /><span>{t('save_to_device')}</span></DropdownMenuItem>}
                          <DropdownMenuItem onSelect={() => onForward(message)}><Forward className="mr-2 h-4 w-4" /><span>{t('forward')}</span></DropdownMenuItem>
                          {canEdit && <DropdownMenuItem onSelect={() => setEditingMessage(message)}><Edit className="mr-2 h-4 w-4" /><span>{t('edit_message')}</span></DropdownMenuItem>}
                          {canDelete && <DropdownMenuItem onSelect={() => onDelete(message.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>{t('delete_message')}</span></DropdownMenuItem>}
                      </DropdownMenuContent>
                    )}
                </DropdownMenu>
            </div>
        </div>
    );
}
