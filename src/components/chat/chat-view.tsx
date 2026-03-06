'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat, Call } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X, MoreVertical, User as UserIcon, Info, Trash2, Users, Megaphone, CheckCheck, Bookmark, Globe, Bot, Copy, Edit, Reply, CornerDownLeft, Check, Image as ImageIcon, Music as MusicIcon, Video as VideoIcon, Clock, File as FileIcon, Download, Save, Maximize2, SmilePlus, Radio } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, addDoc, increment, getDoc, setDoc, writeBatch, arrayUnion, deleteDoc, serverTimestamp, onSnapshot, orderBy, limit, arrayRemove } from 'firebase/firestore';
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
  const { theme: colorTheme, sendOnEnter } = useTheme();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState<User | null>(null);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [showFaqDialog, setShowFaqDialog] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [fileToSend, setFileToSend] = useState<{file: File, previewUrl: string, type: 'image' | 'video' | 'music' | 'file'} | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stickyDate, setStickyDate] = useState<string | null>(null);
  const chatOpenedAt = useRef<number>(Date.now());

  const [showCallDialog, setShowCallDialog] = useState(false);
  const [isCaller, setIsCaller] = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [localMediaCache, setLocalMediaCache] = useState<Record<string, string>>({});

  const [showGroupCallDialog, setShowGroupCallDialog] = useState(false);
  const [activeGroupCall, setActiveGroupCall] = useState<Call | null>(null);

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
    if (!item?.members) return false;
    return item.members.includes(currentUser.uid);
  }, [item?.members, currentUser.uid]);

  const isOwner = item.ownerId === currentUser.uid;

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
    return collection(db, 'chats', item.id, 'messages');
  }, [db, item.id, isMember]);

  const collectionOptions = useMemo(() => ({ orderBy: 'timestamp' as const }), []);
  const { data: messages, loading: messagesLoading } = useCollection<Message>(messagesQuery, collectionOptions);
  
  const allUserIdsToFetch = useMemo(() => {
    const ids = new Set<string>(item.members || []);
    messages?.forEach(m => {
        ids.add(m.senderId);
        if (m.reactions) {
            Object.values(m.reactions).flat().forEach(uid => ids.add(uid));
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
    if (item.type !== 'dm') return null;
    return item.members.find((id) => id !== currentUser.uid) || currentUser.uid;
  }, [item, currentUser.uid]);

  const otherUser = useMemo(() => {
    if (!otherUserId || !memberDetails) return null;
    return memberDetails[otherUserId] || null;
  }, [otherUserId, memberDetails]);


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

    if (user.isBot) {
      return t('bot_status');
    }
    
    if (user.status === 'offline' && user.lastSeen) {
      const lastSeenDate = new Date(user.lastSeen.seconds * 1000);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, item, chatLoading, messagesLoading, membersLoading]);

  const handleMediaLoad = useCallback(() => {
    const timeSinceOpen = Date.now() - chatOpenedAt.current;
    if (timeSinceOpen > 3000) return;

    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollTop } = container;
        const dateSeparators = container.querySelectorAll<HTMLElement>('[data-date-separator]');
        
        let currentStickyDate: string | null = null;
        
        if (dateSeparators.length > 0 && scrollTop < dateSeparators[0].offsetTop) {
            currentStickyDate = null
        } else {
            for (let i = 0; i < dateSeparators.length; i++) {
                const separator = dateSeparators[i];
                if (separator.offsetTop <= scrollTop + 5) {
                    currentStickyDate = separator.dataset.dateSeparator || null;
                } else {
                    break;
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
    const { file, previewUrl } = filePayload;
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
        await updateDoc(messageRef, { fileStatus: 'complete', fileChunkIds: chunkIds });
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

  const handleInitiateCall = async () => {
    if (item.type !== 'dm' || item.id === currentUser.uid) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        stream.getTracks().forEach(track => track.stop());
        setIsCaller(true);
        setShowCallDialog(true);
    } catch(e) {
        console.error("Mic permission error", e);
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
          avatar: currentUser.avatar,
          joinedAt: Timestamp.now()
        }]
      });
      setShowGroupCallDialog(true);
    } catch (e) {
      console.error("Failed to start group call", e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to start call. Check rules.' });
    }
  };

  const handleAcceptCall = async () => {
    if (!db || !incomingCall) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        stream.getTracks().forEach(track => track.stop());
        setIsCaller(false);
        setShowCallDialog(true);
        setIncomingCall(null);
    } catch(e) {
        console.error("Mic permission error", e);
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

  const isLoading = messagesLoading || chatLoading || (allUserIdsToFetch.length > 0 && (membersLoading || membersLoading));

  return (
    <div className={cn("relative flex flex-col h-svh bg-background overflow-hidden", isMobile ? 'w-screen' : 'w-full')}>
      <header className={cn(
          "flex-shrink-0 flex items-center p-4 border-b pt-[calc(1rem+env(safe-area-inset-top))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]",
          colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background'
      )}>
        <Button variant="ghost" size="icon" onClick={onClose} className="mr-2 shrink-0">
            <X className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 flex items-center min-w-0 overflow-hidden">
            {item.type === "dm" ? (
                otherUser ? ( 
                    <button
                        className="flex items-center text-left hover:bg-accent px-3 py-1 rounded-md -mx-3 -my-1 transition-colors min-w-0 flex-1 overflow-hidden"
                        onClick={() => setProfileDialogUser(otherUser)}
                        disabled={otherUser.id === currentUser.uid || !!otherUser.isDeleted}
                    >
                        <UserAvatarWithStatus user={otherUser} isSavedMessages={otherUser.id === currentUser.uid} />
                        <div className="ml-3 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 min-w-0">
                                <h2 className="text-lg font-semibold font-headline truncate">{getChatName()}</h2>
                                {(otherUser?.username === '@InfiniteBot' || otherUser?.username === '@VeoBot') && <VerifiedBadge className="shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                                {otherUser.id !== currentUser.uid ? getStatusText(otherUser) : ''}
                            </p>
                        </div>
                    </button>
                ) : ( 
                    <div className="flex items-center min-w-0">
                        <div className='w-10 h-10 bg-muted rounded-full animate-pulse' />
                        <div className="ml-3 space-y-2">
                            <div className='h-4 w-32 bg-muted rounded animate-pulse' />
                            <div className='h-3 w-24 bg-muted rounded animate-pulse' />
                        </div>
                    </div>
                )
            ) : ( 
                 <button 
                    className="flex items-center text-left hover:bg-accent px-3 py-1 rounded-md -mx-3 -my-1 transition-colors min-w-0 flex-1 overflow-hidden"
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
                    <div className="min-w-0 overflow-hidden py-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <h2 className="text-lg font-semibold font-headline truncate">{getChatName()}</h2>
                             {(item.link === '/G/Infinite' || item.link === '/C/Infinite') && <VerifiedBadge className="shrink-0" />}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                            {item.id === 'GENERAL_CHAT'
                                ? t('public_chat_description')
                                : t(item.type === 'channel' ? 'subscribers_count' : 'members_count', { count: item.members?.length || 0 })}
                        </p>
                    </div>
                </button>
            )}
        </div>

        <div className="flex items-center gap-1 ml-2 shrink-0">
            {item.type === 'dm' && otherUser && otherUser.id !== currentUser.uid && !otherUser.isDeleted && (
              <>
                <Button variant="ghost" size="icon" onClick={handleInitiateCall} title={t('audio_call')}>
                  <Phone className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={promptUpdate} title={t('video_call')}>
                  <Video className="h-5 w-5" />
                </Button>
              </>
            )}
            {(item.type === 'group' || item.type === 'channel') && isOwner && (
              <Button variant="ghost" size="icon" onClick={handleStartGroupCall} title={item.type === 'channel' ? t('start_broadcast') : t('start_video_chat')}>
                <Radio className={cn("h-5 w-5", activeGroupCall && "text-red-500 animate-pulse")} />
              </Button>
            )}
            {item.type === 'channel' && item.discussionChatId && (
                <Button variant="ghost" size="icon" onClick={() => handleJoinDiscussion(item.discussionChatId!)} title={t('join_discussion_button')}>
                    <Users className="h-5 w-5" />
                </Button>
            )}
            {item.id !== 'GENERAL_CHAT' && (
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {item.type === 'dm' && otherUser ? (
                            <>
                                {otherUser.id !== currentUser.uid ? (
                                    <>
                                        <DropdownMenuItem onSelect={() => setProfileDialogUser(otherUser)} disabled={!!otherUser.isDeleted}>
                                            <UserIcon className="mr-2 h-4 w-4" />
                                            <span>{t('view_profile')}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={promptUpdate} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            <span>{t('delete_chat')}</span>
                                        </DropdownMenuItem>
                                    </>
                                ) : (
                                    <DropdownMenuItem onSelect={promptUpdate} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>{t('clear_history')}</span>
                                    </DropdownMenuItem>
                                )}
                            </>
                        ) : null}

                        {item.type !== 'dm' && (
                            <DropdownMenuItem onSelect={() => setShowChatProfile(true)}>
                                <Info className="mr-2 h-4 w-4" />
                                <span>{item.type === 'group' ? t('group_info') : t('channel_info')}</span>
                            </DropdownMenuItem>
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
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-bold text-primary">
                      {activeGroupCall.callType === 'broadcast' ? t('broadcast_live') : t('video_chat_live')}
                    </span>
                  </div>
                  <Button size="sm" className="h-8 rounded-full font-bold px-4" onClick={() => setShowGroupCallDialog(true)}>
                    {t('join_call')}
                  </Button>
                </div>
              )}
              {stickyDate && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex-shrink-0 flex justify-center py-2 pointer-events-none">
                      <Badge variant="secondary">{stickyDate}</Badge>
                  </div>
              )}
              <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
                  {isLoading ? (
                      <div className="flex h-full items-center justify-center">
                          <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      </div>
                  ) : isMember && messages && messages.length > 0 ? (
                      <div className="space-y-4 p-4">
                          {messages.map((message, index) => {
                              const sender = memberDetails[message.senderId];
                              const messageDate = new Date(message.timestamp.seconds * 1000);
                              const prevMessage = messages[index - 1];
                              const prevMessageDate = prevMessage ? new Date(prevMessage.timestamp.seconds * 1000) : null;
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
                          <div ref={messagesEndRef} />
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
          {editingMessage && (
            <div className="pb-2">
              <div className="relative rounded-lg bg-accent/50 p-3">
                <p className="text-xs font-semibold text-primary">{t('editing_message')}</p>
                <p className="text-sm text-muted-foreground truncate">{editingMessage.content}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={handleCancelEdit}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {replyToMessage && !editingMessage && (
            <div className="pb-2">
                <div className="relative rounded-lg bg-accent/50 p-3">
                    <p className="text-xs font-semibold text-primary">
                        {t('replying_to', { name: replyToMessage?.sender?.name || replyToMessage?.senderName })}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                        {replyToMessage.content}
                    </p>
                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setReplyToMessage(null)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
          )}
          {fileToSend && (
            <div className="pb-2">
                <div className="relative w-fit">
                    {fileToSend.type === 'image' ? (
                        <img src={fileToSend.previewUrl} alt="Preview" className="max-h-24 rounded-lg" />
                    ) : fileToSend.type === 'video' ? (
                        <video src={fileToSend.previewUrl} controls className="max-h-24 rounded-lg" />
                    ) : fileToSend.type === 'music' ? (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                            <MusicIcon className="h-8 w-8 text-primary" />
                            <p className="text-sm text-muted-foreground truncate max-w-xs">{fileToSend.file.name}</p>
                        </div>
                    ) : fileToSend.type === 'file' ? (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                            <FileIcon className="h-8 w-8 text-primary" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold truncate max-w-xs">{fileToSend.file.name}</p>
                                <p className="text-[10px] text-muted-foreground">{(fileToSend.file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                    ) : null}
                     {isSending ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                    ) : (
                        <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => setFileToSend(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
          )}


          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              placeholder={t('message_placeholder')}
              className="pr-24 py-3 resize-none min-h-[44px]"
              rows={1}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyDown={(e) => {
                if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) {
                  handleSubmit(e);
                } else if (e.key === 'Escape') {
                  if (editingMessage) handleCancelEdit();
                  else if (replyToMessage) setReplyToMessage(null);
                  else if (fileToSend) setFileToSend(null);
                }
              }}
              disabled={isSending}
            />
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Popover>
                    <PopoverTrigger asChild>
                         <Button variant="ghost" size="icon" type="button">
                            <Paperclip className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="end" className="w-48 p-1">
                        <div className="flex flex-col">
                            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b mb-1">
                                {t('max_file_size_label', { size: maxFileSizeText })}
                            </div>
                            <Button variant="ghost" className="justify-start h-9 rounded-md" onClick={() => handleAttachmentClick('image')}>
                                <ImageIcon className="mr-2 h-4 w-4" />
                                <span>{t('photo')}</span>
                            </Button>
                            <Button variant="ghost" className="justify-start h-9 rounded-md" onClick={() => handleAttachmentClick('video')}>
                                <VideoIcon className="mr-2 h-4 w-4" />
                                <span>{t('video')}</span>
                            </Button>
                             <Button variant="ghost" className="justify-start h-9 rounded-md" onClick={() => handleAttachmentClick('music')}>
                                <MusicIcon className="mr-2 h-4 w-4" />
                                <span>{t('music')}</span>
                            </Button>
                            <Button variant="ghost" className="justify-start h-9 rounded-md" onClick={() => handleAttachmentClick('file')}>
                                <FileIcon className="mr-2 h-4 w-4" />
                                <span>{t('file')}</span>
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

              <Button size="icon" type="submit" disabled={isSending || (!messageContent.trim() && !fileToSend)}>
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : editingMessage ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </form>
        </footer>
      )}

      {showChatProfile && item.type !== 'dm' && (
        <ChatProfileDialog 
            chat={item}
            members={Object.values(memberDetails).filter(m => item.members.includes(m.id))}
            currentUser={currentUser}
            open={showChatProfile}
            onOpenChange={setShowChatProfile}
            onCloseChat={onClose}
            onJoinDiscussion={handleJoinDiscussion}
        />
      )}

      {profileDialogUser && (
        <UserProfileDialog 
            user={profileDialogUser}
            open={!!profileDialogUser}
            onOpenChange={(open) => {
                if(!open) setProfileDialogUser(null);
            }}
            onSendMessage={handleSendMessageToUser}
        />
      )}
    
    {otherUser && <CallDialog 
        open={showCallDialog} 
        onOpenChange={setShowCallDialog}
        chat={item}
        otherUser={otherUser}
        currentUser={currentUser}
        isCaller={isCaller}
    />}

    <GroupCallDialog 
      open={showGroupCallDialog}
      onOpenChange={setShowGroupCallDialog}
      chat={item}
      currentUser={currentUser}
      isOwner={isOwner}
    />

    <AlertDialog open={!!incomingCall}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>{t('incoming_call')}</AlertDialogTitle>
            <AlertDialogDescription>
                {t('is_calling_you', { name: otherUser?.name || '...' })}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <Button onClick={handleDeclineCall} variant="destructive">{t('decline')}</Button>
                <Button onClick={handleAcceptCall}>{t('accept')}</Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <FaqDialog open={showFaqDialog} onOpenChange={setShowFaqDialog} />

    <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none overflow-hidden flex items-center justify-center">
            <DialogHeader className='sr-only'><DialogTitle>Image Preview</DialogTitle></DialogHeader>
            <div className="relative group w-full h-full flex items-center justify-center">
                {previewImage && (
                    <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                )}
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 bg-black/50 text-white rounded-full hover:bg-black/70" onClick={() => setPreviewImage(null)}>
                    <X className="h-6 w-6" />
                </Button>
            </div>
        </DialogContent>
    </Dialog>
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

    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const hasGenericFile = !!message.fileName && !hasVideo && !hasMusic && !message.imageUrl;
    const fileStatus = message.fileStatus;

    useEffect(() => {
        const checkCache = async () => {
            const cached = await getCachedFile(message.id);
            if (cached) {
                if (hasVideo) setVideoUrl(cached);
                else if (hasMusic) setMusicUrl(cached);
                else if (hasGenericFile) setFileUrl(cached);
            } else if (localMediaUrl) {
                if (hasVideo) setVideoUrl(localMediaUrl);
                else if (hasMusic) setMusicUrl(localMediaUrl);
            }
        };
        checkCache();
    }, [message.id, hasVideo, hasMusic, hasGenericFile, localMediaUrl]);

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
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to download video.' });
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
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to download music.' });
        } finally {
            setIsLoadingMusic(false);
        }
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
        } catch (e) {
            console.error("Error downloading file:", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to download file.' });
        } finally {
            setIsLoadingFile(false);
        }
    };

    const handleSaveToDevice = async () => {
        let currentUrl = videoUrl || musicUrl || fileUrl;
        let currentName = message.fileName || (hasVideo ? 'video.mp4' : hasMusic ? 'music.mp3' : 'file');

        if (!currentUrl) {
            if (hasVideo) await fetchAndCacheVideo();
            else if (hasMusic) await fetchAndCacheMusic();
            else if (hasGenericFile) await fetchAndCacheFile();
            currentUrl = videoUrl || musicUrl || fileUrl;
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
        if (chat.type !== 'dm') return null;
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
        
        // Find if user already has a reaction
        let alreadyMatchedEmoji: string | null = null;
        Object.entries(currentReactions).forEach(([key, voters]) => {
            if (voters.includes(currentUser.uid)) {
                alreadyMatchedEmoji = key;
            }
        });

        const updates: Record<string, any> = {};

        // If user is clicking the same emoji they already have, just remove it
        if (alreadyMatchedEmoji === emoji) {
            updates[`reactions.${emoji}`] = arrayRemove(currentUser.uid);
        } else {
            // Remove previous reaction if exists from ANY emoji (ensure one reaction per user)
            if (alreadyMatchedEmoji) {
                updates[`reactions.${alreadyMatchedEmoji}`] = arrayRemove(currentUser.uid);
            }
            // Add new reaction
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

    const timestamp = message.timestamp ? format(new Date(message.timestamp.seconds * 1000), 'HH:mm') : '';
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
    const reactionEntries = message.reactions ? Object.entries(message.reactions).filter(([_, voters]) => voters.length > 0) : [];
    
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

    return (
        <div id={`message-${message.id}`} className={cn("group flex items-end gap-2", alignRight ? "flex-row-reverse outgoing-msg" : "flex-row incoming-msg")}>
            {showAvatar ? (
                 <div className="w-10 h-10 flex-shrink-0">
                    {displaySender ? (
                        <button onClick={handleAvatarClick} disabled={isCurrentUser || fromBot || !!displaySender.isDeleted}>
                           {isFromChannel ? <Avatar className="h-10 w-10"><div className="flex h-full w-full items-center justify-center rounded-full bg-secondary"><Megaphone className="h-5 w-5 text-secondary-foreground" /></div></Avatar> : <UserAvatarWithStatus user={displaySender} />}
                        </button>
                    ) : <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />}
                 </div>
            ) : chatType === 'group' && !alignRight ? <div className="w-10 flex-shrink-0" /> : null}

            <div className={cn("min-w-0 max-w-[min(480px,calc(100%-4rem))] p-3 rounded-lg flex flex-col relative", alignRight ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card text-card-foreground rounded-bl-none", ((hasMusic || hasGenericFile) && !message.content.trim()) && "min-w-64")}>
                {((chatType === 'group' && !isCurrentUser) || (chatType === 'channel') || fromBot) && displaySender && (
                    <div className="font-semibold text-sm mb-1 flex items-center gap-2 overflow-hidden">
                        <div className="truncate">{displayName}</div>
                        {isVerified && <VerifiedBadge className='shrink-0' />}
                        {isFromChannel ? <Badge variant="secondary" className='shrink-0'>{t('channel_badge')}</Badge> : (displaySender.isBot && !isVerified && <Badge variant="secondary" className='shrink-0'>BOT</Badge>)}
                    </div>
                )}
                {message.replyTo && (
                    <button onClick={handleScrollToReply} className={cn("mb-2 p-2 rounded-md w-full text-left transition-colors overflow-hidden", alignRight ? "bg-black/10 hover:bg-black/20" : "bg-muted hover:bg-muted/80")}>
                        <div className="flex items-center gap-2"><CornerDownLeft className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className={cn("font-semibold text-sm truncate", alignRight ? "text-primary-foreground/90" : "text-primary")}>{message.replyTo.senderName}</div><div className={cn("text-sm truncate", alignRight ? "text-primary-foreground/70" : "text-muted-foreground")}>{message.replyTo.content}</div></div></div>
                    </button>
                )}
                <div className="overflow-hidden">
                    {hasVideo ? (
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
                                <audio src={musicUrl} controls className="w-full" onLoadedData={onMediaLoad} />
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
                    {message.content && (
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
                
                {reactionEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {reactionEntries.map(([emoji, voters]) => (
                            <button
                                key={emoji}
                                onClick={() => handleToggleReaction(emoji)}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all shadow-sm",
                                    voters.includes(currentUser.uid) 
                                        ? (alignRight ? "bg-white/20 border-white/40 text-white" : "bg-primary/10 border-primary/20 text-primary")
                                        : (alignRight ? "bg-black/10 border-white/10 text-white/80" : "bg-muted border-border text-muted-foreground")
                                )}
                            >
                                <span>{emoji}</span>
                                {renderReactionContent(voters)}
                            </button>
                        ))}
                    </div>
                )}

                <div className={cn("flex items-center gap-1.5 self-end mt-1 text-xs", alignRight ? "text-primary-foreground/70" : "text-muted-foreground")}>{message.editedAt && <span className="italic">{t('edited')}</span>}<span>{timestamp}</span>{isCurrentUser && chat.type !== 'channel' && !fromBot && ((message.videoStatus === 'uploading' || message.musicStatus === 'uploading' || message.fileStatus === 'uploading') ? <Clock className="h-4 w-4" /> : (isRead ? <CheckCheck className="h-4 w-4" /> : <Check className="h-4 w-4" />))}</div>
            </div>

            <div className={cn("flex-shrink-0 self-center overflow-hidden w-0 group-hover:w-8 focus-within:w-8 transition-[width]", !alignRight && "order-last")}>
                <DropdownMenu>
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
                        {(hasVideo || hasMusic || hasGenericFile || message.imageUrl) && <DropdownMenuItem onSelect={handleSaveToDevice}><Save className="mr-2 h-4 w-4" /><span>{t('save_to_device')}</span></DropdownMenuItem>}
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