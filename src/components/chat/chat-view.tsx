
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat, Call } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X, MoreVertical, User as UserIcon, Info, Trash2, Users, Megaphone, CheckCheck, Bookmark, Globe, Bot, Copy, Edit, Reply, CornerDownLeft, Check, Image as ImageIcon, Music as MusicIcon, Video as VideoIcon, Clock, File as FileIcon, Download, Save, Maximize2, SmilePlus, Radio, Mic, Camera, Play, Pause, Trash, Lock, CircleHelp, PhoneOff, LogOut } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, addDoc, increment, getDoc, setDoc, writeBatch, arrayUnion, deleteDoc, serverTimestamp, onSnapshot, orderBy, limit, arrayRemove, query, deleteField, getDocs } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format, isSameDay } from 'date-fns';
import { useLanguage } from '@/context/language-context';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { UserProfileDialog } from '../user-profile-dialog';
import { ChatProfileDialog } from './chat-profile-dialog';
import { CallDialog } from './call-dialog';
import { GroupCallDialog } from './group-call-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
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
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUpdatePrompt } from '@/context/update-prompt-context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaqDialog } from '../faq-dialog';
import { Badge } from '../ui/badge';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { VerifiedBadge } from '../ui/verified-badge';
import { useTheme } from '@/context/theme-context';
import { getCachedFile, cacheFile } from '@/lib/cache-utils';

export const COMMON_EMOJIS = [
    '👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '🙏', 
    '👏', '🎉', '🤔', '🤩', '😡', '💩', '💯', 
    '👀', '✅', '❌', '✨', '⚡️', '🚀', '🤝', '🤡', '💘', '🌚'
];

// Helper to safely handle Firestore Timestamps and avoid client-side crashes
const getSafeDate = (ts: any): Date => {
  if (ts && typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000);
  }
  return new Date(); // Fallback to now if timestamp is missing or pending
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
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [fileToSend, setFileToSend] = useState<{file: File, previewUrl: string, type: 'image' | 'video' | 'music' | 'file' | 'voice' | 'circle'} | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stickyDate, setStickyDate] = useState<string | null>(null);

  const [showCallDialog, setShowCallDialog] = useState(false);
  const [isCaller, setIsCaller] = useState(false);
  const [callIsVideo, setCallIsVideo] = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [localMediaCache, setLocalMediaCache] = useState<Record<string, string>>({});

  const [showGroupCallDialog, setShowGroupCallDialog] = useState(false);
  const [activeGroupCall, setActiveGroupCall] = useState<Call | null>(null);

  // Management State
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Recording State
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
    if (!db || !isMember || item.type !== 'dm' || !messageContent.trim()) return;
    
    const typingRef = doc(db, 'chats', item.id);
    updateDoc(typingRef, { [`typingStatus.${currentUser.uid}`]: true });

    const timeout = setTimeout(() => {
        updateDoc(typingRef, { [`typingStatus.${currentUser.uid}`]: false });
    }, 3000);

    return () => {
        clearTimeout(timeout);
        updateDoc(typingRef, { [`typingStatus.${currentUser.uid}`]: false }).catch(() => {});
    };
  }, [messageContent, db, isMember, item.id, item.type, currentUser.uid]);

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

  useEffect(() => {
    if (!db || item.type !== 'dm' || !isMember || !item.id.includes('_')) return; 
    const callDocRef = doc(db, 'calls', item.id);
    const unsubscribe = onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data() as Call;
        if (data && data.status === 'calling' && data.calleeId === currentUser.uid) {
            setIncomingCall({id: snapshot.id, ...data});
        }
        if (data && data.status === 'ended') {
            setIncomingCall(null);
        }
    });

    return () => unsubscribe();
  }, [db, item.id, item.type, currentUser.uid, isMember]);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !isMember) return null;
    return query(collection(db, 'chats', item.id, 'messages'), orderBy('timestamp'));
  }, [db, item.id, isMember]);

  const { data: messages, loading: messagesLoading } = useCollection<Message>(messagesQuery);
  
  const allUserIdsToFetch = useMemo(() => {
    const ids = new Set<string>(item.members || []);
    messages?.forEach(m => {
        ids.add(m.senderId);
        if (m.reactions) {
            Object.values(m.reactions).flat().forEach(uid => {
              if (typeof uid === 'string') ids.add(uid);
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
    if (db && currentUser?.uid && item.id && item.id !== 'GENERAL_CHAT' && isMember) {
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
    if (isOtherUserTyping) return <span className="text-primary font-bold animate-pulse">{t('searching')}...</span>;

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

  const initialLoadRef = useRef<Record<string, boolean>>({});
  const prevMessagesCountRef = useRef<Record<string, number>>({});

  const scrollToBottom = useCallback((behaviorOverride?: ScrollBehavior) => {
    if (scrollContainerRef.current) {
        const behavior = behaviorOverride || (smoothScroll ? 'smooth' : 'auto');
        const container = scrollContainerRef.current;
        
        const performScroll = () => {
            if (container) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior
                });
            }
        };

        requestAnimationFrame(performScroll);
        setTimeout(performScroll, 50);
        setTimeout(performScroll, 150);
        setTimeout(performScroll, 300);
        setTimeout(performScroll, 500);
        setTimeout(performScroll, 1000);
    }
  }, [smoothScroll]);

  useEffect(() => {
    if (messagesLoading || !messages) return;

    const currentChatId = item.id;
    const currentCount = messages.length;

    if (!initialLoadRef.current[currentChatId]) {
        initialLoadRef.current[currentChatId] = true;
        prevMessagesCountRef.current[currentChatId] = currentCount;
        scrollToBottom('auto');
    } else if (currentCount > (prevMessagesCountRef.current[currentChatId] || 0)) {
        scrollToBottom();
        prevMessagesCountRef.current[currentChatId] = currentCount;
    } else if (currentCount < (prevMessagesCountRef.current[currentChatId] || 0)) {
        prevMessagesCountRef.current[currentChatId] = currentCount;
    }
  }, [messages, messagesLoading, item.id, scrollToBottom]);

  useEffect(() => {
    if (item.id) {
        initialLoadRef.current[item.id] = false;
    }
  }, [item.id]);

  const handleMediaLoad = useCallback(() => {
    if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 250;
        if (isNearBottom) {
            scrollToBottom();
        }
    }
  }, [scrollToBottom]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollTop } = container;
        const dateSeparators = container.querySelectorAll<HTMLElement>('[data-date-separator]');
        
        let currentStickyDate: string | null = null;
        
        if (dateSeparators.length > 0) {
            const firstSeparator = dateSeparators[0];
            if (firstSeparator && scrollTop < firstSeparator.offsetTop) {
                currentStickyDate = null;
            } else {
                for (let i = 0; i < dateSeparators.length; i++) {
                    const separator = dateSeparators[i];
                    if (separator && separator.offsetTop <= scrollTop + 5) {
                        currentStickyDate = separator.dataset.dateSeparator || null;
                    } else {
                        break;
                    }
                }
            }
        }
        setStickyDate(currentStickyDate);

    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        handleScroll(); 
    }, [handleScroll, messages]); 


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
        let targetChat: Chat | null = null;
        const processedHref = href.startsWith('/') ? href : href.toLowerCase();

        if (processedHref.startsWith('@')) {
            const usernameRef = doc(db, 'usernames', processedHref);
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
            }
        } else if (processedHref.startsWith('/G/') || processedHref.startsWith('/C/')) {
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(processedHref));
            const linkSnap = await getDoc(linkRef);
            if (linkSnap.exists()) {
                const chatId = linkSnap.data().chatId;
                const chatRef = doc(db, 'chats', chatId);
                const chatSnap = await getDoc(chatRef);
                if (chatSnap.exists()) {
                    targetChat = { id: chatSnap.id, ...chatSnap.data() } as Chat;
                }
            }
        }

        if (targetChat) {
            const iconName = targetChat.icon as keyof typeof iconMap | undefined;
            const populatedChat: PopulatedChat = {
                ...targetChat,
                iconComponent: iconName ? iconMap[iconName] : undefined,
            };
            onSelectChat(populatedChat);
            if(isMobile) onClose();
        } else {
            toast({ variant: 'destructive', title: t('no_results_found'), description: t('internal_link_not_found', { link: href }) });
        }
    } catch (error) {
        console.error("Error handling internal link:", error);
        toast({ variant: 'destructive', title: 'Error', description: t('dm_error') });
    }
  };

  const handleSendMessage = async () => {
    if ((!messageContent.trim() && !fileToSend) || !db) return;
    setIsSending(true);
    const originalContent = messageContent;
    const originalFile = fileToSend;
    const originalReplyTo = replyToMessage;
    setMessageContent('');
    setFileToSend(null);
    setReplyToMessage(null);
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
        }
        await updateDoc(messageRef, { voiceStatus: 'complete', voiceChunkIds: chunkIds });
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
        }
        await updateDoc(messageRef, { circleStatus: 'complete', circleChunkIds: chunkIds });
    } catch (e) { console.error(e); }
};

const handleSendTextOrImage = async (imageUrl: string | null | undefined, content: string, replyTo: Message | null) => {
    if (!db) return;
    try {
        const contentForPreview = imageUrl ? t('image_attachment_placeholder') : content.split('\n')[0];
        const timestamp = Timestamp.now();
        const messageData: { [key: string]: any } = {
            senderId: currentUser.uid,
            content: content,
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
        if (item.type !== 'channel') {
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
                senderAvatar: 'is_channel_message'
            };
            batch.set(discMsgRef, forwardedMsg);
            batch.update(discChatRef, { lastMessage: { ...forwardedMsg, id: discMsgRef.id } });
        }

        batch.update(chatRef, updateData);
        await batch.commit();
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
    const messageData: Omit<Message, 'id'> = {
        senderId: currentUser.uid,
        content: content,
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
            content: content || t('video_attachment_placeholder'),
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
            videoMimeType: videoFile.type,
            videoStatus: 'uploading',
        };
        const updateData: { [key: string]: any } = { lastMessage: lastMessageData };
        if (item.type !== 'channel') {
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
                senderAvatar: 'is_channel_message'
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
            await new Promise(res => setTimeout(res, 0));
        }
        await updateDoc(messageRef, { videoStatus: 'complete', videoChunkIds: chunkIds });
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
    const messageData: Omit<Message, 'id'> = {
        senderId: currentUser.uid,
        content: content,
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
            content: content || t('music_attachment_placeholder'),
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
            musicMimeType: musicFile.type,
            musicStatus: 'uploading',
        };
        const updateData: { [key: string]: any } = { lastMessage: lastMessageData };
        if (item.type !== 'channel') {
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
                senderAvatar: 'is_channel_message'
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
    const messageData: Omit<Message, 'id'> = {
        senderId: currentUser.uid,
        content: content,
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
            content: content || t('file_attachment_placeholder'),
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
            fileName: file.name,
            fileStatus: 'uploading',
        };
        const updateData: { [key: string]: any } = { lastMessage: lastMessageData };
        if (item.type !== 'channel') {
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
                senderAvatar: 'is_channel_message'
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
        await updateDoc(messageRef, { fileStatus: 'complete' });
        const chatDoc = await getDoc(chatRef);
        if (chatDoc.data()?.lastMessage?.id === messageRef.id) {
            await updateDoc(chatRef, { 'lastMessage.fileStatus': 'complete' });
        }
    } catch (error) {
        console.error("Error during file upload process:", error);
        await updateDoc(messageRef, { fileStatus: 'failed' }).catch(() => {});
        throw new FirestorePermissionError({ path: 'fileChunks', operation: 'create', requestResourceData: { note: "File chunk upload failed.", originalError: (error as Error).message } });
    }
};
  
  const handleReply = (message: Message) => {
    setReplyToMessage(message);
    setEditingMessage(null);
  };

  const handleSetEditingMessage = (message: Message | null) => {
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
            const populatedChat: PopulatedChat = { ...targetChat, iconComponent: iconName ? iconMap[iconName] : undefined };
            onSelectChat(populatedChat);
            if(isMobile) onClose();
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
  
  const handleAttachmentClick = (type: 'image' | 'video' | 'music' | 'file') => {
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
            await handleSendVoice({ file, previewUrl }, '', null, durationSeconds);
            
            if (recordingStreamRef.current) {
                recordingStreamRef.current.getTracks().forEach(t => t.stop());
                recordingStreamRef.current = null;
            }
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
            await handleSendCircle({ file, previewUrl }, '', null, durationSeconds);
            
            if (recordingStreamRef.current) {
                recordingStreamRef.current.getTracks().forEach(t => t.stop());
                recordingStreamRef.current = null;
            }
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
        } else {
            recordingStreamRef.current?.getTracks().forEach(t => t.stop());
        }
        setIsRecordingCircle(false);
        setIsRecordingLocked(false);
        setRecordingOffset({ x: 0, y: 0 });
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
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
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
        stream.getTracks().forEach(track => track.stop());
        setIsCaller(true);
        setCallIsVideo(video);
        setShowCallDialog(true);
    } catch(e) {
        console.error("Call permission error", e);
        toast({ variant: 'destructive', title: t('microphone_error_title'), description: t('microphone_error_desc')})
    }
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

  const handleAcceptCall = async () => {
    if (!db || !incomingCall) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !!incomingCall.isVideo });
        stream.getTracks().forEach(track => track.stop());
        setIsCaller(false);
        setCallIsVideo(!!incomingCall.isVideo);
        setShowCallDialog(true);
        setIncomingCall(null);
    } catch(e) {
        console.error("Call permission error", e);
        toast({ variant: 'destructive', title: t('microphone_error_title'), description: t('microphone_error_desc')})
        handleDeclineCall();
    }
  };

  const handleDeclineCall = () => {
    if (!db || !incomingCall) return;
    const callDocRef = doc(db, 'calls', incomingCall.id);
    updateDoc(callDocRef, { status: 'ended' });
    setIncomingCall(null);
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
        await deleteDoc(chatRef);
        
        if (item.link) {
            const linkRef = doc(db, 'chatLinks', encodeURIComponent(item.link));
            await deleteDoc(linkRef);
        }
        
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
        toast({ variant: 'destructive', title: 'Error', description: t('leave_chat_error') });
    } finally {
        setIsProcessingAction(false);
    }
  };

  const isLoading = messagesLoading || chatLoading || (allUserIdsToFetch.length > 0 && membersLoading);

  return (
    <div className={cn("relative flex flex-col h-svh bg-background overflow-hidden", isMobile ? 'w-screen' : 'w-full')}>
      
      {/* Recording Overlay */}
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
                            <Button className="flex-1 rounded-2xl h-12 font-bold" onClick={() => isRecordingCircle ? stopCircleRecording() : stopVoiceRecording()}>
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
          "flex-shrink-0 flex items-center p-4 border-b pt-[calc(1rem+env(safe-area-inset-top))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]",
          colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background'
      )}>
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
                        <UserAvatarWithStatus user={otherUser} isSavedMessages={otherUser.id === currentUser.uid} />
                        <div className="ml-3 min-w-0 overflow-hidden flex flex-col justify-center h-full">
                            <div className="flex items-center gap-2 min-w-0">
                                <h2 className="text-lg font-semibold font-headline truncate leading-none">{getChatName()}</h2>
                                {(otherUser?.username === '@InfiniteBot' || otherUser?.username === '@VeoBot') && <VerifiedBadge className="shrink-0" />}
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
                    <div className="min-w-0 overflow-hidden flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 min-w-0">
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
                <DropdownMenu>
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
      </header>

      <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 flex flex-col">
              {activeGroupCall && (
                <div className="bg-primary/10 border-b flex items-center justify-between px-4 py-2 shrink-0 animate-in slide-in-from-top duration-300">
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
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex-shrink-0 flex justify-center py-2 pointer-events-none">
                      <Badge variant="secondary">{stickyDate}</Badge>
                  </div>
              )}
              <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 min-0 overflow-y-auto pl-[env(safe-area-inset-left))] pr-[env(safe-area-inset-right))]">
                  {isLoading ? (
                      <div className="flex h-full items-center justify-center">
                          <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      </div>
                  ) : isMember && messages && messages.length > 0 ? (
                      <div className="space-y-4 p-4">
                          {messages.map((message, index) => {
                              const sender = memberDetails[message.senderId];
                              const messageDate = getSafeDate(message.timestamp);
                              
                              const prevMessage = index > 0 ? messages[index - 1] : null;
                              const prevMessageDate = prevMessage ? getSafeDate(prevMessage.timestamp) : null;
                              const showDateSeparator = !prevMessageDate || !isSameDay(messageDate, prevMessageDate);

                              return (
                                  <React.Fragment key={message.id}>
                                      {showDateSeparator && <DateSeparator date={format(messageDate, 'dd.MM.yyyy')} />}
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
                                      />
                                  </React.Fragment>
                              );
                          })}
                      </div>
                  ) : (
                      <div className="flex h-full flex-col items-center justify-center text-muted-foreground p-4">
                          {isMember ? (
                              <p>{t('no_messages_yet')}</p>
                          ) : (
                              <>
                                  {item.type === 'group' ? (
                                      <Users className="h-16 w-16 mb-4 text-muted-foreground/50" />
                                  ) : (
                                      <Megaphone className="h-16 w-16 mb-4 text-muted-foreground/50" />
                                  )}
                                  <h3 className="text-xl font-semibold">{t(item.type === 'group' ? 'you_left_the_group' : 'you_left_the_channel')}</h3>
                                  <p className="text-sm">{t(item.type === 'group' ? 'you_left_the_group_desc' : 'you_left_the_channel_desc')}</p>
                              </>
                          )}
                      </div>
                  )}
              </div>
          </div>
      </div>

      {canSendMessage && (
        <footer className={cn(
            "flex-shrink-0 p-4 border-t pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]",
            colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background'
        )}>
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            {replyToMessage && (
                <div className="flex items-center justify-between bg-muted p-2 rounded-md animate-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center gap-2 min-w-0">
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
                    <div className="flex items-center gap-2 min-w-0">
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
                    <div className="flex items-center gap-2 min-w-0">
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
                        className="min-h-[38px] h-[38px] max-h-32 py-2 px-4 resize-none placeholder:truncate"
                    />
                </div>

                <div className="flex items-center gap-1 shrink-0 h-[38px]">
                    <DropdownMenu>
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
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

                    {(messageContent.trim() || fileToSend) ? (
                        <Button type="submit" size="icon" disabled={isSending} className="h-9 w-9 rounded-full shadow-lg">
                            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </Button>
                    ) : (
                        <div className="flex items-center gap-1">
                            <div className="relative">
                                <Button 
                                    type="button" 
                                    size="icon" 
                                    variant="ghost"
                                    className={cn("h-9 w-9 rounded-full transition-all", isRecordingCircle && "text-primary scale-125")}
                                    onPointerDown={(e) => handlePointerDown(e, 'circle')}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                >
                                    <Camera className="h-5 w-5" />
                                </Button>
                                <span className="absolute -top-1 -right-1 pointer-events-none select-none text-[9px] font-bold text-primary bg-background/80 rounded-full px-0.5 border border-primary/20">β</span>
                            </div>
                            <div className="relative">
                                <Button 
                                    type="button" 
                                    size="icon" 
                                    variant="ghost"
                                    className={cn("h-9 w-9 rounded-full transition-all", isRecordingVoice && "text-primary scale-125")}
                                    onPointerDown={(e) => handlePointerDown(e, 'voice')}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                >
                                    <Mic className="h-5 w-5" />
                                </Button>
                                <span className="absolute -top-1 -right-1 pointer-events-none select-none text-[9px] font-bold text-primary bg-background/80 rounded-full px-0.5 border border-primary/20">β</span>
                            </div>
                        </div>
                    )}
                </div>
            </form>
          </div>
        </footer>
      )}

      {/* Confirmation Dialogs */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                <AlertDialogDescription>{t('clear_history')}? {t('delete_chat_confirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory} disabled={isProcessingAction} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : t('delete')}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                <AlertDialogDescription>{t('delete_chat_confirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteChat} disabled={isProcessingAction} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : t('delete')}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                <AlertDialogDescription>{t(item.type === 'group' ? 'leave_group_confirm' : 'leave_channel_confirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleLeaveChat} disabled={isProcessingAction} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : t('leave')}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs */}
      {profileDialogUser && (
        <UserProfileDialog
          user={profileDialogUser}
          open={!!profileDialogUser}
          onOpenChange={(open) => !open && setProfileDialogUser(null)}
          onSendMessage={handleSendMessageToUser}
        />
      )}

      {showChatProfile && (
        <ChatProfileDialog
          chat={item}
          members={Object.values(memberDetails).filter(u => item.members.includes(u.id))}
          currentUser={currentUser}
          open={showChatProfile}
          onOpenChange={setShowChatProfile}
          onCloseChat={onClose}
          onJoinDiscussion={handleJoinDiscussion}
        />
      )}

      <CallDialog 
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
        chat={item}
        otherUser={otherUser}
        currentUser={currentUser}
        isCaller={isCaller}
        isVideo={callIsVideo}
      />

      <GroupCallDialog
        open={showGroupCallDialog}
        onOpenChange={setShowGroupCallDialog}
        chat={item}
        currentUser={currentUser}
        isOwner={isOwner}
      />

      {incomingCall && (
        <div className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-[100] p-4 flex justify-center animate-in slide-in-from-top duration-500">
            <div className="bg-black/90 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 w-full max-w-sm border border-white/10 backdrop-blur-md">
                <UserAvatarWithStatus user={otherUser!} className="w-12 h-12" />
                <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{otherUser?.name}</p>
                    <p className="text-xs text-white/60">{incomingCall.isVideo ? t('video_call') : t('audio_call')}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="destructive" size="icon" className="rounded-full h-10 w-10" onClick={handleDeclineCall}>
                        <PhoneOff className="h-5 w-5" />
                    </Button>
                    <Button className="bg-green-500 hover:bg-green-600 text-white rounded-full h-10 w-10" size="icon" onClick={handleAcceptCall}>
                        {incomingCall.isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                    </Button>
                </div>
            </div>
        </div>
      )}

      {previewImage && (
          <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
              <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 overflow-hidden border-none bg-black/90">
                  <div className="relative w-full h-full flex items-center justify-center">
                      <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain" />
                      <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setPreviewImage(null)}>
                          <X className="h-6 w-6" />
                      </Button>
                  </div>
              </DialogContent>
          </Dialog>
      )}

      <FaqDialog open={showFaqDialog} onOpenChange={setShowFaqDialog} />
    </div>
  );
}

function CustomAudioPlayer({ src, isMusic = false, duration, fileName }: { src: string, isMusic?: boolean, duration?: number, fileName?: string }) {
    const { isDarkMode } = useTheme();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [maxTime, setMaxTime] = useState(duration || 0);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.load();
        }
    }, [src]);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
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

    const uiClass = isDarkMode ? "bg-white text-black" : "bg-black text-white";
    const accentClass = isDarkMode ? "bg-black" : "bg-white";

    return (
        <div className={cn(
            "flex items-center gap-3 w-full px-2 py-2 rounded-xl transition-all shadow-sm", 
            isMusic ? "w-full max-w-[400px]" : "w-full max-w-[320px]",
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
                        "relative h-1.5 w-full rounded-full overflow-hidden cursor-pointer", 
                        isMusic ? "mb-1.5" : "mb-0",
                        isDarkMode ? "bg-black/20" : "bg-white/20"
                    )} 
                    onClick={handleProgressClick}
                >
                    <div 
                        className={cn("absolute h-full rounded-full transition-all duration-100", accentClass)} 
                        style={{ width: `${(currentTime / (maxTime || 1)) * 100}%` }}
                    />
                </div>
                {isMusic && (
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter opacity-80 mt-1.5">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(maxTime)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function ChatMessage({ 
    message, 
    sender, 
    isCurrentUser, 
    chatType, 
    onAvatarClick, 
    chat, 
    currentUser, 
    onInternalLinkClick, 
    onReply,
    setEditingMessage,
    onMediaLoad,
    localMediaUrl,
    onPreviewImage,
    memberDetails,
}: { 
    message: Message, 
    sender?: User, 
    isCurrentUser: boolean, 
    chatType: PopulatedChat['type'], 
    onAvatarClick: (user: User) => void, 
    chat: PopulatedChat, 
    currentUser: AuthenticatedUser, 
    onInternalLinkClick: (href: string) => Promise<void>,
    onReply: (message: Message) => void,
    setEditingMessage: (message: Message | null) => void,
    onMediaLoad: () => void,
    localMediaUrl?: string;
    onPreviewImage: (url: string) => void;
    memberDetails: Record<string, User>;
}) {
    const db = useFirestore();
    const { t } = useLanguage();
    const { toast } = useToast();
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const hasVideo = !!message.videoMimeType;
    const videoStatus = message.videoStatus;
    
    const [musicUrl, setMusicUrl] = useState<string | null>(null);
    const [isLoadingMusic, setIsLoadingMusic] = useState(false);
    const hasMusic = !!message.musicMimeType;
    const musicStatus = message.musicStatus;

    const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
    const [circleUrl, setCircleUrl] = useState<string | null>(null);

    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const hasGenericFile = !!message.fileName && !hasVideo && !hasMusic && !message.imageUrl;
    const fileStatus = message.fileStatus;

    const messageRef = useRef<HTMLDivElement>(null);
    const circleVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const checkCache = async () => {
            const cached = await getCachedFile(message.id);
            if (cached) {
                if (hasVideo) setVideoUrl(cached);
                else if (hasMusic) setMusicUrl(cached);
                else if (hasGenericFile) setFileUrl(cached);
                else if (message.voiceStatus === 'complete') setVoiceUrl(cached);
                else if (message.circleStatus === 'complete') setCircleUrl(cached);
            } else if (localMediaUrl) {
                if (hasVideo) setVideoUrl(localMediaUrl);
                else if (hasMusic) setMusicUrl(localMediaUrl);
            }
        };
        checkCache();
    }, [message.id, hasVideo, hasMusic, hasGenericFile, localMediaUrl, message.voiceStatus, message.circleStatus]);

    useEffect(() => {
        if (!messageRef.current) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                if (hasVideo && !videoUrl && !isLoadingVideo && videoStatus === 'complete') fetchAndCacheVideo();
                if (hasMusic && !musicUrl && !isLoadingMusic && musicStatus === 'complete') fetchAndCacheMusic();
                if (hasGenericFile && !fileUrl && !isLoadingFile && fileStatus === 'complete') fetchAndCacheFile();
                if (message.voiceStatus === 'complete' && !voiceUrl) fetchAndCacheVoice();
                if (message.circleStatus === 'complete' && !circleUrl) fetchAndCacheCircle();
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        observer.observe(messageRef.current);
        return () => observer.disconnect();
    }, [videoUrl, musicUrl, fileUrl, voiceUrl, circleUrl, videoStatus, musicStatus, fileStatus, message.voiceStatus, message.circleStatus]);

    const fetchAndCacheVideo = async () => {
        if (!db || !message.videoChunkIds || videoUrl || isLoadingVideo) return;
        setIsLoadingVideo(true);
        try {
            const chunkSnaps = await Promise.all(message.videoChunkIds.map(id => getDoc(doc(db, 'videoChunks', id))));
            const chunksData: {part: number, data: string}[] = [];
            chunkSnaps.forEach(snap => { if (snap.exists()) chunksData.push(snap.data() as {part: number, data: string}); });
            chunksData.sort((a, b) => a.part - b.part);
            const dataUrl = `data:${message.videoMimeType};base64,${chunksData.map(c => c.data).join('')}`;
            await cacheFile(message.id, dataUrl);
            const newLocalUrl = await getCachedFile(message.id);
            setVideoUrl(newLocalUrl);
            onMediaLoad();
        } catch (e) {
            console.error("Error assembling video:", e);
        } finally {
            setIsLoadingVideo(false);
        }
    };

    const fetchAndCacheMusic = async () => {
        if (!db || !message.musicChunkIds || musicUrl || isLoadingMusic) return;
        setIsLoadingMusic(true);
        try {
            const chunkSnaps = await Promise.all(message.musicChunkIds.map(id => getDoc(doc(db, 'musicChunks', id))));
            const chunksData: {part: number, data: string}[] = [];
            chunkSnaps.forEach(snap => { if (snap.exists()) chunksData.push(snap.data() as {part: number, data: string}); });
            chunksData.sort((a, b) => a.part - b.part);
            const dataUrl = `data:${message.musicMimeType};base64,${chunksData.map(c => c.data).join('')}`;
            await cacheFile(message.id, dataUrl);
            const newLocalUrl = await getCachedFile(message.id);
            setMusicUrl(newLocalUrl);
            onMediaLoad();
        } catch (e) {
            console.error("Error assembling music:", e);
        } finally {
            setIsLoadingMusic(false);
        }
    };

    const fetchAndCacheVoice = async () => {
        if (!db || !message.voiceChunkIds || voiceUrl) return;
        try {
            const chunkSnaps = await Promise.all(message.voiceChunkIds.map(id => getDoc(doc(db, 'voiceChunks', id))));
            const chunksData = chunkSnaps.map(s => s.data() as any).sort((a,b) => a.part - b.part);
            const dataUrl = `data:${message.voiceMimeType};base64,${chunksData.map(c => c.data).join('')}`;
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
            const dataUrl = `data:${message.circleMimeType};base64,${chunksData.map(c => c.data).join('')}`;
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
            const chunksData: {part: number, data: string}[] = [];
            chunkSnaps.forEach(snap => { if (snap.exists()) chunksData.push(snap.data() as {part: number, data: string}); });
            chunksData.sort((a, b) => a.part - b.part);
            const dataUrl = `data:${message.fileMimeType};base64,${chunksData.map(c => c.data).join('')}`;
            await cacheFile(message.id, dataUrl);
            const newLocalUrl = await getCachedFile(message.id);
            setFileUrl(newLocalUrl);
            onMediaLoad();
        } catch (e) {
            console.error("Error downloading file:", e);
        } finally {
            setIsLoadingFile(false);
        }
    };

    const handleSaveToDevice = async () => {
        let currentUrl = videoUrl || musicUrl || fileUrl || voiceUrl || circleUrl;
        let currentName = message.fileName || (hasVideo ? 'video.mp4' : hasMusic ? 'music.mp3' : message.voiceStatus ? 'voice.webm' : message.circleStatus ? 'circle.webm' : 'file');

        if (!currentUrl) {
            if (hasVideo) await fetchAndCacheVideo();
            else if (hasMusic) await fetchAndCacheMusic();
            else if (hasGenericFile) await fetchAndCacheFile();
            else if (message.voiceStatus === 'complete') await fetchAndCacheVoice();
            else if (message.circleStatus === 'complete') await fetchAndCacheCircle();
            currentUrl = videoUrl || musicUrl || fileUrl || voiceUrl || circleUrl;
        }

        if (currentUrl) {
            const link = document.createElement('a');
            link.href = currentUrl;
            link.download = currentName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleOpenFile = () => {
        if (fileUrl) {
            window.open(fileUrl, '_blank');
        }
    };

    const otherUserId = useMemo(() => {
        if (chat.type !== 'dm' || !Array.isArray(chat.members)) return null;
        return chat.members.find((id) => id !== currentUser.uid);
    }, [chat, currentUser.uid]);

    const isRead = useMemo(() => {
        if (!isCurrentUser || !message.readBy || !Array.isArray(message.readBy) || message.readBy.length === 0) return false;
        if (chat.type === 'dm') return otherUserId ? message.readBy.includes(otherUserId) : false;
        if (chat.type === 'group') return message.readBy.some(readerId => readerId !== currentUser.uid);
        return false;
    }, [message.readBy, chat.type, currentUser.uid, otherUserId, isCurrentUser]);

    const handleAvatarClick = () => {
        if (fromBot || (sender && sender.isDeleted)) return;
        if (sender && !isCurrentUser) onAvatarClick(sender);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        toast({ title: t('copy_success_toast') });
    }

    const handleDelete = () => {
        if (!db) return;
        const messageRef = doc(db, 'chats', chat.id, 'messages', message.id);
        deleteDoc(messageRef).catch((serverError: any) => {
            console.error("Error deleting message: ", serverError);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: messageRef.path, operation: 'delete' }));
        });
    };

    const handleToggleReaction = async (emoji: string) => {
        if (!db) return;
        const messageRef = doc(db, 'chats', chat.id, 'messages', message.id);
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
            if (alreadyMatchedEmoji) {
                updates[`reactions.${alreadyMatchedEmoji}`] = arrayRemove(currentUser.uid);
            }
            updates[`reactions.${emoji}`] = arrayUnion(currentUser.uid);
        }

        try {
            await updateDoc(messageRef, updates);
        } catch (e) {
            console.error("Failed to toggle reaction", e);
        }
    };

    const handleScrollToReply = () => {
        if (message.replyTo) {
            const repliedMsgElement = document.getElementById(`message-${message.replyTo.messageId}`);
            if (repliedMsgElement) {
                repliedMsgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                repliedMsgElement.classList.add('bg-primary/10', 'rounded-lg', 'transition-colors', 'duration-1000');
                setTimeout(() => repliedMsgElement.classList.remove('bg-primary/10'), 2000);
            }
        }
    };

    const messageDate = getSafeDate(message.timestamp);
    const timestamp = format(messageDate, 'HH:mm');
    
    const fromBot = message.type === 'announcement';
    const isFromChannel = fromBot && message.senderAvatar === 'is_channel_message';
    const alignRight = isCurrentUser && !fromBot && chatType !== 'channel';
    const showAvatar = (chatType === 'group' && !isCurrentUser) || fromBot;
    const botUser: User | undefined = fromBot ? { id: 'INFINITE_BOT', name: message.senderName || 'Infinite', username: '@InfiniteBot', avatar: message.senderAvatar, status: 'online', isBot: true } : undefined;
    const displaySender = fromBot ? botUser : sender;
    const displayName = displaySender?.isDeleted ? t('deleted_account') : displaySender?.name;
    const isVerified = displaySender && !displaySender.isDeleted && (displaySender.username === '@Infinite' || displaySender.username === '@InfiniteBot' || displaySender.username === '@VeoBot');

    const renderLink = ({ href, children, ...props }: any) => {
        if (href && (href.startsWith('@') || href.startsWith('/G/') || href.startsWith('/C/'))) {
            return <a href={href} onClick={(e) => { e.preventDefault(); onInternalLinkClick(href); }} className={cn(alignRight ? "text-white" : "text-primary", "underline cursor-pointer")} {...props}>{children}</a>;
        }
        return <a href={href} target="_blank" rel="noopener noreferrer" className={cn(alignRight ? "text-white" : "text-primary", "underline")} {...props}>{children}</a>;
    };

    const canDeleteMessage = (isCurrentUser && !fromBot) || (currentUser.isAdmin && chat.id === 'GENERAL_CHAT') || (chat.type === 'group' && chat.ownerId === currentUser.uid);
    const reactionEntries = message.reactions ? Object.entries(message.reactions).filter(([_, voters]) => Array.isArray(voters) && voters.length > 0) : [];
    
    const allowedReactions = chat.allowedReactions || COMMON_EMOJIS;

    const renderReactionContent = (voters: string[]) => {
        if (chatType === 'channel') return <span>{voters.length}</span>;
        
        if (chatType === 'dm' || (chatType === 'group' && voters.length <= 3)) {
            return (
                <div className="flex -space-x-1.5 overflow-hidden">
                    {voters.map(uid => {
                        const user = memberDetails[uid];
                        return (
                            <Avatar key={uid} className="w-4 h-4 border-2 border-background">
                                <AvatarImage src={user?.avatar} />
                                <AvatarFallback className="text-[6px]">{user?.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                        )
                    })}
                </div>
            )
        }
        return <span>{voters.length}</span>;
    };

    const isCircle = message.circleStatus === 'complete';

    return (
        <div ref={messageRef} id={`message-${message.id}`} className={cn("group flex items-end gap-2", alignRight ? "flex-row-reverse outgoing-msg" : "flex-row incoming-msg")}>
            {showAvatar ? (
                 <div className="w-10 h-10 flex-shrink-0">
                    {displaySender ? (
                        <button onClick={handleAvatarClick} disabled={isCurrentUser || fromBot || !!displaySender.isDeleted}>
                           {isFromChannel ? <Avatar className="h-10 w-10"><div className="flex h-full w-full items-center justify-center rounded-full bg-secondary"><Megaphone className="h-5 w-5 text-secondary-foreground" /></div></Avatar> : <UserAvatarWithStatus user={displaySender} />}
                        </button>
                    ) : <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />}
                 </div>
            ) : chatType === 'group' && !alignRight ? <div className="w-10 flex-shrink-0" /> : null}

            <div className={cn(
                "min-w-0 flex flex-col relative", 
                isCircle 
                    ? "p-0 bg-transparent rounded-full shadow-none border-none ring-0 overflow-visible" 
                    : (alignRight ? "bg-primary text-primary-foreground rounded-lg p-3 rounded-br-none max-w-[min(480px,calc(100%-4rem))]" : "bg-card text-card-foreground rounded-lg p-3 rounded-bl-none max-w-[min(480px,calc(100%-4rem))]"), 
                ((hasMusic || hasGenericFile) && !message.content.trim()) && "min-w-64"
            )}
            style={isCircle ? { boxShadow: 'none', background: 'transparent', filter: 'none' } : undefined}
            >
                {((chatType === 'group' && !isCurrentUser) || (chatType === 'channel') || fromBot) && displaySender && !isCircle && (
                    <div className="font-semibold text-sm mb-1 flex items-center gap-2 overflow-hidden">
                        <div className="truncate">{displayName}</div>
                        {isVerified && <VerifiedBadge className='shrink-0' />}
                        {isFromChannel ? <Badge variant="secondary" className='shrink-0'>{t('channel_badge')}</Badge> : (displaySender.isBot && !isVerified && <Badge variant="secondary" className='shrink-0'>BOT</Badge>)}
                    </div>
                )}
                {message.replyTo && !isCircle && (
                    <button onClick={handleScrollToReply} className={cn("mb-2 p-2 rounded-md w-full text-left transition-colors overflow-hidden", alignRight ? "bg-black/10 hover:bg-black/20" : "bg-muted hover:bg-muted/80")}>
                        <div className="flex items-center gap-2"><CornerDownLeft className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className={cn("font-semibold text-sm truncate", alignRight ? "text-primary-foreground/90" : "text-primary")}>{message.replyTo.senderName}</div><div className={cn("text-sm truncate", alignRight ? "text-primary-foreground/70" : "text-muted-foreground")}>{message.replyTo.content}</div></div></div>
                    </button>
                )}
                <div className="overflow-hidden">
                    {message.voiceStatus === 'complete' ? (
                        <div className="relative my-1">
                            {!voiceUrl ? (
                                <div className="w-full flex items-center gap-3 p-3 bg-primary/20 rounded-lg">
                                    <Mic className="h-5 w-5 text-white" />
                                    <Loader2 className="h-4 w-4 animate-spin text-white opacity-50" />
                                </div>
                            ) : (
                                <CustomAudioPlayer src={voiceUrl} />
                            )}
                        </div>
                    ) : message.circleStatus === 'complete' ? (
                        <div 
                            className="relative flex justify-center animate-in zoom-in duration-500 rounded-full cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (circleVideoRef.current) {
                                    circleVideoRef.current.currentTime = 0;
                                    circleVideoRef.current.muted = false;
                                    circleVideoRef.current.loop = false;
                                    circleVideoRef.current.play();
                                }
                            }}
                        >
                            {!circleUrl ? (
                                <div className="aspect-square w-48 h-48 rounded-full flex flex-col items-center justify-center bg-zinc-900 border-2 border-dashed border-primary/20 gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : (
                                <div className="relative group/circle rounded-full overflow-hidden w-48 h-48 border-none ring-0 shadow-none">
                                    <video 
                                        ref={circleVideoRef}
                                        src={circleUrl} 
                                        autoPlay 
                                        muted 
                                        loop 
                                        playsInline 
                                        className="w-full h-full object-cover rounded-full" 
                                        onEnded={(e) => {
                                            e.currentTarget.muted = true;
                                            e.currentTarget.loop = true;
                                            e.currentTarget.play();
                                        }}
                                        onLoadedData={onMediaLoad}
                                    />
                                </div>
                            )}
                        </div>
                    ) : hasVideo ? (
                        <div className="relative my-1">
                            {!videoUrl ? (
                                <div className="w-full max-w-xs aspect-video flex flex-col items-center justify-center bg-secondary/80 backdrop-blur-sm rounded-lg gap-2 cursor-pointer group/vid border border-white/10" onClick={fetchAndCacheVideo}>
                                    {isLoadingVideo ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : (
                                        <>
                                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center group-hover/vid:scale-110 transition-transform shadow-lg">
                                                <Download className="h-6 w-6 text-primary-foreground" />
                                            </div>
                                            <span className="text-[11px] font-black uppercase tracking-widest text-primary drop-shadow-sm">{t('video')}</span>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <video src={videoUrl} controls className="max-w-xs max-h-80 object-cover rounded-lg" onLoadedData={onMediaLoad} />
                            )}
                            {videoStatus === 'failed' && <div className="w-full max-w-xs aspect-video flex items-center justify-center bg-destructive/20 text-destructive rounded-lg p-2"><p className='text-xs font-semibold text-center'>{t('video_upload_failed')}</p></div>}
                        </div>
                    ) : hasMusic ? (
                        <div className="relative my-1">
                            {!musicUrl ? (
                                <div className="w-full flex items-center justify-between gap-3 p-4 bg-secondary/80 backdrop-blur-sm rounded-lg cursor-pointer group/music border border-white/10" onClick={fetchAndCacheMusic}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-md">
                                            <MusicIcon className="h-5 w-5 text-primary-foreground" />
                                        </div>
                                        <span className="text-sm font-black uppercase tracking-widest text-primary drop-shadow-sm">{t('music')}</span>
                                    </div>
                                    {isLoadingMusic ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Download className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />}
                                </div>
                            ) : (
                                CustomAudioPlayer({ src: musicUrl, isMusic: true, fileName: message.fileName })
                            )}
                            {musicStatus === 'failed' && <div className="w-full flex items-center justify-center bg-destructive/20 text-destructive rounded-lg p-2"><p className='text-xs font-semibold text-center'>{t('music_upload_failed')}</p></div>}
                        </div>
                    ) : hasGenericFile ? (
                        <div className="relative my-1">
                            <div className={cn("flex items-center gap-3 p-3 rounded-lg border border-border shadow-sm transition-all", alignRight ? "bg-black/10 border-white/20" : "bg-muted/50", (fileUrl || isLoadingFile) ? "cursor-pointer hover:bg-muted/80" : "cursor-pointer active:scale-[0.98]")} onClick={!fileUrl ? fetchAndCacheFile : handleOpenFile}>
                                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background border shadow-sm", alignRight ? "text-primary" : "text-primary")}>
                                    {isLoadingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileIcon className="h-5 w-5 !text-primary !opacity-100" style={{ strokeWidth: 2.5 }} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{message.fileName}</p>
                                    <p className="text-[10px] opacity-70">{(message.fileSize ? (message.fileSize / 1024 / 1024).toFixed(2) : 0)} MB</p>
                                </div>
                                {!fileUrl && !isLoadingFile && (
                                    <Download className={cn("h-4 w-4 shrink-0", alignRight ? "text-primary-foreground" : "text-primary")} />
                                )}
                            </div>
                            {fileStatus === 'failed' && <p className='text-[10px] text-destructive font-bold mt-1'>{t('file_upload_failed')}</p>}
                        </div>
                    ) : message.imageUrl ? (
                        <div className="relative my-1 cursor-pointer group/img" onClick={() => onPreviewImage(message.imageUrl!)}>
                            {message.imageUrl && (
                                <img src={message.imageUrl} alt={t('image_attachment_alt')} className="max-w-xs max-h-80 object-cover rounded-lg" onLoad={onMediaLoad} />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center rounded-lg">
                                <Maximize2 className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                            </div>
                        </div>
                    ) : null}
                    {message.content && !isCircle && (
                        <div className={cn("text-sm break-words prose prose-sm max-w-none", alignRight ? "prose-invert text-white" : "dark:prose-invert")}>
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]} 
                                components={{ 
                                    a: renderLink,
                                    p: ({children}) => <p className="whitespace-pre-wrap mb-2 last:mb-0 leading-relaxed">{children}</p>
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
                
                {reactionEntries.length > 0 && !isCircle && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {reactionEntries.map(([emoji, voters]) => (
                            <button
                                key={emoji}
                                onClick={() => handleToggleReaction(emoji)}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all shadow-sm",
                                    Array.isArray(voters) && voters.includes(currentUser.uid) 
                                        ? (alignRight ? "bg-white/20 border-white/40 text-white" : "bg-primary/10 border-primary/20 text-primary")
                                        : (alignRight ? "bg-black/10 border-white/10 text-white/80" : "bg-muted border-border text-muted-foreground")
                                )}
                            >
                                <span>{emoji}</span>
                                {Array.isArray(voters) ? renderReactionContent(voters) : null}
                            </button>
                        ))}
                    </div>
                )}

                <div className={cn(
                    "flex items-center gap-1.5 mt-1 text-[10px] leading-none", 
                    isCircle ? "absolute -bottom-5 right-0 text-muted-foreground bg-black/20 px-1.5 py-0.5 rounded-full backdrop-blur-md" : (alignRight ? "self-end text-primary-foreground/70" : "self-end text-muted-foreground")
                )}>
                    {message.editedAt && <span className="italic">{t('edited')}</span>}
                    <span>{timestamp}</span>
                    {isCurrentUser && chat.type !== 'channel' && !fromBot && (
                        (message.videoStatus === 'uploading' || message.musicStatus === 'uploading' || message.fileStatus === 'uploading' || message.voiceStatus === 'uploading' || message.circleStatus === 'uploading') 
                        ? <Clock className="h-3 w-3" /> 
                        : (isRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)
                    )}
                </div>
            </div>

            <div className={cn("flex-shrink-0 self-center overflow-hidden w-0 group-hover:w-8 focus-within:w-8 transition-[width]", !alignRight && "order-last")}>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={alignRight ? 'end' : 'start'}>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <SmilePlus className="mr-2 h-4 w-4" />
                                <span>{t('reactions')}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="flex flex-wrap max-w-[160px] p-1 gap-1">
                                {allowedReactions.map(emoji => (
                                    <button 
                                        key={emoji} 
                                        className="text-xl hover:bg-muted p-1 rounded transition-colors"
                                        onClick={() => handleToggleReaction(emoji)}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        {chat.type !== 'channel' && !displaySender?.isDeleted && <DropdownMenuItem onSelect={() => onReply(message)}><Reply className="mr-2 h-4 w-4" /><span>{t('reply')}</span></DropdownMenuItem>}
                        {(hasVideo || hasMusic || hasGenericFile || message.imageUrl || message.voiceStatus === 'complete' || message.circleStatus === 'complete') && <DropdownMenuItem onSelect={handleSaveToDevice}><Save className="mr-2 h-4 w-4" /><span>{t('save_to_device')}</span></DropdownMenuItem>}
                        {message.content && <DropdownMenuItem onSelect={handleCopy}><Copy className="mr-2 h-4 w-4" /><span>{t('copy_text')}</span></DropdownMenuItem>}
                        {(isCurrentUser && !fromBot) || canDeleteMessage ? <DropdownMenuSeparator /> : null}
                        {isCurrentUser && !fromBot && <DropdownMenuItem onSelect={() => setEditingMessage(message)}><Edit className="mr-2 h-4 w-4" /><span>{t('edit_message')}</span></DropdownMenuItem>}
                        {canDeleteMessage && <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /><span>{t('delete_message')}</span></DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
