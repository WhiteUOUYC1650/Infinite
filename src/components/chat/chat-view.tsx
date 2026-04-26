'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat, Call, Poll } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X, MoreVertical, User as UserIcon, Info, Trash2, Users, Megaphone, CheckCheck, Bookmark, Globe, Bot, Copy, Edit, Reply, CornerDownLeft, Image as ImageIcon, Music as MusicIcon, Video as VideoIcon, Clock, File as FileIcon, Download, Save, Maximize2, SmilePlus, Radio, Mic, Camera, Play, Pause, Trash, Lock, CircleHelp, PhoneOff, LogOut, ListTodo, Plus, Minus, CheckCircle2, Forward, Search, PlayCircle, Cake, Gift, Coins, Check } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
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
import { GroupCallDialog } from './group-call-dialog';
import { Capacitor } from '@capacitor/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { FaqDialog } from '../faq-dialog';
import { Badge } from '../ui/badge';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { VerifiedBadge } from '../ui/verified-badge';
import { PremBadge } from '../ui/prem-badge';
import { BetaBadge } from '../ui/beta-badge';
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
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(file.type, file.type === 'image/jpeg' ? quality : undefined);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

function PollDisplay({ poll, onVote, currentUserId, alignRight, memberDetails }: { poll: Poll, onVote: (index: number) => void, currentUserId: string, alignRight: boolean, memberDetails: Record<string, User> }) {
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
                        <button 
                            key={index} 
                            onClick={() => onVote(index)}
                            className="w-full group/poll relative text-left"
                        >
                            <div className="flex justify-between items-center mb-1 text-xs font-bold px-1">
                                <div className="flex items-center gap-1.5 truncate mr-2">
                                    {isVoted && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                                    <span className="truncate">{option.text}</span>
                                </div>
                                <span className="shrink-0 opacity-70">{percentage}%</span>
                            </div>
                            <div className={cn("h-2 w-full rounded-full overflow-hidden", alignRight ? "bg-black/20" : "bg-muted")}>
                                <div 
                                    className={cn("h-full transition-all duration-500 rounded-full", alignRight ? "bg-white" : "bg-primary")} 
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-60 px-1">
                <span>{t('poll_vote_count', { count: totalVotes })}</span>
                {poll.isAnonymous ? (
                    <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> {t('poll_anonymous_label')}</span>
                ) : (
                    <span>{t('poll_view_results')}</span>
                )}
            </div>
        </div>
    );
}

function CustomAudioPlayer({ src, isMusic = false, duration, fileName, hideTime = false }: { src: string | null | undefined, isMusic?: boolean, duration?: number, fileName?: string, hideTime?: boolean }) {
    const { isDarkMode } = useTheme();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [maxTime, setMaxTime] = useState(duration || 0);

    useEffect(() => {
        if (audioRef.current && src) {
            audioRef.current.load();
        }
    }, [src]);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current && src) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const onTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            const d = audioRef.current.duration;
            if (d && isFinite(d)) {
                setMaxTime(d);
            }
        }
    };

    const formatTime = (time: number) => {
        if (typeof time !== 'number' || isNaN(time) || !isFinite(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (audioRef.current && maxTime) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            audioRef.current.currentTime = percentage * maxTime;
        }
    };

    if (!src) return null;

    const uiClass = isDarkMode ? "bg-white text-black" : "bg-black text-white";
    const accentClass = isDarkMode ? "bg-black" : "bg-white";

    return (
        <div className={cn(
            "flex items-center gap-3 w-full px-2 py-2 rounded-xl transition-all shadow-sm", 
            isMusic ? "w-full max-w-[400px]" : "w-full max-w-[380px] min-w-[240px]",
            uiClass
        )}>
            <audio ref={audioRef} src={src} onTimeUpdate={onTimeUpdate} onEnded={() => setIsPlaying(false)} onLoadedMetadata={onTimeUpdate} preload="metadata" />
            <button 
                onClick={togglePlay} 
                className={cn(
                    "rounded-full flex items-center justify-center shadow-sm shrink-0 transition-transform active:scale-95", 
                    isMusic ? "w-12 h-12 bg-white/10" : "w-10 h-10",
                    accentClass
                )}
            >
                {isPlaying ? (
                    <Pause className={cn("h-5 w-5", isDarkMode ? "text-white fill-white" : "text-primary fill-primary")} />
                ) : (
                    <Play className={cn("h-5 w-5 ml-0.5", isDarkMode ? "text-white fill-white" : "text-primary fill-primary")} />
                )}
            </button>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                {isMusic && fileName && (
                    <div className="text-[10px] font-black uppercase tracking-tighter truncate mb-1 opacity-90">
                        {fileName}
                    </div>
                )}
                <div 
                    className={cn(
                        "relative h-2 w-full rounded-full overflow-hidden cursor-pointer", 
                        isMusic ? "mb-1.5" : "mb-0",
                        isDarkMode ? "bg-black/30" : "bg-white/30"
                    )} 
                    onClick={handleProgressClick}
                >
                    <div 
                        className={cn("absolute h-full rounded-full transition-all duration-100", accentClass)} 
                        style={{ width: `${(currentTime / (maxTime || 1)) * 100}%` }}
                    />
                </div>
                {isMusic && !hideTime && (
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter mt-1.5 opacity-80">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(maxTime)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function NewPollDialog({ open, onOpenChange, onSubmit }: { open: boolean, onOpenChange: (v: boolean) => void, onSubmit: (poll: Poll) => void }) {
    const { t } = useLanguage();
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [isMultipleChoice, setIsMultipleChoice] = useState(false);

    const handleAddOption = () => {
        if (options.length < 10) setOptions([...options, '']);
    };

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = [...options];
            newOptions.splice(index, 1);
            setOptions(newOptions);
        }
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleCreate = () => {
        const validOptions = options.filter(opt => opt.trim() !== '');
        if (question.trim() && validOptions.length >= 2) {
            onSubmit({
                question: question.trim(),
                options: validOptions.map(text => ({ text, votes: [] })),
                isAnonymous,
                isMultipleChoice,
            });
            setQuestion('');
            setOptions(['', '']);
            setIsAnonymous(true);
            setIsMultipleChoice(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl overflow-hidden p-0 gap-0">
                <div className="bg-primary/5 p-6 border-b">
                    <DialogTitle className="text-xl font-bold font-headline">{t('create_poll')}</DialogTitle>
                </div>
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{t('poll_question_label')}</Label>
                        <Input 
                            value={question} 
                            onChange={e => setQuestion(e.target.value)} 
                            placeholder={t('poll_question_placeholder')} 
                            className="rounded-xl h-12 bg-muted/50 border-none focus-visible:ring-primary"
                        />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">ВАРИАНТЫ ОТВЕТА</Label>
                        {options.map((opt, i) => (
                            <div key={i} className="flex gap-2">
                                <Input 
                                    value={opt} 
                                    onChange={e => handleOptionChange(i, e.target.value)} 
                                    placeholder={`${t('poll_option_placeholder')}...`} 
                                    className="rounded-xl h-11 bg-muted/30 border-none focus-visible:ring-primary"
                                />
                                {options.length > 2 && (
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(i)} className="shrink-0 rounded-xl">
                                        <Minus className="h-4 w-4 text-destructive" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        {options.length < 10 && (
                            <Button variant="outline" onClick={handleAddOption} className="w-full rounded-xl border-dashed border-primary/30 text-primary hover:bg-primary/5">
                                <Plus className="mr-2 h-4 w-4" /> {t('poll_add_option')}
                            </Button>
                        )}
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="anon-poll" className="cursor-pointer">{t('poll_anonymous_label')}</Label>
                            <Switch id="anon-poll" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="multi-poll" className="cursor-pointer">{t('poll_multiple_choice_label')}</Label>
                            <Switch id="multi-poll" checked={isMultipleChoice} onCheckedChange={setIsMultipleChoice} />
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-6 pt-0 gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl flex-1">{t('cancel')}</Button>
                    <Button onClick={handleCreate} disabled={!question.trim() || options.filter(o => o.trim() !== '').length < 2} className="rounded-xl flex-[2] font-bold">
                        {t('create_poll')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ChatView({ item: initialItem, onClose, currentUser, onSelectChat }: { item: PopulatedChat, onClose: () => void, currentUser: AuthenticatedUser, onSelectChat: (chat: PopulatedChat) => void }) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { theme: colorTheme, sendOnEnter, smoothScroll } = useTheme();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState<User | null>(null);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [showFaqDialog, setShowFaqDialog] = useState(false);
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
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastScrollHeightRef = useRef<number>(0);
  const [stickyDate, setStickyDate] = useState<string | null>(null);
  const isAtBottomRef = useRef(true);

  const [localMediaCache, setLocalMediaCache] = useState<Record<string, string>>({});

  const [showGroupCallDialog, setShowGroupCallDialog] = useState(false);
  const [activeGroupCall, setActiveGroupCall] = useState<Call | null>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingCircle, setIsRecordingCircle] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecordingLocked, setIsRecordingLocked] = useState(false);
  const [recordingOffset, setRecordingOffset] = useState({ x: 0, y: 0 });
  
  const isRecordingCancelledRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingVideoRef = useRef<HTMLVideoElement>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const isRecordingRequestedRef = useRef<boolean>(false);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);

  const [dismissedBirthdays, setDismissedBirthdays] = useState<Set<string>>(new Set());
  
  const isInitialLoadRef = useRef(true);

  const isPrem = currentUser.subscriptionTier === 'prem';
  const maxFileSizeText = isPrem ? '4GB' : '1GB';
  const maxFileSizeInBytes = isPrem ? 4 * 1024 * 1024 * 1024 : 1024 * 1024 * 1024;

  const chatDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'chats', initialItem.id);
  }, [db, initialItem.id]);

  const { data: liveChatData, loading: chatLoading } = useDoc<Chat>(chatDocRef);

  const item = useMemo(() => {
    if (!liveChatData) return initialItem;
    const newChatData = { ...initialItem, ...liveChatData };
     if (newChatData.type === 'dm' && newChatData.id === currentUser.uid) {
      newChatData.icon = 'Bookmark';
    }
    return newChatData;
  }, [initialItem, liveChatData, currentUser.uid]);

  const isMember = useMemo(() => {
    if (!item?.members || !Array.isArray(item.members)) return false;
    return item.members.includes(currentUser.uid);
  }, [item?.members, currentUser.uid]);

  const isOwner = item.ownerId === currentUser.uid;

  useEffect(() => {
    const handleFullscreenChange = async () => {
      const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      
      if (Capacitor.isNativePlatform()) {
        const { ScreenOrientation } = await import('@capacitor/screen-orientation');
        try {
          if (isFullscreen) {
            await ScreenOrientation.unlock();
          } else {
            const isTablet = window.innerWidth >= 768 || window.innerHeight >= 768;
            if (!isTablet) {
              await ScreenOrientation.lock({ orientation: 'portrait' });
            } else {
              await ScreenOrientation.unlock();
            }
          }
        } catch (e) {
          console.error("Orientation error during fullscreen change:", e);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!db || !isMember || !messageContent.trim()) {
        if (db && isMember) {
            updateDoc(doc(db, 'chats', item.id), { [`typingStatus.${currentUser.uid}`]: false }).catch(() => {});
        }
        return;
    }
    
    updateDoc(doc(db, 'chats', item.id), { [`typingStatus.${currentUser.uid}`]: true });

    const timeout = setTimeout(() => {
        updateDoc(doc(db, 'chats', item.id), { [`typingStatus.${currentUser.uid}`]: false });
    }, 3000);

    return () => {
        clearTimeout(timeout);
        updateDoc(doc(db, 'chats', item.id), { [`typingStatus.${currentUser.uid}`]: false }).catch(() => {});
    };
  }, [messageContent, db, isMember, item.id, currentUser.uid]);

  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden' && db && isMember) {
            updateDoc(doc(db, 'chats', item.id), { [`typingStatus.${currentUser.uid}`]: false }).catch(() => {});
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [db, isMember, item.id, currentUser.uid]);

  useEffect(() => {
    if (!db || item.type === 'dm' || !isMember) return;
    const callRef = doc(db, 'calls', item.id);
    const unsubscribe = onSnapshot(callRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Call;
        if (data.status === 'active') {
          setActiveGroupCall(data);
        } else {
          setActiveGroupCall(null);
        }
      } else {
        setActiveGroupCall(null);
      }
    });
    return () => unsubscribe();
  }, [db, item.id, item.type, isMember]);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !isMember) return null;
    return query(
        collection(db, 'chats', item.id, 'messages'), 
        orderBy('timestamp', 'desc'), 
        limit(messageLimit)
    );
  }, [db, item.id, isMember, messageLimit]);

  const { data: rawMessages, loading: messagesLoading } = useCollection<Message>(messagesQuery);
  
  const messages = useMemo(() => {
    if (!rawMessages) return null;
    return [...rawMessages].reverse();
  }, [rawMessages]);

  useEffect(() => {
    if (rawMessages) {
        setHasMore(rawMessages.length === messageLimit);
    }
  }, [rawMessages, messageLimit]);

  const allUserIdsToFetch = useMemo(() => {
    const ids = new Set<string>(item.members || []);
    messages?.forEach(m => {
        ids.add(m.senderId);
        if (m.reactions) {
            Object.values(m.reactions).flat().forEach(uid => {
              if (typeof uid === 'string') ids.add(uid);
            });
        }
        if (m.poll?.options) {
            m.poll.options.forEach(opt => {
                opt.votes.forEach(uid => ids.add(uid));
            });
        }
    });
    return Array.from(ids);
  }, [item.members, messages]);

  const { users: memberDetails, loading: membersLoading } = useBatchUsers(allUserIdsToFetch);

  useEffect(() => {
    if (!db || !isMember || !messages || messages.length === 0) return;

    const markMessagesAsRead = async () => {
      const batch = writeBatch(db);
      let updatesMade = 0;

      messages.forEach(message => {
        if (message.senderId !== currentUser.uid && !message.readBy?.includes(currentUser.uid)) {
          const messageRef = doc(db, 'chats', item.id, 'messages', message.id);
          batch.update(messageRef, {
            readBy: arrayUnion(currentUser.uid)
          });
          updatesMade++;
        }
      });

      if (updatesMade > 0) {
        try {
          await batch.commit();
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      }
    };

    markMessagesAsRead();

  }, [db, isMember, messages, currentUser.uid, item.id]);

  useEffect(() => {
    if (db && currentUser?.uid && item.id && isMember) {
      const unreadCountForCurrentUser = item.unreadCounts?.[currentUser.uid] || 0;
      if (unreadCountForCurrentUser > 0) {
        const chatRef = doc(db, 'chats', item.id);
        updateDoc(chatRef, {
          [`unreadCounts.${currentUser.uid}`]: 0
        }).catch(error => {
            console.error("Could not reset unread count:", error);
        });
      }
    }
  }, [db, currentUser?.uid, item.id, item.unreadCounts, isMember]);

  const otherUserId = useMemo(() => {
    if (item.type !== 'dm' || !Array.isArray(item.members)) return null;
    return item.members.find((id) => id !== currentUser.uid) || currentUser.uid;
  }, [item, currentUser.uid]);

  const otherUser = useMemo(() => {
    if (!otherUserId || !memberDetails) return null;
    return memberDetails[otherUserId] || null;
  }, [otherUserId, memberDetails]);

  const isOtherUserTyping = useMemo(() => {
    if (item.type !== 'dm' || !otherUserId) return false;
    return item.typingStatus?.[otherUserId] === true;
  }, [item.typingStatus, otherUserId, item.type]);


  const getChatName = () => {
    if (item.type === 'dm') {
      if (otherUser?.isDeleted) {
        return t('deleted_account');
      }
      if (otherUser?.id === currentUser.uid) {
        return t('saved_messages');
      }
      return otherUser?.name || t('direct_message_tab');
    }
    return item.name;
  };
  
  const getStatusText = (user: User | null | undefined) => {
    if (!user || user.isDeleted) return null;
    if (isOtherUserTyping) return <span className="text-primary font-bold animate-pulse">{t('searching')}</span>;

    if (user.isBot) {
      return t('bot_status');
    }
    
    if (user.status === 'offline' && user.lastSeen) {
      const lastSeenDate = getSafeDate(user.lastSeen);
      return `${t('was_online')} ${format(lastSeenDate, 'dd.MM.yyyy, HH:mm')}`;
    }
    
    if (user.status === 'online' || user.status === 'away') {
      return t(user.status);
    }
    
    return t('offline');
  }

  const canSendMessage = useMemo(() => {
    if (!isMember) return false;
    if (otherUser?.isDeleted) return false;
    if (item.type === 'channel' && item.ownerId !== currentUser.uid) {
        return false;
    }
    return true;
  }, [isMember, item, currentUser.uid, otherUser]);

  const isBirthdayToday = useMemo(() => {
    if (item.type !== 'dm' || !otherUser?.birthday || dismissedBirthdays.has(item.id)) return false;
    const now = new Date();
    return otherUser.birthday.day === now.getDate() && otherUser.birthday.month === (now.getMonth() + 1);
  }, [item.type, item.id, otherUser?.birthday, dismissedBirthdays]);

  const otherUserAge = useMemo(() => {
    if (!isBirthdayToday || !otherUser?.birthday?.year) return null;
    return new Date().getFullYear() - otherUser.birthday.year;
  }, [isBirthdayToday, otherUser?.birthday?.year]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !messages) return;

    if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        scrollToBottom('auto');
    } else if (isAtBottomRef.current) {
        scrollToBottom(smoothScroll ? 'smooth' : 'auto');
    } else if (lastScrollHeightRef.current > 0) {
        const heightDiff = container.scrollHeight - lastScrollHeightRef.current;
        if (heightDiff > 0 && container.scrollTop < 200) {
            container.scrollTop += heightDiff;
        }
    }
    
    lastScrollHeightRef.current = container.scrollHeight;
  }, [messages, item.id, scrollToBottom, smoothScroll, canSendMessage]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        scrollToBottom('auto');
      }
    });

    const list = container.querySelector('.messages-list-inner');
    if (list) resizeObserver.observe(list);
    return () => resizeObserver.disconnect();
  }, [scrollToBottom]);

  useEffect(() => {
    isInitialLoadRef.current = true;
    // Delayed scroll fallback for first load
    const timer = setTimeout(() => {
        if (isAtBottomRef.current) scrollToBottom('auto');
    }, 100);
    return () => clearTimeout(timer);
  }, [item.id, scrollToBottom]);

  const handleMediaLoad = useCallback(() => {
    if (isAtBottomRef.current) {
        scrollToBottom();
    }
  }, [scrollToBottom]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        lastScrollHeightRef.current = scrollHeight;
        isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;

        const dateSeparators = container.querySelectorAll<HTMLElement>('[data-date-separator]');
        let currentStickyDate: string | null = null;
        if (dateSeparators.length > 0) {
            for (let i = 0; i < dateSeparators.length; i++) {
                const separator = dateSeparators[i];
                if (separator && separator.offsetTop <= scrollTop + 5) {
                    currentStickyDate = separator.dataset.dateSeparator || null;
                } else break;
            }
        }
        setStickyDate(currentStickyDate);

        if (scrollTop < 100 && hasMore && !messagesLoading) {
            setMessageLimit(prev => prev + 50);
        }
    }, [hasMore, messagesLoading]);

  const handleSendMessageToUser = async (targetUser: User) => {
    if (!db || !currentUser || targetUser.isDeleted) return;
    setProfileDialogUser(null);
    const members = [currentUser.uid, targetUser.id].sort();
    const chatId = members.join('_');
    if (initialItem.id === chatId) return;

    const chatRef = doc(db, 'chats', chatId);
    try {
      const chatSnap = await getDoc(chatRef);
      let chatData: Chat;
      if (!chatSnap.exists()) {
        chatData = {
          id: chatId,
          type: 'dm',
          members: members,
        };
        await setDoc(chatRef, {
          type: 'dm',
          members: members,
          unreadCounts: members.reduce(
            (acc, memberId) => ({ ...acc, [memberId]: 0 }),
            {}
          ),
        });
      } else {
        chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat;
      }

      if (onSelectChat) {
        const iconName = chatData.icon as keyof typeof iconMap | undefined;
        const populatedChat: PopulatedChat = {
            ...chatData,
            iconComponent: iconName ? iconMap[iconName] : undefined,
        };
        onSelectChat(populatedChat);
      }
    } catch (error) {
      console.error('Error switching to DM:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not open direct message.' });
    }
  };

  const handleInternalLinkClick = async (href: string) => {
    if (!db || !currentUser) return;
    try {
        const lowerHref = href.toLowerCase();

        if (lowerHref.startsWith('/iv/v/')) {
            const videoId = href.substring(6);
            if (videoId) {
                window.dispatchEvent(new CustomEvent('open-infvid', { detail: { videoId } }));
                return;
            }
        }

        let targetChat: Chat | null = null;

        if (href.startsWith('@')) {
            const usernameRef = doc(db, 'usernames', href);
            const usernameSnap = await getDoc(usernameRef);
            if (usernameSnap.exists()) {
                const targetUserId = usernameSnap.data().uid;
                if (targetUserId === currentUser.uid) {
                    const selfChatRef = doc(db, 'chats', currentUser.uid);
                    const selfChatSnap = await getDoc(selfChatRef);
                    if (selfChatSnap.exists()) {
                        targetChat = { id: selfChatSnap.id, ...selfChatSnap.data() } as Chat;
                    } else {
                        await setDoc(selfChatRef, { type: 'dm', members: [currentUser.uid], icon: 'Bookmark' });
                        targetChat = { id: currentUser.uid, type: 'dm', members: [currentUser.uid], icon: 'Bookmark' };
                    }
                } else {
                    const members = [currentUser.uid, targetUserId].sort();
                    const chatId = members.join('_');
                    const chatRef = doc(db, 'chats', chatId);
                    const chatSnap = await getDoc(chatRef);
                    if (chatSnap.exists()) {
                        targetChat = { id: chatSnap.id, ...chatSnap.data() } as Chat;
                    } else {
                        await setDoc(chatRef, { type: 'dm', members: members, unreadCounts: { [currentUser.uid]: 0, [targetUserId]: 0 } });
                        targetChat = { id: chatId, type: 'dm', members: members, unreadCounts: { [currentUser.uid]: 0, [targetUserId]: 0 } };
                    }
                }
            } else {
                toast({ variant: 'destructive', title: t('user_not_found') });
                return;
            }
        } 
        else if (lowerHref.startsWith('/g/') || lowerHref.startsWith('/c/')) {
            const normalizedLink = (lowerHref.startsWith('/g/') ? '/G/' : '/C/') + href.substring(3);
            
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(normalizedLink));
            const linkSnap = await getDoc(linkRef);
            if (linkSnap.exists()) {
                const chatId = linkSnap.data().chatId;
                const chatRef = doc(db, 'chats', chatId);
                const chatSnap = await getDoc(chatRef);
                if (chatSnap.exists()) {
                    targetChat = { id: chatSnap.id, ...chatSnap.data() } as Chat;
                }
            } else {
                toast({ variant: 'destructive', title: t(lowerHref.startsWith('/g/') ? 'group_not_found' : 'channel_not_found') });
                return;
            }
        }

        if (targetChat) {
            const iconName = targetChat.icon as keyof typeof iconMap | undefined;
            const populatedChat: PopulatedChat = {
                ...targetChat,
                iconComponent: iconName ? iconMap[iconName] : undefined,
            };
            onSelectChat(populatedChat);
        } else {
            toast({ variant: 'destructive', title: t('no_results_found'), description: t('internal_link_not_found', { link: href }) });
        }
    } catch (error) {
        console.error("Error handling internal link:", error);
        toast({ variant: 'destructive', title: 'Error', description: t('dm_error') });
    }
  };

  const handleSendMessage = async (customContent?: string) => {
    const finalContent = customContent !== undefined ? customContent : messageContent;
    if ((!finalContent.trim() && !fileToSend) || !db) return;
    setIsSending(true);
    const originalContent = finalContent;
    const originalFile = fileToSend;
    const originalReplyTo = replyToMessage;
    
    setMessageContent('');
    setFileToSend(null);
    setReplyToMessage(null);

    (async () => {
        try {
            if (originalFile?.type === 'video') {
                await handleSendVideo(originalFile, originalContent, originalReplyTo);
            } else if (originalFile?.type === 'voice') {
                await handleSendVoice(originalFile, originalContent, originalReplyTo, recordingDuration);
            } else if (originalFile?.type === 'circle') {
                await handleSendCircle(originalFile, originalContent, originalReplyTo, recordingDuration);
            } else if (originalFile?.type === 'music') {
                await handleSendMusic(originalFile, originalContent, originalReplyTo);
            } else if (originalFile?.type === 'file') {
                await handleSendGenericFile(originalFile, originalContent, originalReplyTo);
            } else {
                await handleSendTextOrImage(originalFile?.previewUrl, originalContent, originalReplyTo);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessageContent(originalContent);
            setFileToSend(originalFile);
            setReplyToMessage(originalReplyTo);
            if (error instanceof FirestorePermissionError) {
                errorEmitter.emit('permission-error', error);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: (error as Error).message || t('unexpected_error') });
            }
        } finally {
            setIsSending(false);
        }
    })();
};

const handleSendVoice = async (payload: {file: File, previewUrl: string}, content: string, replyTo: Message | null, duration: number) => {
    if (!db) throw new Error("Database not initialized");
    const { file } = payload;
    const messageRef = doc(collection(db, 'chats', item.id, 'messages'));
    const chatRef = doc(db, 'chats', item.id);
    const timestamp = Timestamp.now();
    const messageData: any = {
        senderId: currentUser.uid,
        content: content,
        timestamp,
        voiceMimeType: file.type,
        voiceStatus: 'uploading',
        voiceDuration: duration,
        readBy: [],
        ...(replyTo && {
            replyTo: {
                messageId: replyTo.id,
                content: replyTo.content,
                senderName: replyTo.sender?.name || replyTo.senderName || '',
            },
        }),
    };
    try {
        const batch = writeBatch(db);
        batch.set(messageRef, messageData);
        batch.update(chatRef, { lastMessage: { id: messageRef.id, content: t('voice_message_short'), senderId: currentUser.uid, senderName: currentUser.name, timestamp } });
        await batch.commit();
        
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
        });
        
        const CHUNK_SIZE = 900 * 1024;
        const chunkIds: string[] = [];
        for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
            const chunkRef = doc(collection(db, 'voiceChunks'));
            await setDoc(chunkRef, { data: base64.substring(i, i + CHUNK_SIZE), part: i/CHUNK_SIZE, senderId: currentUser.uid });
            chunkIds.push(chunkRef.id);
            await new Promise(res => setTimeout(res, 0));
        }
        await updateDoc(messageRef, { voiceStatus: 'complete', voiceChunkIds: chunkIds });
        
        // Cache the file immediately
        await cacheFile(messageRef.id, file);
    } catch (e) { console.error(e); }
};

const handleSendCircle = async (payload: {file: File, previewUrl: string}, content: string, replyTo: Message | null, duration: number) => {
    if (!db) throw new Error("Database not initialized");
    const { file } = payload;
    const messageRef = doc(collection(db, 'chats', item.id, 'messages'));
    const chatRef = doc(db, 'chats', item.id);
    const timestamp = Timestamp.now();
    const messageData: any = {
        senderId: currentUser.uid,
        content: content,
        timestamp,
        circleMimeType: file.type,
        circleStatus: 'uploading',
        circleDuration: duration,
        readBy: [],
        ...(replyTo && {
            replyTo: {
                messageId: replyTo.id,
                content: replyTo.content,
                senderName: replyTo.sender?.name || replyTo.senderName || '',
            },
        }),
    };
    try {
        const batch = writeBatch(db);
        batch.set(messageRef, messageData);
        batch.update(chatRef, { lastMessage: { id: messageRef.id, content: t('video_attachment_placeholder'), senderId: currentUser.uid, senderName: currentUser.name, timestamp } });
        await batch.commit();
        
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
        });
        
        const CHUNK_SIZE = 900 * 1024;
        const chunkIds: string[] = [];
        for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
            const chunkRef = doc(collection(db, 'circleChunks'));
            await setDoc(chunkRef, { data: base64.substring(i, i + CHUNK_SIZE), part: i/CHUNK_SIZE, senderId: currentUser.uid });
            chunkIds.push(chunkRef.id);
            await new Promise(res => setTimeout(res, 0));
        }
        await updateDoc(messageRef, { circleStatus: 'complete', circleChunkIds: chunkIds });

        // Cache the file immediately
        await cacheFile(messageRef.id, file);
    } catch (e) { console.error(e); }
};

const handleSendTextOrImage = async (imageUrl: string | null | undefined, content: string, replyTo: Message | null) => {
    if (!db) return;
    try {
        const trimmedContent = content.trim();
        const contentForPreview = trimmedContent || (imageUrl ? t('image_attachment_placeholder') : '');
        const timestamp = Timestamp.now();
        const messageData: { [key: string]: any } = {
            senderId: currentUser.uid,
            content: trimmedContent,
            timestamp,
            type: 'user',
            readBy: [],
            ...(imageUrl && { imageUrl }),
            ...(replyTo && {
                replyTo: {
                    messageId: replyTo.id,
                    content: replyTo.content,
                    senderName: replyTo.sender?.name || replyTo.senderName || '',
                },
            }),
        };
        const messageRef = doc(collection(db, 'chats', item.id, 'messages'));
        const chatRef = doc(db, 'chats', item.id);
        const lastMessageData = {
            id: messageRef.id,
            content: contentForPreview,
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
            ...(imageUrl && { imageUrl }),
        };
        const batch = writeBatch(db);
        batch.set(messageRef, messageData);
        const updateData: { [key: string]: any } = { lastMessage: lastMessageData };
        if (item.type !== 'channel' && item.id !== 'GENERAL_CHAT') {
            item.members.forEach((memberId) => {
                if (memberId !== currentUser.uid) {
                    updateData[`unreadCounts.${memberId}`] = increment(1);
                }
            });
        }
        
        if (item.type === 'channel' && item.discussionChatId) {
            const discChatRef = doc(db, 'chats', item.discussionChatId);
            const discMsgRef = doc(collection(db, 'chats', item.discussionChatId, 'messages'));
            const forwardedMsg = {
                ...messageData,
                type: 'announcement',
                senderName: item.name,
                senderAvatar: item.avatar || 'is_channel_message',
                fromChannelId: item.id
            };
            batch.set(discMsgRef, forwardedMsg);
            batch.update(discChatRef, { lastMessage: { ...forwardedMsg, id: discMsgRef.id } });
        }

        batch.update(chatRef, updateData);
        await batch.commit();

        if (imageUrl) {
            await fetchAndCacheImage(messageRef.id, imageUrl);
        }
    } catch (error) {
        console.error("Error sending text/image message:", error);
        throw error;
    }
};

const handleSendVideo = async (videoPayload: {file: File, previewUrl: string}, content: string, replyTo: Message | null) => {
    if (!db) throw new Error("Database not initialized");
    const { file: videoFile, previewUrl } = videoPayload;
    const messageRef = doc(collection(db, 'chats', item.id, 'messages'));
    setLocalMediaCache(prev => ({ ...prev, [messageRef.id]: previewUrl }));
    const chatRef = doc(db, 'chats', item.id);
    const timestamp = Timestamp.now();
    const trimmedContent = content.trim();
    const messageData: Omit<Message, 'id'> = {
        senderId: currentUser.uid,
        content: trimmedContent,
        timestamp,
        videoMimeType: videoFile.type,
        videoStatus: 'uploading',
        readBy: [],
        ...(replyTo && {
            replyTo: {
                messageId: replyTo.id,
                content: replyTo.content,
                senderName: replyTo.sender?.name || replyTo.senderName || '',
            },
        }),
    };
    try {
        const batch = writeBatch(db);
        batch.set(messageRef, messageData);
        const lastMessageData = {
            id: messageRef.id,
            content: trimmedContent || t('video_attachment_placeholder'),
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
            videoMimeType: videoFile.type,
            videoStatus: 'uploading',
        };
        const updateData: { [key: string]: any } = { lastMessage: lastMessageData };
        if (item.type !== 'channel' && item.id !== 'GENERAL_CHAT') {
            item.members.forEach((memberId) => {
                if (memberId !== currentUser.uid) {
                    updateData[`unreadCounts.${memberId}`] = increment(1);
                }
            });
        }

        if (item.type === 'channel' && item.discussionChatId) {
            const discChatRef = doc(db, 'chats', item.discussionChatId);
            const discMsgRef = doc(collection(db, 'chats', item.discussionChatId, 'messages'));
            const forwardedMsg = {
                ...messageData,
                type: 'announcement',
                senderName: item.name,
                senderAvatar: item.avatar || 'is_channel_message',
                fromChannelId: item.id
            };
            batch.set(discMsgRef, forwardedMsg);
            batch.update(discChatRef, { lastMessage: { ...forwardedMsg, id: discMsgRef.id } });
        }

        batch.update(chatRef, updateData);
        await batch.commit();
        const videoBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(videoFile);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (error) => reject(error);
        });
        const CHUNK_SIZE = 900 * 1024; 
        const chunks: string[] = [];
        for (let i = 0; i < videoBase64.length; i += CHUNK_SIZE) {
            chunks.push(videoBase64.substring(i, i + CHUNK_SIZE));
        }
        const chunkIds: string[] = [];
        for (const [index, chunkData] of chunks.entries()) {
            const chunkDocRef = doc(collection(db, 'videoChunks'));
            await setDoc(chunkDocRef, { data: chunkData, part: index, senderId: currentUser.uid });
            chunkIds.push(chunkDocRef.id);
            await new Promise(res => setTimeout(res, 50));
        }
        await updateDoc(messageRef, { videoStatus: 'complete', videoChunkIds: chunkIds });
        
        // Cache the assembled video
        await cacheFile(messageRef.id, videoFile);

        const chatDoc = await getDoc(chatRef);
        if (chatDoc.data()?.lastMessage?.id === messageRef.id) {
            await updateDoc(chatRef, { 'lastMessage.videoStatus': 'complete' });
        }
    } catch (error) {
        console.error("Error during video upload process:", error);
        await updateDoc(messageRef, { videoStatus: 'failed' }).catch(() => {});
        throw new FirestorePermissionError({ path: 'videoChunks', operation: 'create', requestResourceData: { note: "Video chunk upload failed.", originalError: (error as Error).message } });
    }
};

const handleSendMusic = async (musicPayload: {file: File, previewUrl: string}, content: string, replyTo: Message | null) => {
    if (!db) throw new Error("Database not initialized");
    const { file: musicFile, previewUrl } = musicPayload;
    const messageRef = doc(collection(db, 'chats', item.id, 'messages'));
    setLocalMediaCache(prev => ({ ...prev, [messageRef.id]: previewUrl }));
    const chatRef = doc(db, 'chats', item.id);
    const timestamp = Timestamp.now();
    const trimmedContent = content.trim();
    const messageData: Omit<Message, 'id'> = {
        senderId: currentUser.uid,
        content: trimmedContent,
        timestamp,
        fileName: musicFile.name,
        musicMimeType: musicFile.type,
        musicStatus: 'uploading',
        readBy: [],
        ...(replyTo && {
            replyTo: {
                messageId: replyTo.id,
                content: replyTo.content,
                senderName: replyTo.sender?.name || replyTo.senderName || '',
            },
        }),
    };
    try {
        const batch = writeBatch(db);
        batch.set(messageRef, messageData);
        const lastMessageData = {
            id: messageRef.id,
            content: trimmedContent || t('music_attachment_placeholder'),
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
            musicMimeType: musicFile.type,
            musicStatus: 'uploading',
        };
        const updateData: { [key: string]: any } = { lastMessage: lastMessageData };
        if (item.type !== 'channel' && item.id !== 'GENERAL_CHAT') {
            item.members.forEach((memberId) => {
                if (memberId !== currentUser.uid) {
                    updateData[`unreadCounts.${memberId}`] = increment(1);
                }
            });
        }

        if (item.type === 'channel' && item.discussionChatId) {
            const discChatRef = doc(db, 'chats', item.discussionChatId);
            const discMsgRef = doc(collection(db, 'chats', item.discussionChatId, 'messages'));
            const forwardedMsg = {
                ...messageData,
                type: 'announcement',
                senderName: item.name,
                senderAvatar: item.avatar || 'is_channel_message',
                fromChannelId: item.id
            };
            batch.set(discMsgRef, forwardedMsg);
            batch.update(discChatRef, { lastMessage: { ...forwardedMsg, id: discMsgRef.id } });
        }

        batch.update(chatRef, updateData);
        await batch.commit();
        const musicBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(musicFile);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (error) => reject(error);
        });
        const CHUNK_SIZE = 900 * 1024;
        const chunks: string[] = [];
        for (let i = 0; i < musicBase64.length; i += CHUNK_SIZE) {
            chunks.push(musicBase64.substring(i, i + CHUNK_SIZE));
            await new Promise(res => setTimeout(res, 0));
        }
        const chunkIds: string[] = [];
        for (const [index, chunkData] of chunks.entries()) {
            const chunkDocRef = doc(collection(db, 'musicChunks'));
            await setDoc(chunkDocRef, { data: chunkData, part: index, senderId: currentUser.uid });
            chunkIds.push(chunkDocRef.id);
            await new Promise(res => setTimeout(res, 0));
        }
        await updateDoc(messageRef, { musicStatus: 'complete', musicChunkIds: chunkIds });
        
        // Cache the file
        await cacheFile(messageRef.id, musicFile);

        const chatDoc = await getDoc(chatRef);
        if (chatDoc.data()?.lastMessage?.id === messageRef.id) {
            await updateDoc(chatRef, { 'lastMessage.musicStatus': 'complete' });
        }
    } catch (error) {
        console.error("Error during music upload process:", error);
        await updateDoc(messageRef, { musicStatus: 'failed' }).catch(() => {});
        throw new FirestorePermissionError({ path: 'musicChunks', operation: 'create', requestResourceData: { note: "Music chunk upload failed.", originalError: (error as Error).message } });
    }
};

const handleSendGenericFile = async (filePayload: {file: File, previewUrl: string}, content: string, replyTo: Message | null) => {
    if (!db) throw new Error("Database not initialized");
    const { file } = filePayload;
    const messageRef = doc(collection(db, 'chats', item.id, 'messages'));
    const chatRef = doc(db, 'chats', item.id);
    const timestamp = Timestamp.now();
    const trimmedContent = content.trim();
    const messageData: Omit<Message, 'id'> = {
        senderId: currentUser.uid,
        content: trimmedContent,
        timestamp,
        fileName: file.name,
        fileMimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileStatus: 'uploading',
        readBy: [],
        ...(replyTo && {
            replyTo: {
                messageId: replyTo.id,
                content: replyTo.content,
                senderName: replyTo.sender?.name || replyTo.senderName || '',
            },
        }),
    };
    try {
        const batch = writeBatch(db);
        batch.set(messageRef, messageData);
        const lastMessageData = {
            id: messageRef.id,
            content: trimmedContent || t('file_attachment_placeholder'),
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
            fileName: file.name,
            fileStatus: 'uploading',
        };
        const updateData: { [key: string]: any } = { lastMessage: lastMessageData };
        if (item.type !== 'channel' && item.id !== 'GENERAL_CHAT') {
            item.members.forEach((memberId) => {
                if (memberId !== currentUser.uid) {
                    updateData[`unreadCounts.${memberId}`] = increment(1);
                }
            });
        }

        if (item.type === 'channel' && item.discussionChatId) {
            const discChatRef = doc(db, 'chats', item.discussionChatId);
            const discMsgRef = doc(collection(db, 'chats', item.discussionChatId, 'messages'));
            const forwardedMsg = {
                ...messageData,
                type: 'announcement',
                senderName: item.name,
                senderAvatar: item.avatar || 'is_channel_message',
                fromChannelId: item.id
            };
            batch.set(discMsgRef, forwardedMsg);
            batch.update(discChatRef, { lastMessage: { ...forwardedMsg, id: discMsgRef.id } });
        }

        batch.update(chatRef, updateData);
        await batch.commit();
        const fileBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (error) => reject(error);
        });
        const CHUNK_SIZE = 900 * 1024;
        const chunks: string[] = [];
        for (let i = 0; i < fileBase64.length; i += CHUNK_SIZE) {
            chunks.push(fileBase64.substring(i, i + CHUNK_SIZE));
        }
        const chunkIds: string[] = [];
        for (const [index, chunkData] of chunks.entries()) {
            const chunkDocRef = doc(collection(db, 'fileChunks'));
            await setDoc(chunkDocRef, { data: chunkData, part: index, senderId: currentUser.uid });
            chunkIds.push(chunkDocRef.id);
            await new Promise(res => setTimeout(res, 0));
        }
        await updateDoc(messageRef, { fileStatus: 'complete', fileChunkIds: chunkIds });

        // Cache the file
        await cacheFile(messageRef.id, file);

        const chatDoc = await getDoc(chatDocRef);
        if (chatDoc.data()?.lastMessage?.id === messageRef.id) {
            await updateDoc(chatRef, { 'lastMessage.fileStatus': 'complete' });
        }
    } catch (error) {
        console.error("Error during file upload process:", error);
        await updateDoc(messageRef, { fileStatus: 'failed' }).catch(() => {});
        throw new FirestorePermissionError({ path: 'fileChunks', operation: 'create', requestResourceData: { note: "File chunk upload failed.", originalError: (error as Error).message } });
    }
};

const handleSendPoll = async (poll: Poll) => {
    if (!db) return;
    try {
        const timestamp = Timestamp.now();
        const messageRef = doc(collection(db, 'chats', item.id, 'messages'));
        const chatRef = doc(db, 'chats', item.id);
        
        const messageData = {
            senderId: currentUser.uid,
            content: '',
            timestamp,
            readBy: [],
            poll: poll,
        };

        const lastMessageData = {
            id: messageRef.id,
            content: `📊 ${poll.question}`,
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
        };

        const batch = writeBatch(db);
        batch.set(messageRef, messageData);
        batch.update(chatRef, { lastMessage: lastMessageData });
        await batch.commit();
        setShowNewPoll(false);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to create poll.' });
    }
};

const handleForward = async (targetChatId: string) => {
    if (!db || !forwardingMessage) return;
    try {
        const timestamp = Timestamp.now();
        const targetChatRef = doc(db, 'chats', targetChatId);
        const targetChatSnap = await getDoc(targetChatRef);
        if (!targetChatSnap.exists()) return;
        const targetChatData = targetChatSnap.data() as Chat;

        const messageRef = doc(collection(db, 'chats', targetChatId, 'messages'));
        const { id, sender, senderName, senderAvatar, reactions, readBy, timestamp: oldTs, editedAt, replyTo, ...forwardData } = forwardingMessage;
        
        const messageData = {
            ...forwardData,
            senderId: currentUser.uid,
            timestamp,
            readBy: [],
        };

        const batch = writeBatch(db);
        batch.set(messageRef, messageData);

        let contentForPreview = messageData.imageUrl ? t('image_attachment_placeholder') : (messageData.content || '').split('\n')[0];
        if (messageData.videoMimeType) contentForPreview = t('video_attachment_placeholder');
        if (messageData.musicMimeType) contentForPreview = t('music_attachment_placeholder');
        if (messageData.poll) contentForPreview = `📊 ${messageData.poll.question}`;
        if (messageData.voiceStatus) contentForPreview = t('voice_message_short');
        if (messageData.circleStatus) contentForPreview = t('video_attachment_placeholder');

        const lastMessageData = {
            id: messageRef.id,
            content: contentForPreview,
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
        };

        const updateData: any = { lastMessage: lastMessageData };
        if (targetChatData.type !== 'channel' && targetChatId !== 'GENERAL_CHAT') {
            targetChatData.members.forEach(m => {
                if (m !== currentUser.uid) {
                    updateData[`unreadCounts.${m}`] = increment(1);
                }
            });
        }
        batch.update(targetChatRef, updateData);
        await batch.commit();
        
        toast({ title: t('dm_success'), description: t('message_forwarded_success') });
        setForwardingMessage(null);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Forwarding failed.' });
    }
};
  
  const handleReply = (message: Message) => {
    setReplyToMessage(message);
    setEditingMessage(null);
  };

  const handleSetEditingMessage = (message: Message | null) => {
    if (!message || message.poll || message.voiceStatus || message.circleStatus) return;
    setEditingMessage(message);
    if (message !== null) {
        setReplyToMessage(null);
        setFileToSend(null);
    }
  };

  const handleJoinDiscussion = async (discussionChatId: string) => {
    if (!db) return;
    try {
        const chatRef = doc(db, 'chats', discussionChatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
            const targetChat = { id: chatSnap.id, ...chatSnap.data() } as Chat;
            const iconName = targetChat.icon as keyof typeof iconMap | undefined;
            const populatedChat: PopulatedChat = { ...targetChat, id: chatSnap.id, iconComponent: iconName ? iconMap[iconName] : undefined };
            onSelectChat(populatedChat);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: t('discussion_chat_not_found') });
        }
    } catch (error) {
        console.error("Error joining discussion:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not open discussion chat.' });
    }
  };
  
  useEffect(() => {
    if (editingMessage) {
        setMessageContent(editingMessage.content);
        if (editingMessage.imageUrl) {
            setFileToSend({ file: new File([], ''), previewUrl: editingMessage.imageUrl, type: 'image' });
        } else {
            setFileToSend(null);
        }
    } else {
        if (!replyToMessage) {
            setMessageContent('');
            setFileToSend(null);
        }
    }
  }, [editingMessage, replyToMessage]);

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };
  
  const handleSaveEdit = async () => {
    if (!db || !editingMessage || (!messageContent.trim() && !fileToSend)) return;
    setIsSending(true);
    const messageRef = doc(db, 'chats', item.id, 'messages', editingMessage.id);
    try {
        await updateDoc(messageRef, { content: messageContent, editedAt: serverTimestamp() });
        if (item.lastMessage?.id === editingMessage.id) {
            const chatRef = doc(db, 'chats', item.id);
            const contentForPreview = fileToSend ? t('image_attachment_placeholder') : messageContent.split('\n')[0];
            await updateDoc(chatRef, { 'lastMessage.content': contentForPreview, 'lastMessage.editedAt': serverTimestamp() });
        }
        setEditingMessage(null);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({ path: messageRef.path, operation: 'update', requestResourceData: { content: messageContent } });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (editingMessage) {
        await handleSaveEdit();
    } else {
        await handleSendMessage();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      event.target.value = ''; 
      setReplyToMessage(null);
      setEditingMessage(null);
      try {
        setIsSending(true);
        if (file.size > maxFileSizeInBytes) {
            toast({ variant: 'destructive', title: t(file.type.startsWith('video/') ? 'video_too_large' : file.type.startsWith('audio/') ? 'music_too_large' : 'file_too_large', { size: maxFileSizeText }) });
            setIsSending(false);
            return;
        }

        if (file.type.startsWith('video/')) {
            const previewUrl = URL.createObjectURL(file);
            setFileToSend({ file, previewUrl, type: 'video' });
        } else if (file.type.startsWith('image/')) {
            const fileSizeInMB = file.size / 1024 / 1024;
            const COMPRESSION_THRESHOLD_MB = 0.7;
            let dataUrl: string;
            if (fileSizeInMB > COMPRESSION_THRESHOLD_MB) {
                dataUrl = await compressImage(file, 0.85, 1920);
            } else {
                dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = e => resolve(e.target?.result as string);
                    reader.onerror = e => reject(e);
                });
            }
            if (dataUrl.length > 950 * 1024) { 
                toast({ variant: 'destructive', title: t('image_too_large'), description: t('image_too_large_compressed') });
                setIsSending(false);
                return;
            }
            setFileToSend({ file, previewUrl: dataUrl, type: 'image' });
        } else if (file.type.startsWith('audio/')) {
            const previewUrl = URL.createObjectURL(file);
            setFileToSend({ file, previewUrl, type: 'music' });
        } else {
            const previewUrl = '';
            setFileToSend({ file, previewUrl, type: 'file' });
        }
      } catch(e) {
        console.error("Error processing file:", e);
        toast({ variant: 'destructive', title: t('image_processing_failed_title'), description: t('image_processing_failed_desc') });
      } finally {
        setIsSending(false);
      }
    }
  };
  
  const handleAttachmentClick = (type: 'image' | 'video' | 'music' | 'file' | 'poll') => {
    if (type === 'poll') {
        setShowNewPoll(true);
        return;
    }
    if (fileInputRef.current) {
        if (type === 'image') fileInputRef.current.accept = 'image/*';
        else if (type === 'video') fileInputRef.current.accept = 'video/*';
        else if (type === 'music') fileInputRef.current.accept = 'audio/*';
        else fileInputRef.current.accept = '*/*';
        fileInputRef.current.click();
    }
  };

  const startVoiceRecording = async () => {
    if (isRecordingRequestedRef.current || isRecordingVoice || isRecordingCircle) return;
    isRecordingRequestedRef.current = true;
    isRecordingCancelledRef.current = false;
    setIsRecordingLocked(false);
    setRecordingOffset({ x: 0, y: 0 });
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isRecordingRequestedRef.current) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        
        recordingStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        
        recorder.onstop = async () => {
            const durationMs = performance.now() - recordingStartTimeRef.current;
            const durationSeconds = Math.round(durationMs / 1000);
            
            if (isRecordingCancelledRef.current || durationMs < 500) {
                if (recordingStreamRef.current) {
                    recordingStreamRef.current.getTracks().forEach(t => t.stop());
                    recordingStreamRef.current = null;
                }
                return;
            }
            
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
            const previewUrl = URL.createObjectURL(blob);
            
            if (recordingStreamRef.current) {
                recordingStreamRef.current.getTracks().forEach(t => t.stop());
                recordingStreamRef.current = null;
            }

            await handleSendVoice({ file, previewUrl }, '', null, durationSeconds);
        };

        mediaRecorderRef.current = recorder;
        recordingStartTimeRef.current = performance.now();
        recorder.start();
        setIsRecordingVoice(true);
        setRecordingDuration(0);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (e) { 
        console.error(e); 
        isRecordingRequestedRef.current = false;
        toast({ variant: 'destructive', title: t('microphone_error_title'), description: t('microphone_error_desc') });
    }
  };

  const stopVoiceRecording = (cancel = false) => {
    isRecordingRequestedRef.current = false;
    if (mediaRecorderRef.current && isRecordingVoice) {
        if (cancel) isRecordingCancelledRef.current = true;
        if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecordingVoice(false);
        setIsRecordingLocked(false);
        setRecordingOffset({ x: 0, y: 0 });
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        if (recordingStreamRef.current) {
            recordingStreamRef.current.getTracks().forEach(t => t.stop());
            recordingStreamRef.current = null;
        }
    }
  };

  const startCircleRecording = async () => {
    if (isRecordingRequestedRef.current || isRecordingVoice || isRecordingCircle) return;
    isRecordingRequestedRef.current = true;
    isRecordingCancelledRef.current = false;
    setIsRecordingLocked(false);
    setRecordingOffset({ x: 0, y: 0 });
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 480, height: 480 } });
        if (!isRecordingRequestedRef.current) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        recordingStreamRef.current = stream;
        if (recordingVideoRef.current) recordingVideoRef.current.srcObject = stream;
        
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        
        recorder.onstop = async () => {
            const durationMs = performance.now() - recordingStartTimeRef.current;
            const durationSeconds = Math.round(durationMs / 1000);
            
            if (isRecordingCancelledRef.current || durationMs < 500) {
                if (recordingStreamRef.current) {
                    recordingStreamRef.current.getTracks().forEach(t => t.stop());
                    recordingStreamRef.current = null;
                }
                return;
            }
            
            const blob = new Blob(audioChunksRef.current, { type: 'video/webm' });
            const file = new File([blob], 'circle.webm', { type: 'video/webm' });
            const previewUrl = URL.createObjectURL(blob);

            if (recordingStreamRef.current) {
                recordingStreamRef.current.getTracks().forEach(t => t.stop());
                recordingStreamRef.current = null;
            }

            await handleSendCircle({ file, previewUrl }, '', null, durationSeconds);
        };

        mediaRecorderRef.current = recorder;
        recordingStartTimeRef.current = performance.now();
        recorder.start();
        setIsRecordingCircle(true);
        setRecordingDuration(0);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (e) { 
        console.error(e); 
        isRecordingRequestedRef.current = false;
        toast({ variant: 'destructive', title: 'Error', description: 'Could not access camera/microphone.' });
    }
  };

  const stopCircleRecording = (cancel = false) => {
    isRecordingRequestedRef.current = false;
    if (mediaRecorderRef.current && isRecordingCircle) {
        if (cancel) isRecordingCancelledRef.current = true;
        if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecordingCircle(false);
        setIsRecordingLocked(false);
        setRecordingOffset({ x: 0, y: 0 });
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        if (recordingStreamRef.current) {
            recordingStreamRef.current.getTracks().forEach(t => t.stop());
            recordingStreamRef.current = null;
        }
    }
  };

  const handlePointerDown = (e: React.PointerEvent, type: 'voice' | 'circle') => {
    if (isRecordingVoice || isRecordingCircle) return;
    e.preventDefault();
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    if (type === 'voice') startVoiceRecording();
    else startCircleRecording();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!touchStartPos.current || isRecordingLocked || isRecordingCancelledRef.current) return;
    
    const deltaX = e.clientX - touchStartPos.current.x;
    const deltaY = e.clientY - touchStartPos.current.y;
    
    const limitedX = Math.min(0, Math.max(deltaX, -150));
    const limitedY = Math.min(0, Math.max(deltaY, -150));
    
    setRecordingOffset({ x: limitedX, y: limitedY });

    if (deltaX < -100) {
        if (isRecordingVoice) stopVoiceRecording(true);
        else stopCircleRecording(true);
    } else if (deltaY < -100) {
        setIsRecordingLocked(true);
        setRecordingOffset({ x: 0, y: 0 });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    touchStartPos.current = null;
    if (!isRecordingLocked) {
        if (isRecordingVoice) stopVoiceRecording();
        else stopCircleRecording();
    }
  };

  const handleInitiateCall = async (video: boolean) => {
    if (item.type !== 'dm' || item.id === currentUser.uid) return;
    window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: item, otherUser, isVideo: video } }));
  };

  const handleStartGroupCall = async () => {
    if (!db || !isOwner) return;
    try {
      const callRef = doc(db, 'calls', item.id);
      await setDoc(callRef, {
        callerId: currentUser.uid,
        status: 'active',
        isGroupCall: true,
        callType: item.type === 'channel' ? 'broadcast' : 'video_chat',
        participants: [{
          uid: currentUser.uid,
          name: currentUser.name || currentUser.username,
          avatar: currentUser.avatar || '',
          joinedAt: Timestamp.now(),
          isSpeaking: false
        }]
      });
      setShowGroupCallDialog(true);
    } catch (e) {
      console.error("Failed to start group call", e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to start call.' });
    }
  };

  const handleClearHistory = async () => {
    if (!db || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
        const messagesRef = collection(db, 'chats', item.id, 'messages');
        const snapshot = await getDocs(messagesRef);
        const batch = writeBatch(db);
        snapshot.forEach(d => batch.delete(d.ref));
        
        const chatRef = doc(db, 'chats', item.id);
        batch.update(chatRef, { lastMessage: deleteField() });
        
        await batch.commit();
        toast({ title: t('dm_success'), description: t('profile_update_success') });
        setShowClearConfirm(false);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: t('unexpected_error') });
    } finally {
        setIsProcessingAction(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!db || !isOwner || item.id === 'GENERAL_CHAT' || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
        const chatRef = doc(db, 'chats', item.id);
        const messagesRef = collection(db, 'chats', item.id, 'messages');
        const snapshot = await getDocs(messagesRef);
        const batch = writeBatch(db);
        snapshot.forEach(d => batch.delete(d.ref));
        batch.delete(chatRef);
        if (item.link) {
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(item.link));
            batch.delete(linkRef);
        }
        await batch.commit();
        toast({ title: t('dm_success'), description: t('delete_chat_success') });
        setShowDeleteConfirm(false);
        onClose();
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: t('unexpected_error') });
    } finally {
        setIsProcessingAction(false);
    }
  };

  const handleLeaveChat = async () => {
    if (!db || item.id === 'GENERAL_CHAT' || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
        const chatRef = doc(db, 'chats', item.id);
        await updateDoc(chatRef, { members: arrayRemove(currentUser.uid) });
        toast({ title: t('dm_success'), description: t('leave_chat_success') });
        setShowLeaveConfirm(false);
        onClose();
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: t('unexpected_error') });
    } finally {
        setIsProcessingAction(false);
    }
  };

  const isLoading = messagesLoading || chatLoading || (allUserIdsToFetch.length > 0 && membersLoading);
  const isSavedMessagesChat = item.type === 'dm' && item.id === currentUser.uid;
  const isBotChat = item.type === 'dm' && otherUser?.isBot;
  const isEmptyBotChat = isBotChat && !isLoading && (!messages || messages.length === 0);

  return (
    <div className={cn("relative flex flex-col h-svh bg-background overflow-hidden", isMobile ? 'w-screen' : 'w-full')}>
      
      {(isRecordingVoice || isRecordingCircle) && (
        <div className={cn(
            "absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-300",
            isRecordingLocked ? "pointer-events-auto" : "pointer-events-none"
        )}>
            <div className="bg-card border-2 border-primary/30 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full pointer-events-auto">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    <div className="relative bg-primary text-primary-foreground p-6 rounded-full shadow-lg">
                        {isRecordingCircle ? <Camera className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
                    </div>
                </div>
                
                <div className="text-center space-y-2">
                    <div className="text-4xl font-black font-mono tracking-tighter text-primary">
                        {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                    </div>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        {isRecordingCircle ? t('video') : t('voice_message')}
                    </p>
                </div>

                {isRecordingCircle && (
                    <div className="w-full aspect-square max-w-[200px] rounded-full overflow-hidden border-4 border-primary/20 bg-black relative">
                        <video ref={recordingVideoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
                    </div>
                )}

                <div className="w-full space-y-3 pt-4">
                    {isRecordingLocked ? (
                        <div className="flex gap-2 w-full">
                            <Button variant="destructive" className="flex-1 rounded-2xl h-12 font-bold" onClick={() => isRecordingCircle ? stopCircleRecording(true) : stopVoiceRecording(true)}>
                                <Trash className="mr-2 h-4 w-4" /> {t('cancel')}
                            </Button>
                            <Button className="flex-1 rounded-2xl h-12 font-bold" onClick={async () => {
                                if (isRecordingCircle) stopCircleRecording();
                                else stopVoiceRecording();
                            }}>
                                <Send className="mr-2 h-4 w-4" /> {t('start_chat')}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 text-center">
                            <div className="flex flex-col items-center gap-2 text-primary animate-bounce">
                                <Lock className="h-4 w-4" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      <header className={cn(
          "flex-shrink-0 flex flex-col border-b pt-[calc(0.5rem+env(safe-area-inset-top))] bg-background sticky top-0 z-30",
          colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background'
      )}>
        <div className="flex items-center p-2 h-14">
            <Button variant="ghost" size="icon" onClick={onClose} className="mr-2 shrink-0">
                <X className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 flex items-center min-w-0 overflow-hidden h-12">
                {item.type === "dm" ? (
                    otherUser ? ( 
                        <button
                            className="flex items-center text-left hover:bg-accent px-3 py-1 rounded-md transition-colors min-w-0 flex-1 overflow-hidden h-full"
                            onClick={() => setProfileDialogUser(otherUser)}
                            disabled={otherUser.id === currentUser.uid || !!otherUser.isDeleted}
                        >
                            <UserAvatarWithStatus user={otherUser} isSavedMessages={isSavedMessagesChat} />
                            <div className="ml-3 min-w-0 overflow-hidden flex flex-col justify-center h-full">
                                <div className="flex items-center gap-2 min-0">
                                    <h2 className="text-lg font-semibold font-headline truncate leading-none">{getChatName()}</h2>
                                    {!isSavedMessagesChat && (
                                        <>
                                            {(otherUser?.username === '@InfiniteBot' || otherUser?.username === '@VeoBot') && <VerifiedBadge className="shrink-0" />}
                                            {otherUser.subscriptionTier === 'prem' && otherUser.showPremBadge && <PremBadge className="shrink-0" />}
                                            {otherUser.isBetaTester && <BetaBadge className="shrink-0" />}
                                        </>
                                    )}
                                </div>
                                {otherUser.id !== currentUser.uid && (
                                    <div className="text-sm text-muted-foreground truncate h-5 mt-1 leading-none">
                                        {getStatusText(otherUser)}
                                    </div>
                                )}
                            </div>
                        </button>
                    ) : ( 
                        <div className="flex items-center min-w-0 h-full">
                            <div className='w-10 h-10 bg-muted rounded-full animate-pulse' />
                            <div className="ml-3 space-y-2">
                                <div className='h-4 w-32 bg-muted rounded animate-pulse' />
                                <div className='h-3 w-24 bg-muted rounded animate-pulse' />
                            </div>
                        </div>
                    )
                ) : ( 
                    <button 
                        className="flex items-center text-left hover:bg-accent px-3 py-1 rounded-md transition-colors min-w-0 flex-1 overflow-hidden h-full"
                        onClick={() => setShowChatProfile(true)}
                        disabled={item.id === 'GENERAL_CHAT'}
                    >
                        <Avatar className="h-10 w-10 mr-3 shrink-0">
                            {item.avatar ? (
                                <AvatarImage src={item.avatar} alt={item.name} />
                            ) : (
                                <AvatarFallback>
                                    {item.iconComponent && <item.iconComponent className="h-5 w-5" />}
                                </AvatarFallback>
                            )}
                        </Avatar>
                        <div className="min-0 overflow-hidden flex flex-col justify-center h-full">
                            <div className="flex items-center gap-2 min-0">
                                <h2 className="text-lg font-semibold font-headline truncate leading-none">{getChatName()}</h2>
                                {(item.link === '/G/Infinite' || item.link === '/C/Infinite') && <VerifiedBadge className="shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground truncate mt-1 leading-none">
                                {item.id === 'GENERAL_CHAT'
                                    ? t('public_chat_description')
                                    : t(item.type === 'channel' ? 'subscribers_count' : 'members_count', { count: item.members?.length || 0 })}
                            </p>
                        </div>
                    </button>
                )}
            </div>

            <div className="flex items-center gap-1 ml-2 shrink-0">
                {item.type === 'dm' && item.id !== currentUser.uid && otherUser && !otherUser.isBot && (
                    <>
                        <Button variant="ghost" size="icon" onClick={() => handleInitiateCall(false)}>
                            <Phone className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleInitiateCall(true)}>
                            <Video className="h-5 w-5" />
                        </Button>
                    </>
                )}
                {item.type !== 'dm' && isOwner && !activeGroupCall && (
                <Button variant="ghost" size="icon" onClick={handleStartGroupCall}>
                    <Radio className="h-5 w-5" />
                </Button>
                )}
                
                {item.id !== 'GENERAL_CHAT' && (
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {item.id !== currentUser.uid && (
                                <DropdownMenuItem onSelect={() => setShowChatProfile(true)}>
                                    <Info className="mr-2 h-4 w-4" />
                                    <span>{t('info')}</span>
                                </DropdownMenuItem>
                            )}
                            {(item.id === currentUser.uid || isOwner || (item.type === 'dm' && item.id !== currentUser.uid)) && (
                                <DropdownMenuItem onSelect={() => setShowClearConfirm(true)}>
                                    <Trash className="mr-2 h-4 w-4" />
                                    <span>{t('clear_history')}</span>
                                </DropdownMenuItem>
                            )}
                            {item.id !== currentUser.uid && (
                                <>
                                    <DropdownMenuSeparator />
                                    {isOwner || item.type === 'dm' ? (
                                        <DropdownMenuItem onSelect={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            <span>{t('delete_chat')}</span>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onSelect={() => setShowLeaveConfirm(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                            <LogOut className="mr-2 h-4 w-4" />
                                            <span>{t('leave')}</span>
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>

        {isBirthdayToday && (
            <div className="px-4 py-3 bg-gradient-to-r from-orange-400/20 to-rose-400/20 flex items-center justify-between border-t border-orange-500/10 animate-in slide-in-from-top duration-500">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                        <Cake className="h-6 w-6 text-orange-600 animate-bounce" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-sm leading-tight truncate">
                            {otherUserAge 
                                ? t('birthday_banner_age', { name: otherUser?.name, age: otherUserAge }) 
                                : t('birthday_banner_today', { name: otherUser?.name })}
                        </p>
                        <button 
                            className="text-[10px] font-black uppercase tracking-widest text-orange-700 hover:text-orange-800 transition-colors flex items-center gap-1 mt-1"
                            onClick={() => setProfileDialogUser(otherUser)}
                        >
                            <Gift className="h-3 w-3" />
                            {t('send_gold')}
                        </button>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground/60" onClick={() => setDismissedBirthdays(prev => new Set(prev).add(item.id))}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        )}
      </header>

      <div className="relative flex-1 bg-background overflow-hidden min-h-0 flex flex-col">
          {activeGroupCall && (
            <div className="bg-primary/10 border-b flex items-center justify-between px-4 py-2 shrink-0 animate-in slide-in-from-top duration-300 z-10 relative">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest">{activeGroupCall.callType === 'broadcast' ? t('broadcast_live') : t('video_chat_live')}</span>
              </div>
              <Button size="sm" className="h-7 rounded-full text-[10px] font-bold px-4" onClick={() => setShowGroupCallDialog(true)}>
                {t('join_call')}
              </Button>
            </div>
          )}
          {stickyDate && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex justify-center py-2 pointer-events-none">
                  <Badge variant="secondary">{stickyDate}</Badge>
              </div>
          )}
          <div 
            ref={scrollContainerRef} 
            onScroll={handleScroll} 
            className="flex-1 overflow-y-auto px-2 md:px-4 flex flex-col relative min-h-0"
          >
              <div ref={loadMoreSentinelRef} className="h-1 flex-shrink-0" />
              <div className="flex-1" />

              {isLoading && messageLimit === 50 ? (
                  <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
              ) : isMember && messages && messages.length > 0 ? (
                  <div className="messages-list-inner space-y-2 py-4 flex flex-col relative">
                      {messages.map((message, index) => {
                          const sender = memberDetails[message.senderId];
                          const messageDate = getSafeDate(message.timestamp);
                          const prevMessage = index > 0 ? messages[index - 1] : null;
                          const prevMessageDate = prevMessage ? getSafeDate(prevMessage.timestamp) : null;
                          const showDateSeparator = !prevMessageDate || !isSameDay(messageDate, prevMessageDate);

                          const handleToggleMessageReaction = async (emoji: string) => {
                            if (!db) return;
                            const messageRef = doc(db, 'chats', item.id, 'messages', message.id);
                            const currentReactions = message.reactions || {};
                            let alreadyMatchedEmoji: string | null = null;
                            Object.entries(currentReactions).forEach(([key, voters]) => {
                                if (Array.isArray(voters) && voters.includes(currentUser.uid)) {
                                    alreadyMatchedEmoji = key;
                                }
                            });
                            const updates: Record<string, any> = {};
                            if (alreadyMatchedEmoji === emoji) {
                                updates[`reactions.${emoji}`] = arrayRemove(currentUser.uid);
                            } else {
                                if (alreadyMatchedEmoji) updates[`reactions.${alreadyMatchedEmoji}`] = arrayRemove(currentUser.uid);
                                updates[`reactions.${emoji}`] = arrayUnion(currentUser.uid);
                            }
                            try { await updateDoc(messageRef, updates); } catch (e) { console.error(e); }
                          };

                          const handleVoteLocal = async (optionIndex: number) => {
                            if (!db || !message.poll) return;
                            const msgRef = doc(db, 'chats', item.id, 'messages', message.id);
                            try {
                                await runTransaction(db, async (transaction) => {
                                    const snap = await transaction.get(msgRef);
                                    if (!snap.exists()) return;
                                    const currentPoll = snap.data().poll as Poll;
                                    const newOptions = [...currentPoll.options];
                                    const userId = currentUser.uid;
                                    if (currentPoll.isMultipleChoice) {
                                        const isVoted = newOptions[optionIndex].votes.includes(userId);
                                        if (isVoted) newOptions[optionIndex].votes = newOptions[optionIndex].votes.filter(id => id !== userId);
                                        else newOptions[optionIndex].votes.push(userId);
                                    } else {
                                        const alreadyVotedIndex = newOptions.findIndex(o => o.votes.includes(userId));
                                        if (alreadyVotedIndex === optionIndex) newOptions[optionIndex].votes = newOptions[optionIndex].votes.filter(id => id !== userId);
                                        else {
                                            if (alreadyVotedIndex !== -1) newOptions[alreadyVotedIndex].votes = newOptions[alreadyVotedIndex].votes.filter(id => id !== userId);
                                            newOptions[optionIndex].votes.push(userId);
                                        }
                                    }
                                    transaction.update(msgRef, { poll: { ...currentPoll, options: newOptions } });
                                });
                            } catch (e) { console.error(e); }
                          };

                          return (
                              <React.Fragment key={message.id}>
                                  {showDateSeparator && <DateSeparator date={format(messageDate, 'dd.MM.yyyy')} />}
                                  <div className="message-stagger-item">
                                      <ChatMessage 
                                          message={message} 
                                          sender={sender}
                                          isCurrentUser={message.senderId === currentUser.uid} 
                                          chatType={item.type} 
                                          onAvatarClick={setProfileDialogUser}
                                          chat={item}
                                          currentUser={currentUser}
                                          onInternalLinkClick={handleInternalLinkClick}
                                          onReply={handleReply}
                                          setEditingMessage={handleSetEditingMessage}
                                          onMediaLoad={handleMediaLoad}
                                          localMediaUrl={localMediaCache[message.id]}
                                          onPreviewImage={setPreviewImage}
                                          memberDetails={memberDetails}
                                          onSelectChat={onSelectChat}
                                          onForward={(m) => setForwardingMessage(m)}
                                          onVote={handleVoteLocal}
                                          onToggleReaction={handleToggleMessageReaction}
                                          isMobile={isMobile}
                                          isActiveOnMobile={activeMessageId === message.id}
                                          onToggleActiveOnMobile={() => setActiveMessageId(prev => prev === message.id ? null : message.id)}
                                      />
                                  </div>
                              </React.Fragment>
                          );
                      })}
                      <div ref={messagesEndRef} className="h-px shrink-0" />
                  </div>
              ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground p-4">
                      {isMember ? <p>{t('no_messages_yet')}</p> : <><Users className="h-16 w-16 mb-4 text-muted-foreground/50" /><h3 className="text-xl font-semibold">{t('you_left_the_group')}</h3></>}
                  </div>
              )}
          </div>
      </div>

      {canSendMessage && (
        <footer className={cn(
            "flex-shrink-0 p-2 md:p-3 border-t bg-background",
            "pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]",
            colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background'
        )}>
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            {isEmptyBotChat ? (
                <div className="flex flex-col items-center gap-4 py-8 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Bot className="h-10 w-10" />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="font-bold text-lg">{t('bot_studio_title')}</h3>
                        <p className="text-xs text-muted-foreground max-w-[240px]">{otherUser?.statusMessage || t('bot_studio_desc')}</p>
                    </div>
                    <Button onClick={() => handleSendMessage('/start')} className="w-full max-w-[200px] h-14 rounded-full text-xl font-black shadow-xl shadow-primary/20 tracking-tighter">
                        {t('start_button')}
                    </Button>
                </div>
            ) : (
            <>
                {replyToMessage && (
                    <div className="flex items-center justify-between bg-muted p-2 rounded-md animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center gap-2 min-0">
                            <Reply className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-primary truncate">{replyToMessage.sender?.name || replyToMessage.senderName}</div>
                                <div className="text-xs text-muted-foreground truncate">{replyToMessage.content}</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyToMessage(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                {editingMessage && (
                    <div className="flex items-center justify-between bg-muted p-2 rounded-md animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center gap-2 min-0">
                            <Edit className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-primary">{t('editing_message')}</div>
                                <div className="text-xs text-muted-foreground truncate">{editingMessage.content}</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                {fileToSend && (
                    <div className="flex items-center justify-between bg-muted p-2 rounded-md animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center gap-2 min-0">
                            {fileToSend.type === 'image' ? <ImageIcon className="h-4 w-4 text-primary shrink-0" /> : fileToSend.type === 'video' ? <VideoIcon className="h-4 w-4 text-primary shrink-0" /> : fileToSend.type === 'music' ? <MusicIcon className="h-4 w-4 text-primary shrink-0" /> : <FileIcon className="h-4 w-4 text-primary shrink-0" />}
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-primary">{fileToSend.file.name || t('image_attachment_alt')}</div>
                                <div className="text-[10px] text-muted-foreground">{(fileToSend.file.size / (1024 * 1024)).toFixed(2)} MB</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFileToSend(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="flex items-end gap-2 relative">
                    <div className="relative flex-1">
                        <Textarea
                            placeholder={item.type === 'channel' ? t('publish_placeholder') : t('message_placeholder')}
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                            onKeyDown={(e) => {
                                if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            className="min-h-[38px] h-[38px] max-h-32 resize-none placeholder:truncate bg-muted/50 border-none rounded-2xl"
                        />
                    </div>

                    <div className="flex items-center gap-1 shrink-0 h-[38px]">
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9">
                                    <Paperclip className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="top">
                                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b mb-1">
                                    {t('max_file_size_label', { size: maxFileSizeText })}
                                </div>
                                <DropdownMenuItem onSelect={() => handleAttachmentClick('image')}>
                                    <ImageIcon className="mr-2 h-4 w-4" /> {t('photo')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleAttachmentClick('video')}>
                                    <VideoIcon className="mr-2 h-4 w-4" /> {t('video')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleAttachmentClick('music')}>
                                    <MusicIcon className="mr-2 h-4 w-4" /> {t('music')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleAttachmentClick('file')}>
                                    <FileIcon className="mr-2 h-4 w-4" /> {t('file')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleAttachmentClick('poll')}>
                                    <ListTodo className="mr-2 h-4 w-4" /> {t('poll')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                        {(messageContent.trim() || fileToSend) ? (
                            <Button type="submit" size="icon" disabled={isSending} className="h-9 w-9 rounded-full shadow-lg">
                                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            </Button>
                        ) : (
                            <div className="flex items-center gap-1">
                                <Button type="button" size="icon" variant="ghost" className={cn("h-9 w-9 rounded-full transition-all", isRecordingCircle && "text-primary scale-125")} onPointerDown={(e) => handlePointerDown(e, 'circle')} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}><Camera className="h-5 w-5" /></Button>
                                <Button type="button" size="icon" variant="ghost" className={cn("h-9 w-9 rounded-full transition-all", isRecordingVoice && "text-primary scale-125")} onPointerDown={(e) => handlePointerDown(e, 'voice')} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}><Mic className="h-5 w-5" /></Button>
                            </div>
                        )}
                    </div>
                </form>
            </>
            )}
          </div>
        </footer>
      )}

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t('clear_history')}?</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleClearHistory} disabled={isProcessingAction} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">{isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : t('delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t('delete_chat_confirm')}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDeleteChat} disabled={isProcessingAction} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">{isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : t('delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t(item.type === 'group' ? 'leave_group_confirm' : 'leave_channel_confirm')}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleLeaveChat} disabled={isProcessingAction} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">{isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : t('leave')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {profileDialogUser && <UserProfileDialog user={profileDialogUser} open={!!profileDialogUser} onOpenChange={(open) => !open && setProfileDialogUser(null)} onSendMessage={handleSendMessageToUser} />}
      {showChatProfile && <ChatProfileDialog chat={item} members={Object.values(memberDetails).filter(u => item.members.includes(u.id))} currentUser={currentUser} open={showChatProfile} onOpenChange={setShowChatProfile} onCloseChat={onClose} onJoinDiscussion={handleJoinDiscussion} />}
      <GroupCallDialog open={showGroupCallDialog} onOpenChange={setShowGroupCallDialog} chat={item} currentUser={currentUser} isOwner={isOwner} />
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
            <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 overflow-hidden border-none bg-black/95 text-white flex flex-col">
                <div className="absolute top-4 right-4 z-50">
                    <Button variant="ghost" size="icon" onClick={() => setPreviewImage(null)} className="rounded-full bg-white/10 hover:bg-white/20 text-white">
                        <X className="h-6 w-6" />
                    </Button>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl" />
                </div>
            </DialogContent>
        </Dialog>
      )}
      <FaqDialog open={showFaqDialog} onOpenChange={setShowFaqDialog} />
      <NewPollDialog open={showNewPoll} onOpenChange={setShowNewPoll} onSubmit={handleSendPoll} />
      <ForwardMessageDialog open={!!forwardingMessage} onOpenChange={(open) => !open && setForwardingMessage(null)} onForward={handleForward} currentUser={currentUser} />
    </div>
  );
}

function ChatMessage({ message, sender, isCurrentUser, chatType, onAvatarClick, chat, currentUser, onInternalLinkClick, onReply, setEditingMessage, onMediaLoad, localMediaUrl, onPreviewImage, memberDetails, onSelectChat, onForward, onVote, onToggleReaction, isMobile, isActiveOnMobile, onToggleActiveOnMobile }: { message: Message, sender?: User, isCurrentUser: boolean, chatType: PopulatedChat['type'], onAvatarClick: (user: User) => void, chat: PopulatedChat, currentUser: AuthenticatedUser, onInternalLinkClick: (href: string) => Promise<void>, onReply: (message: Message) => void, setEditingMessage: (message: Message | null) => void, onMediaLoad: () => void, localMediaUrl?: string; onPreviewImage: (url: string) => void; memberDetails: Record<string, User>; onSelectChat: (chat: PopulatedChat) => void; onForward: (message: Message) => void; onVote: (index: number) => void; onToggleReaction: (emoji: string) => void; isMobile: boolean; isActiveOnMobile?: boolean; onToggleActiveOnMobile?: () => void; }) {
    const db = useFirestore();
    const { t } = useLanguage();
    const { toast } = useToast();
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [musicUrl, setMusicUrl] = useState<string | null>(null);
    const [isLoadingMusic, setIsLoadingMusic] = useState(false);
    const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
    const [circleUrl, setCircleUrl] = useState<string | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);
    
    const messageRef = useRef<HTMLDivElement>(null);
    const circleVideoRef = useRef<HTMLVideoElement>(null);
    const isMentionAll = useMemo(() => message.content?.toLowerCase().includes('@all'), [message.content]);

    useEffect(() => {
        const checkCache = async () => {
            const cached = await getCachedFile(message.id);
            if (cached) {
                if (message.videoMimeType) setVideoUrl(cached);
                else if (message.musicMimeType) setMusicUrl(cached);
                else if (message.fileName && !message.imageUrl) setFileUrl(cached);
                else if (message.voiceStatus === 'complete') setVoiceUrl(cached);
                else if (message.circleStatus === 'complete') setCircleUrl(cached);
                else if (message.imageUrl) setCachedImageUrl(cached);
            } else if (localMediaUrl) {
                if (message.videoMimeType) setVideoUrl(localMediaUrl);
                else if (message.musicMimeType) setMusicUrl(localMediaUrl);
                else if (message.imageUrl) setCachedImageUrl(localMediaUrl);
            }
        };
        checkCache();
    }, [message.id, message.videoMimeType, message.musicMimeType, message.imageUrl, localMediaUrl, message.voiceStatus, message.circleStatus]);

    useEffect(() => {
        if (!messageRef.current) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                if (message.videoStatus === 'complete' && !videoUrl && !isLoadingVideo) fetchAndCacheVideo();
                if (message.musicStatus === 'complete' && !musicUrl && !isLoadingMusic) fetchAndCacheMusic();
                if (message.fileStatus === 'complete' && !fileUrl && !isLoadingFile) fetchAndCacheFile();
                if (message.voiceStatus === 'complete' && !voiceUrl) fetchAndCacheVoice();
                if (message.circleStatus === 'complete' && !circleUrl) fetchAndCacheCircle();
                if (message.imageUrl && !cachedImageUrl) cacheImage();
                observer.disconnect();
            }
        }, { threshold: 0.1 });
        observer.observe(messageRef.current);
        return () => observer.disconnect();
    }, [videoUrl, musicUrl, fileUrl, voiceUrl, circleUrl, cachedImageUrl, message.videoStatus, message.musicStatus, message.fileStatus, message.voiceStatus, message.circleStatus]);

    const cacheImage = async () => {
        if (!message.imageUrl || cachedImageUrl) return;
        const url = await fetchAndCacheImage(message.id, message.imageUrl);
        if (url) setCachedImageUrl(url);
    };

    const fetchAndCacheVideo = async () => {
        if (!db || !message.videoChunkIds || videoUrl || isLoadingVideo) return;
        setIsLoadingVideo(true);
        try {
            const chunkSnaps = await Promise.all(message.videoChunkIds.map(id => getDoc(doc(db, 'videoChunks', id))));
            const chunksData = chunkSnaps.map(s => s.data() as any).sort((a,b) => a.part - b.part);
            const assembledBase64 = chunksData.map(c => c.data).join('');
            const dataUrl = `data:${message.videoMimeType};base64,${assembledBase64}`;
            await cacheFile(message.id, dataUrl);
            setVideoUrl(await getCachedFile(message.id));
            onMediaLoad();
        } catch (e) { console.error(e); } finally { setIsLoadingVideo(false); }
    };

    const fetchAndCacheMusic = async () => {
        if (!db || !message.musicChunkIds || musicUrl || isLoadingMusic) return;
        setIsLoadingMusic(true);
        try {
            const chunkSnaps = await Promise.all(message.musicChunkIds.map(id => getDoc(doc(db, 'musicChunks', id))));
            const chunksData = chunkSnaps.map(s => s.data() as any).sort((a,b) => a.part - b.part);
            const assembledBase64 = chunksData.map(c => c.data).join('');
            const dataUrl = `data:${message.musicMimeType};base64,${assembledBase64}`;
            await cacheFile(message.id, dataUrl);
            setMusicUrl(await getCachedFile(message.id));
            onMediaLoad();
        } catch (e) { console.error(e); } finally { setIsLoadingMusic(false); }
    };

    const fetchAndCacheVoice = async () => {
        if (!db || !message.voiceChunkIds || voiceUrl) return;
        try {
            const chunkSnaps = await Promise.all(message.voiceChunkIds.map(id => getDoc(doc(db, 'voiceChunks', id))));
            const chunksData = chunkSnaps.map(s => s.data() as any).sort((a,b) => a.part - b.part);
            const assembledBase64 = chunksData.map(c => c.data).join('');
            const dataUrl = `data:${message.voiceMimeType};base64,${assembledBase64}`;
            await cacheFile(message.id, dataUrl);
            setVoiceUrl(await getCachedFile(message.id));
            onMediaLoad();
        } catch (e) { console.error(e); }
    };

    const fetchAndCacheCircle = async () => {
        if (!db || !message.circleChunkIds || circleUrl) return;
        try {
            const chunkSnaps = await Promise.all(message.circleChunkIds.map(id => getDoc(doc(db, 'circleChunks', id))));
            const chunksData = chunkSnaps.map(s => s.data() as any).sort((a,b) => a.part - b.part);
            const assembledBase64 = chunksData.map(c => c.data).join('');
            const dataUrl = `data:${message.circleMimeType};base64,${assembledBase64}`;
            await cacheFile(message.id, dataUrl);
            setCircleUrl(await getCachedFile(message.id));
            onMediaLoad();
        } catch (e) { console.error(e); }
    };

    const fetchAndCacheFile = async () => {
        if (!db || !message.fileChunkIds || fileUrl || isLoadingFile) return;
        setIsLoadingFile(true);
        try {
            const chunkSnaps = await Promise.all(message.fileChunkIds.map(id => getDoc(doc(db, 'fileChunks', id))));
            const chunksData = chunkSnaps.map(s => s.data() as any).sort((a,b) => a.part - b.part);
            const assembledBase64 = chunksData.map(c => c.data).join('');
            const dataUrl = `data:${message.fileMimeType};base64,${assembledBase64}`;
            await cacheFile(message.id, dataUrl);
            setFileUrl(await getCachedFile(message.id));
            onMediaLoad();
        } catch (e) { console.error(e); } finally { setIsLoadingFile(false); }
    };

    const handleCopy = () => {
        if (message.content) {
            navigator.clipboard.writeText(message.content);
            toast({ title: t('copy_success_toast') });
        }
    };

    const handleDelete = async () => {
        if (!db) return;
        const messageRef = doc(db, 'chats', chat.id, 'messages', message.id);
        try {
            await deleteDoc(messageRef);
        } catch (serverError) {
             const permissionError = new FirestorePermissionError({
                path: messageRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };

    const isRead = useMemo(() => {
        if (!isCurrentUser || !message.readBy) return false;
        const otherId = chat.members.find(id => id !== currentUser.uid);
        if (chat.type === 'dm') return otherId ? message.readBy.includes(otherId) : false;
        if (chat.type === 'group') return message.readBy.some(readerId => readerId !== currentUser.uid);
        return false;
    }, [message.readBy, chat.type, currentUser.uid, isCurrentUser]);

    const handleAvatarClick = () => {
        if (message.type === 'announcement' && message.fromChannelId) {
             onSelectChat({ id: message.fromChannelId, type: 'channel', members: [] } as any);
             return;
        }
        if (sender && !isCurrentUser && !sender.isDeleted) onAvatarClick(sender);
    };

    const alignRight = isCurrentUser && message.type !== 'announcement' && chatType !== 'channel';
    const isCircle = message.circleStatus === 'complete';
    const displayName = message.type === 'announcement' ? (message.senderName || 'Infinite') : (sender?.isDeleted ? t('deleted_account') : sender?.name);

    return (
        <div ref={messageRef} id={`message-${message.id}`} className={cn("group flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300", alignRight ? "flex-row-reverse outgoing-msg" : "flex-row incoming-msg")} onClick={() => isMobile && onToggleActiveOnMobile?.()}>
            {((chatType === 'group' && !isCurrentUser) || message.type === 'announcement') ? (
                 <div className="w-10 h-10 flex-shrink-0">
                    <button onClick={handleAvatarClick} disabled={isCurrentUser || (message.type === 'announcement' && !message.fromChannelId) || (sender && !!sender.isDeleted)}>
                        {message.senderAvatar === 'is_channel_message' ? <Avatar className="h-10 w-10"><AvatarFallback className="bg-secondary"><Megaphone className="h-5 w-5" /></AvatarFallback></Avatar> : <UserAvatarWithStatus user={message.type === 'announcement' ? { id: 'bot', name: message.senderName || 'Infinite', avatar: message.senderAvatar, isBot: true } as any : sender!} />}
                    </button>
                 </div>
            ) : chatType === 'group' && !alignRight ? <div className="w-10 flex-shrink-0" /> : null}

            <div className={cn("min-w-0 flex flex-col relative transition-all duration-300", isCircle ? "p-0" : (alignRight ? "bg-primary text-primary-foreground rounded-lg p-2 rounded-br-none max-w-[75%] md:max-w-[60%]" : "bg-card text-card-foreground rounded-lg p-2 rounded-bl-none max-w-[75%] md:max-w-[60%]"), isMentionAll && !isCurrentUser && !isCircle && "ring-2 ring-amber-400")}>
                {((chatType === 'group' && !isCurrentUser) || chatType === 'channel' || message.type === 'announcement') && !isCircle && (
                    <div className="font-semibold text-sm mb-0.5 flex items-center gap-2">
                        <span className="truncate">{displayName}</span>
                        {sender?.username === '@InfiniteBot' && <VerifiedBadge className='shrink-0' />}
                    </div>
                )}
                {message.replyTo && !isCircle && (
                    <button onClick={() => document.getElementById(`message-${message.replyTo?.messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={cn("mb-1.5 p-1.5 rounded-md w-full text-left truncate", alignRight ? "bg-black/10" : "bg-muted")}>
                        <div className="text-[10px] font-bold opacity-70">{message.replyTo.senderName}</div>
                        <div className="text-[11px] truncate">{message.replyTo.content}</div>
                    </button>
                )}
                <div className="overflow-hidden">
                    {message.voiceStatus === 'complete' && <CustomAudioPlayer src={voiceUrl || null} hideTime={true} />}
                    {message.circleStatus === 'complete' && (
                        <div className="rounded-full overflow-hidden w-48 h-48 bg-black">
                            {circleUrl && <video ref={circleVideoRef} src={circleUrl} autoPlay muted loop playsInline className="w-full h-full object-cover rounded-full" />}
                        </div>
                    )}
                    {message.videoMimeType && !isCircle && (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center cursor-pointer" onClick={fetchAndCacheVideo}>
                            {videoUrl ? <video src={videoUrl} controls className="max-w-full rounded-lg" /> : <Play className="h-10 w-10 opacity-30" />}
                        </div>
                    )}
                    {message.musicMimeType && <CustomAudioPlayer src={musicUrl || null} isMusic={true} fileName={message.fileName} />}
                    {message.imageUrl && <img src={cachedImageUrl || message.imageUrl} onClick={() => onPreviewImage(message.imageUrl!)} className="max-w-full max-h-[450px] w-auto object-contain rounded-lg cursor-pointer" onLoad={onMediaLoad} />}
                    {message.poll && <PollDisplay poll={message.poll} onVote={onVote} currentUserId={currentUser.uid} alignRight={alignRight} memberDetails={memberDetails} />}
                    
                    {message.content && !message.poll && (
                        <div className={cn("text-sm break-words whitespace-pre-wrap", (message.imageUrl || message.videoMimeType || message.musicMimeType || message.circleStatus || message.voiceStatus) && "mt-2")}>
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    a: ({node, ...props}) => {
                                        const isInternal = props.href?.startsWith('@') || props.href?.startsWith('/') || props.href?.toLowerCase().startsWith('infinite://');
                                        const handleClick = (e: React.MouseEvent) => {
                                            if (isInternal) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onInternalLinkClick(props.href!);
                                            }
                                        };
                                        
                                        return (
                                            <a 
                                                href={isInternal ? undefined : props.href}
                                                onClick={handleClick} 
                                                className={cn(
                                                    "underline font-bold transition-colors cursor-pointer",
                                                    (alignRight && chatType !== 'channel') ? "text-white" : "text-primary"
                                                )}
                                                target={isInternal ? undefined : "_blank"}
                                                rel={isInternal ? undefined : "noopener noreferrer"}
                                            >
                                                {props.children}
                                            </a>
                                        );
                                    }
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
                <div className={cn("flex items-center gap-1.5 mt-0.5 text-[9px] self-end", isCircle ? "absolute bottom-0 right-0 bg-black/50 px-1 rounded" : "opacity-70")}>
                    {message.editedAt && (
                        <span className="font-bold">{t('edited')}</span>
                    )}
                    <span>{format(getSafeDate(message.timestamp), 'HH:mm')}</span>
                    {isCurrentUser && !isCircle && (isRead ? <CheckCheck className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />)}
                </div>
            </div>

            <div className={cn("flex-shrink-0 self-center w-8 flex justify-center transition-all", isMobile ? (isActiveOnMobile ? "opacity-100" : "opacity-0 pointer-events-none") : "opacity-0 group-hover:opacity-100", !alignRight && "order-last")}>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align={alignRight ? 'end' : 'start'}>
                        <DropdownMenuItem onSelect={() => onReply(message)}><Reply className="mr-2 h-4 w-4" /><span>{t('reply')}</span></DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onForward(message)}><Forward className="mr-2 h-4 w-4" /><span>{t('forward')}</span></DropdownMenuItem>
                        <DropdownMenuItem onSelect={handleCopy}><Copy className="mr-2 h-4 w-4" /><span>{t('copy_text')}</span></DropdownMenuItem>
                        {isCurrentUser && !message.poll && !message.voiceStatus && !message.circleStatus && <DropdownMenuItem onSelect={() => handleSetEditingMessage(message)}><Edit className="mr-2 h-4 w-4" /><span>{t('edit_message')}</span></DropdownMenuItem>}
                        {(isCurrentUser || chat.ownerId === currentUser.uid) && <DropdownMenuItem onSelect={handleDelete} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>{t('delete_message')}</span></DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
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
            return c.name?.toLowerCase().includes(search.toLowerCase());
        });
    }, [chats, search]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl flex flex-col h-[70vh]">
                <DialogHeader>
                    <DialogTitle>{t('forward_to')}</DialogTitle>
                    <DialogDescription>{t('select_target_chat')}</DialogDescription>
                </DialogHeader>
                <div className="px-1 py-2">
                    <Input 
                        placeholder={t('search_placeholder')} 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                        className="rounded-xl bg-muted/50 border-none"
                    />
                </div>
                <ScrollArea className="flex-1 pr-2">
                    <div className="space-y-1">
                        {loading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                        ) : filteredChats.length > 0 ? (
                            filteredChats.map(chat => (
                                <button 
                                    key={chat.id} 
                                    onClick={() => { onForward(chat.id); onOpenChange(false); }}
                                    className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-xl transition-colors text-left"
                                >
                                    <Avatar className="h-10 w-10 shrink-0">
                                        {chat.avatar ? <AvatarImage src={chat.avatar} /> : <AvatarFallback>{chat.type === 'dm' ? <UserIcon className="h-5 w-5" /> : <Users className="h-5 w-5" />}</AvatarFallback>}
                                    </Avatar>
                                    <div className="flex-1 truncate">
                                        <p className="font-bold text-sm truncate">{chat.id === 'GENERAL_CHAT' ? t('general_chat') : (chat.name || chat.id)}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{t(chat.type as any || 'direct_message_tab')}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center text-sm text-muted-foreground">{t('no_results_found')}</div>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full rounded-xl">{t('cancel')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}