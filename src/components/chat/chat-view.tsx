'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat, Call } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X, MoreVertical, User as UserIcon, Info, Trash2, Users, Megaphone, CheckCheck, Bookmark, Globe, Bot, Copy, Edit, Reply, CornerDownLeft, Check, Image as ImageIcon, Music as MusicIcon, Video as VideoIcon, Ghost } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, addDoc, increment, getDocs, query, where, getDoc, setDoc, writeBatch, arrayUnion, deleteDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
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
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { promptUpdate } = useUpdatePrompt();
  const { theme: colorTheme, sendOnEnter } = useTheme();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState<User | null>(null);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [showFaqDialog, setShowFaqDialog] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [fileToSend, setFileToSend] = useState<{file: File, previewUrl: string, type: 'image' | 'video'} | null>(null);
  const isMobile = useIsMobile();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stickyDate, setStickyDate] = useState<string | null>(null);

  const [showCallDialog, setShowCallDialog] = useState(false);
  const [isCaller, setIsCaller] = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  

  // --- Get live chat data ---
  const chatDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'chats', initialItem.id);
  }, [db, initialItem.id]);

  const { data: liveChatData, loading: chatLoading } = useDoc<Chat>(chatDocRef);

  const item = useMemo(() => {
    if (!liveChatData) return initialItem;
    // important to merge with iconComponent
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

  // --- End live chat data ---

  // --- Call listener ---
  useEffect(() => {
    if (!db || item.type !== 'dm' || !isMember || !item.id.includes('_')) return; // Prevents running for "Saved Messages" or invalid IDs
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

  // --- Fetch messages and members ---
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !isMember) return null;
    return collection(db, 'chats', item.id, 'messages');
  }, [db, item.id, isMember]);

  const collectionOptions = useMemo(() => ({ orderBy: 'timestamp' as const }), []);
  const { data: messages, loading: messagesLoading } = useCollection<Message>(messagesQuery, collectionOptions);
  
  const allUserIdsToFetch = useMemo(() => {
    const ids = new Set<string>(item.members || []);
    messages?.forEach(m => ids.add(m.senderId));
    return Array.from(ids);
  }, [item.members, messages]);

  const { users: memberDetails, loading: membersLoading } = useBatchUsers(allUserIdsToFetch);


  // --- Read Receipts Logic ---
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


  // --- Reset unread count ---
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

  // --- Optimized User fetching for DM header ---
  const otherUserId = useMemo(() => {
    if (item.type !== 'dm') return null;
    return item.members.find((id) => id !== currentUser.uid) || currentUser.uid;
  }, [item, currentUser.uid]);

  const otherUser = useMemo(() => {
    if (!otherUserId || !memberDetails) return null;
    return memberDetails[otherUserId] || null;
  }, [otherUserId, memberDetails]);
  // --- End Optimization ---


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
        if (item.discussionChatId) return true; // Can send to discussion
        return false;
    }
    return true;
  }, [isMember, item, currentUser.uid, otherUser]);


  // --- Auto-scroll ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, item, chatLoading, messagesLoading, membersLoading]);

  // --- Sticky Date Header Logic & Scroll Detection ---
    const handleScroll = useCallback(() => {
        // --- For sticky date ---
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
                if (separator.offsetTop <= scrollTop + 5) { // 5px offset for the sticky header itself
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

        // We are already adding onScroll to the div itself, no need for event listener
        handleScroll(); // Initial check

    }, [handleScroll, messages]); // Rerun if messages change


  const handleSendMessageToUser = async (targetUser: User) => {
    if (!db || !currentUser || targetUser.isDeleted) return;

    // Close the profile dialog
    setProfileDialogUser(null);

    // Check if we are already in the correct DM chat
    const members = [currentUser.uid, targetUser.id].sort();
    const chatId = members.join('_');
    if (initialItem.id === chatId) {
      return; // Already in the correct chat, do nothing.
    }

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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not open direct message.',
      });
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
                        // Create saved messages chat if it doesn't exist
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
            toast({
                variant: 'destructive',
                title: t('no_results_found'),
                description: t('internal_link_not_found', { link: href }),
            });
        }
    } catch (error) {
        console.error("Error handling internal link:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: t('dm_error'),
        });
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
            await handleSendVideo(originalFile.file, originalContent, originalReplyTo);
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
            toast({
                variant: 'destructive',
                title: t('admin_toast_error_title'),
                description: (error as Error).message || t('unexpected_error'),
            });
        }
    } finally {
        setIsSending(false);
    }
};

const handleSendTextOrImage = async (imageUrl: string | null | undefined, content: string, replyTo: Message | null) => {
    if (!db) return;
    try {
        const contentForMessage = content.replace(/\n/g, '  \n');
        const contentForPreview = imageUrl ? t('image_attachment_placeholder') : content.split('\n')[0];
        const timestamp = Timestamp.now();

        const messageData: { [key: string]: any } = {
            senderId: currentUser.uid,
            content: contentForMessage,
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
        batch.update(chatRef, updateData);
        await batch.commit();
    } catch (error) {
        console.error("Error sending text/image message:", error);
        throw error;
    }
};

const handleSendVideo = async (videoFile: File, content: string, replyTo: Message | null) => {
    if (!db) return;

    if (videoFile.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ variant: 'destructive', title: t('video_too_large'), description: 'Please select a video smaller than 5MB.' });
        setMessageContent(content);
        setFileToSend({ file: videoFile, previewUrl: URL.createObjectURL(videoFile), type: 'video'});
        throw new Error("Video too large");
    }

    try {
        const videoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(videoFile);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });

        if (videoDataUrl.length > 950 * 1024) {
            toast({ variant: 'destructive', title: t('video_too_large'), description: 'This video is too large to be sent directly.' });
            setMessageContent(content);
            setFileToSend({ file: videoFile, previewUrl: URL.createObjectURL(videoFile), type: 'video'});
            throw new Error("Video data URL too large");
        }

        const contentForMessage = content.replace(/\n/g, '  \n');
        const timestamp = Timestamp.now();

        const messageData: { [key: string]: any } = {
            senderId: currentUser.uid,
            content: contentForMessage,
            timestamp,
            type: 'user',
            readBy: [],
            videoUrl: videoDataUrl,
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
            content: contentForMessage || t('video_attachment_placeholder'),
            senderId: currentUser.uid,
            senderName: currentUser.name || currentUser.username,
            timestamp,
            videoUrl: 'video' // Simple placeholder for sidebar
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
        batch.update(chatRef, updateData);
        await batch.commit();

    } catch (error) {
        console.error('[VIDEO_UPLOAD] ERROR during upload process:', error);
        throw error;
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
            const populatedChat: PopulatedChat = {
                ...targetChat,
                iconComponent: iconName ? iconMap[iconName] : undefined,
            };
            onSelectChat(populatedChat);
            if(isMobile) onClose();
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: t('discussion_chat_not_found'),
            });
        }
    } catch (error) {
        console.error("Error joining discussion:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not open discussion chat.',
        });
    }
  };
  
  useEffect(() => {
    if (editingMessage) {
        setMessageContent(editingMessage.content.replace(/  \n/g, '\n'));
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
    const newContent = messageContent.replace(/\n/g, '  \n');

    try {
        const updatePayload: { [key: string]: any } = {
            content: newContent,
            editedAt: serverTimestamp(),
            // For simplicity, don't allow changing attachments during edit
        };
        await updateDoc(messageRef, updatePayload);

        if (item.lastMessage?.id === editingMessage.id) {
            const chatRef = doc(db, 'chats', item.id);
            const contentForPreview = fileToSend ? t('image_attachment_placeholder') : messageContent.split('\n')[0];
            await updateDoc(chatRef, {
                'lastMessage.content': contentForPreview,
                'lastMessage.editedAt': serverTimestamp(),
            });
        }

        setEditingMessage(null);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: messageRef.path,
            operation: 'update',
            requestResourceData: { content: newContent },
        });
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
      event.target.value = ''; // Reset file input

      setReplyToMessage(null);
      setEditingMessage(null);

      try {
        setIsSending(true);
        if (file.type.startsWith('video/')) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit for videos
                toast({ variant: 'destructive', title: t('video_too_large'), description: 'Please select a video smaller than 5MB.' });
                setIsSending(false);
                return;
            }
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
        } else {
            toast({ variant: 'destructive', title: t('invalid_file_type') });
            setIsSending(false);
            return;
        }

      } catch(e) {
        console.error("Error processing file:", e);
        toast({ variant: 'destructive', title: t('image_processing_failed_title'), description: t('image_processing_failed_desc') });
      } finally {
        setIsSending(false);
      }
    }
  };
  
  const handleAttachmentClick = (type: 'image' | 'video') => {
    if (fileInputRef.current) {
        fileInputRef.current.accept = type === 'image' ? 'image/*' : 'video/*';
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
  
  const isLoading = messagesLoading || chatLoading || (allUserIdsToFetch.length > 0 && membersLoading);

  return (
    <div className={cn("flex flex-col h-svh bg-background overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]", isMobile ? 'w-screen' : 'w-full')}>
      {/* Chat Header */}
      <header className={cn(
          "flex-shrink-0 flex items-center p-4 border-b",
          colorTheme === 'frutiger' && (item.type === 'dm' ? 'bg-card/80' : 'bg-card')
      )}>
        <Button variant="ghost" size="icon" onClick={onClose} className="mr-2">
            <X className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 flex items-center min-w-0">
            {item.type === "dm" ? (
                otherUser ? ( // If we have the user, show the profile button
                    <button
                        className="flex items-center text-left hover:bg-accent px-3 py-1 rounded-md -mx-3 -my-1 transition-colors min-w-0"
                        onClick={() => setProfileDialogUser(otherUser)}
                        disabled={otherUser.id === currentUser.uid || !!otherUser.isDeleted}
                    >
                        <UserAvatarWithStatus user={otherUser} isSavedMessages={otherUser.id === currentUser.uid} />
                        <div className="ml-3 truncate">
                            <div className="flex items-center gap-2 min-w-0">
                                <h2 className="text-lg font-semibold font-headline truncate">{getChatName()}</h2>
                                {(otherUser?.username === '@InfiniteBot' || otherUser?.username === '@VeoBot') && <VerifiedBadge className="shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                                {otherUser.id !== currentUser.uid ? getStatusText(otherUser) : ''}
                            </p>
                        </div>
                    </button>
                ) : ( // if it's a DM but user is loading, show a skeleton
                    <div className="flex items-center min-w-0">
                        <div className='w-10 h-10 bg-muted rounded-full animate-pulse' />
                        <div className="ml-3 space-y-2">
                            <div className='h-4 w-32 bg-muted rounded animate-pulse' />
                            <div className='h-3 w-24 bg-muted rounded animate-pulse' />
                        </div>
                    </div>
                )
            ) : ( // Not a DM, show group/channel info
                 <button 
                    className="flex items-center text-left hover:bg-accent px-3 py-1 rounded-md -mx-3 -my-1 transition-colors min-w-0"
                    onClick={() => setShowChatProfile(true)}
                    disabled={item.id === 'GENERAL_CHAT'}
                >
                    <Avatar className="h-10 w-10 mr-3">
                        {item.avatar ? (
                            <AvatarImage src={item.avatar} alt={item.name} />
                        ) : (
                            <AvatarFallback>
                                {item.iconComponent && <item.iconComponent className="h-5 w-5" />}
                            </AvatarFallback>
                        )}
                    </Avatar>
                    <div className="truncate py-1">
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

        <div className="flex items-center gap-2 ml-2">
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

      {/* Message List Area */}
      <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 flex flex-col">
              {/* Sticky Date Header */}
              {stickyDate && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex-shrink-0 flex justify-center py-2 pointer-events-none">
                      <Badge variant="secondary">{stickyDate}</Badge>
                  </div>
              )}
              {/* Scrollable Content */}
              <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto">
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
                                      />
                                  </React.Fragment>
                              );
                          })}
                          <div ref={messagesEndRef} />
                      </div>
                  ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-4">
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

      {/* Message Input */}
      {canSendMessage && (
        <footer className={cn(
            "flex-shrink-0 p-4 border-t",
            colorTheme === 'frutiger' && 'bg-card/80'
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
                    ) : (
                        <video src={fileToSend.previewUrl} controls className="max-h-24 rounded-lg" />
                    )}
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
              className="pr-24 py-3 resize-none"
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
                    <PopoverContent side="top" align="end" className="w-auto p-1">
                        <div className="flex flex-col">
                            <Button variant="ghost" className="justify-start" onClick={() => handleAttachmentClick('image')}>
                                <ImageIcon className="mr-2 h-4 w-4" />
                                <span>{t('photo')}</span>
                            </Button>
                            <Button variant="ghost" className="justify-start" onClick={() => handleAttachmentClick('video')}>
                                <VideoIcon className="mr-2 h-4 w-4" />
                                <span>{t('video')}</span>
                            </Button>
                             <Button variant="ghost" className="justify-start" disabled>
                                <MusicIcon className="mr-2 h-4 w-4" />
                                <span>{t('music')}</span>
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
}) {
    const db = useFirestore();
    const { t } = useLanguage();
    const { toast } = useToast();
    
    const otherUserId = useMemo(() => {
        if (chat.type !== 'dm') return null;
        return chat.members.find((id) => id !== currentUser.uid);
    }, [chat, currentUser.uid]);

    const isRead = useMemo(() => {
        if (!isCurrentUser) return false;
        
        if (!message.readBy || !Array.isArray(message.readBy) || message.readBy.length === 0) {
            return false;
        }
    
        if (chat.type === 'dm') {
            return otherUserId ? message.readBy.includes(otherUserId) : false;
        }
        if (chat.type === 'group') {
            return message.readBy.some(readerId => readerId !== currentUser.uid);
        }
        return false;
    }, [message.readBy, chat.type, currentUser.uid, otherUserId, isCurrentUser]);


    const handleAvatarClick = () => {
        if (fromBot || (sender && sender.isDeleted)) return;
        if (sender && !isCurrentUser) {
            onAvatarClick(sender);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        toast({ title: t('copy_success_toast') });
    }

    const handleDelete = () => {
        if (!db) return;
        const messageRef = doc(db, 'chats', chat.id, 'messages', message.id);
        deleteDoc(messageRef)
            .catch((serverError: any) => {
                console.error("Error deleting message: ", serverError);
                const permissionError = new FirestorePermissionError({
                    path: messageRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleScrollToReply = () => {
        if (message.replyTo) {
            const repliedMsgElement = document.getElementById(`message-${message.replyTo.messageId}`);
            if (repliedMsgElement) {
                repliedMsgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                repliedMsgElement.classList.add('bg-primary/10', 'rounded-lg', 'transition-colors', 'duration-1000');
                setTimeout(() => {
                    repliedMsgElement.classList.remove('bg-primary/10');
                }, 2000);
            }
        }
    };

    const timestamp = message.timestamp ? format(new Date(message.timestamp.seconds * 1000), 'HH:mm') : '';
    const fromBot = message.type === 'announcement';
    const isFromChannel = fromBot && message.senderAvatar === 'is_channel_message';
    const alignRight = isCurrentUser && !fromBot && chatType !== 'channel';
    
    const showAvatar = (chatType === 'group' && !isCurrentUser) || fromBot;

    const botUser: User | undefined = fromBot ? {
        id: 'INFINITE_BOT',
        name: message.senderName || 'Infinite',
        username: '@InfiniteBot',
        avatar: message.senderAvatar,
        status: 'online',
        isBot: true,
    } : undefined;

    const displaySender = fromBot ? botUser : sender;
    const displayName = displaySender?.isDeleted ? t('deleted_account') : displaySender?.name;
    const isVerified = displaySender && !displaySender.isDeleted && (displaySender.username === '@Infinite' || displaySender.username === '@InfiniteBot' || displaySender.username === '@VeoBot');


    const renderLink = ({ href, children, ...props }: any) => {
        if (href && (href.startsWith('@') || href.startsWith('/G/') || href.startsWith('/C/'))) {
            const handleClick = (e: React.MouseEvent) => {
                e.preventDefault();
                onInternalLinkClick(href);
            };
            return (
                <a href={href} onClick={handleClick} className={cn(alignRight ? "text-white" : "text-primary", "underline cursor-pointer")} {...props}>
                    {children}
                </a>
            );
        }

        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={cn(alignRight ? "text-white" : "text-primary", "underline")} {...props}>
                {children}
            </a>
        );
    };

    const canDeleteMessage = (isCurrentUser && !fromBot) || 
                             (currentUser.isAdmin && chat.id === 'GENERAL_CHAT') ||
                             (chat.type === 'group' && chat.ownerId === currentUser.uid);
    
    const messageBubbleContent = (
        <>
            {((chatType === 'group' && !isCurrentUser) || (chatType === 'channel') || fromBot) && displaySender ? (
                  <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                      <div className="truncate">{displayName}</div>
                      {isVerified && <VerifiedBadge />}
                      {isFromChannel ? (
                          <Badge variant="secondary">{t('channel_badge')}</Badge>
                      ) : (
                          displaySender.isBot && !isVerified && <Badge variant="secondary">BOT</Badge>
                      )}
                  </div>
              ): null}

            {message.replyTo && (
                <button
                    data-reply-box="true"
                    onClick={handleScrollToReply}
                    className={cn(
                        "mb-2 p-2 rounded-md w-full text-left transition-colors",
                        alignRight
                            ? "bg-black/10 hover:bg-black/20"
                            : "bg-muted hover:bg-muted/80"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <CornerDownLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <div className={cn(
                                "font-semibold text-sm",
                                alignRight
                                    ? "text-primary-foreground/90"
                                    : "text-primary"
                            )}>{message.replyTo.senderName}</div>
                            <div className={cn(
                                "text-sm truncate",
                                alignRight
                                    ? "text-primary-foreground/70"
                                    : "text-muted-foreground"
                            )}>{message.replyTo.content}</div>
                        </div>
                    </div>
                </button>
            )}
            <div className="overflow-hidden">
                {message.videoUrl ? (
                    <div className="relative my-1">
                         <video src={message.videoUrl} controls className="max-w-xs max-h-80 object-cover rounded-lg" />
                    </div>
                ) : message.imageUrl ? (
                    <div className="relative my-1">
                        <img 
                            src={message.imageUrl} 
                            alt={t('image_attachment_alt')} 
                            className="max-w-xs max-h-80 object-cover rounded-lg"
                        />
                    </div>
                ) : null}
                {message.content && <div className={cn(
                    "text-sm break-all prose prose-sm max-w-none",
                    alignRight ? "prose-invert text-white" : "dark:prose-invert"
                )}>
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                            a: renderLink,
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>}
            </div>
            
            <div className={cn("flex items-center gap-1.5 self-end mt-1 text-xs", alignRight ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {message.editedAt && <span className="italic">{t('edited')}</span>}
                <span>{timestamp}</span>
                {isCurrentUser && chat.type !== 'channel' && !fromBot && (
                    <CheckCheck className={cn("h-4 w-4", isRead ? "text-inherit" : "text-inherit/50")} />
                )}
            </div>
        </>
    );

    return (
        <div 
            id={`message-${message.id}`} 
            className={cn(
                "group flex items-end gap-2",
                alignRight ? "flex-row-reverse" : "flex-row"
            )}
        >
            {showAvatar ? (
                 <div className="w-10 h-10 flex-shrink-0">
                    {displaySender ? (
                        <button onClick={handleAvatarClick} disabled={isCurrentUser || fromBot || !!displaySender.isDeleted}>
                           {isFromChannel ? (
                                <Avatar className="h-10 w-10">
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary">
                                        <Megaphone className="h-5 w-5 text-secondary-foreground" />
                                    </div>
                                </Avatar>
                            ) : (
                                <UserAvatarWithStatus user={displaySender} />
                            )}
                        </button>
                    ) : (
                        <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                    )}
                 </div>
            ) : chatType === 'group' && !alignRight ? (
                <div className="w-10 flex-shrink-0" />
            ) : null}

            <div className={cn(
                "min-w-0 max-w-[calc(100%-6rem)] p-3 rounded-lg flex flex-col",
                alignRight
                ? "bg-primary text-primary-foreground rounded-br-none"
                : "bg-card text-card-foreground rounded-bl-none"
            )}>
               {messageBubbleContent}
            </div>

            <div className="flex-shrink-0 self-center">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            data-menu-trigger="true"
                            className={cn(
                                "h-8 w-8 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                            )}
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={alignRight ? 'end' : 'start'}>
                        {chat.type !== 'channel' && !displaySender?.isDeleted && (
                            <DropdownMenuItem onSelect={() => onReply(message)}>
                                <Reply className="mr-2 h-4 w-4" />
                                <span>{t('reply')}</span>
                            </DropdownMenuItem>
                        )}
                        {message.content && (<DropdownMenuItem onSelect={handleCopy}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>{t('copy_text')}</span>
                        </DropdownMenuItem>)}
                        
                        {(isCurrentUser && !fromBot) || canDeleteMessage ? (
                          <DropdownMenuSeparator />
                        ) : null}

                        {isCurrentUser && !fromBot && (
                          <DropdownMenuItem onSelect={() => setEditingMessage(message)}>
                            <Edit className="mr-2 h-4 w-4" />
                            <span>{t('edit_message')}</span>
                          </DropdownMenuItem>
                        )}

                        {canDeleteMessage && (
                           <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>{t('delete_message')}</span>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
