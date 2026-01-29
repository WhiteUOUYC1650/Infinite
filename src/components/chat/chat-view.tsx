'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X, MoreVertical, User as UserIcon, Info, Trash2, Users, Megaphone, Check, CheckCheck, Bookmark, Globe, Bot, Copy, Edit, Reply } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, addDoc, increment, getDocs, query, where, getDoc, setDoc, writeBatch, arrayUnion, deleteDoc } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format, isSameDay } from 'date-fns';
import { useLanguage } from '@/context/language-context';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { UserProfileDialog } from '../user-profile-dialog';
import { ChatProfileDialog } from './chat-profile-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUpdatePrompt } from '@/context/update-prompt-context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaqDialog } from '../faq-dialog';
import { Badge } from '../ui/badge';
import { useBatchUsers } from '@/hooks/use-batch-users';


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


export function ChatView({ item: initialItem, onClose, currentUser, onSelectChat }: { item: PopulatedChat, onClose: () => void, currentUser: AuthenticatedUser, onSelectChat: (chat: PopulatedChat) => void }) {
  const db = useFirestore();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { promptUpdate } = useUpdatePrompt();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState<User | null>(null);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const [showFaqDialog, setShowFaqDialog] = useState(false);
  const isMobile = useIsMobile();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [stickyDate, setStickyDate] = useState<string | null>(null);
  
  // --- Get live chat data ---
  const chatDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'chats', initialItem.id);
  }, [db, initialItem.id]);

  const { data: liveChatData, loading: chatLoading } = useDoc<Chat>(chatDocRef);

  const item = useMemo(() => {
    if (!liveChatData) return initialItem;
    return { ...initialItem, ...liveChatData };
  }, [initialItem, liveChatData]);

  const isMember = useMemo(() => {
    if (!item?.members) return false;
    return item.members.includes(currentUser.uid);
  }, [item.members, currentUser.uid]);

  // --- End live chat data ---

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
      if (otherUser?.id === currentUser.uid) {
        return t('saved_messages');
      }
      return otherUser?.name || t('direct_message_tab');
    }
    return item.name;
  };
  
  const getStatusText = (user: User | null | undefined) => {
    if (!user) return null;

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
    return item.type !== 'channel' || (item.type === 'channel' && item.ownerId === currentUser.uid);
  }, [isMember, item.type, item.ownerId, currentUser.uid]);


  // --- Auto-scroll ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, item, chatLoading, messagesLoading, membersLoading]);

  // --- Sticky Date Header Logic ---
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollTop } = container;
        const dateSeparators = container.querySelectorAll<HTMLElement>('[data-date-separator]');
        
        let currentStickyDate: string | null = null;
        
        if (dateSeparators.length > 0 && scrollTop < dateSeparators[0].offsetTop) {
            currentStickyDate = dateSeparators[0].dataset.dateSeparator || null;
        } else {
            for (let i = 0; i < dateSeparators.length; i++) {
                const separator = dateSeparators[i];
                if (separator.offsetTop <= scrollTop + 40) { // 40px offset for the sticky header itself
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

        container.addEventListener('scroll', handleScroll);
        handleScroll(); // Initial check

        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll, messages]); // Rerun if messages change


  const handleSendMessageToUser = async (targetUser: User) => {
    if (!db || !currentUser) return;

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
        onSelectChat(chatData as PopulatedChat);
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


  const handleSendMessage = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || !db) return;
  
    setIsSending(true);
    const originalContent = messageContent;
    const contentForMessage = originalContent.replace(/\n/g, '  \n');
    const contentForPreview = originalContent.split('\n')[0];
    const now = new Date();
    const timestamp = Timestamp.fromDate(now);

    setMessageContent('');
  
    const messagesCollectionRef = collection(db, 'chats', item.id, 'messages');
  
    const messageData: { [key: string]: any } = {
        senderId: currentUser.uid,
        content: contentForMessage,
        timestamp: timestamp,
        senderName: currentUser.name || currentUser.username || "User",
        type: 'user',
        readBy: [],
    };

    if (currentUser.avatar) {
        messageData.senderAvatar = currentUser.avatar;
    }
  
    addDoc(messagesCollectionRef, messageData)
      .catch((serverError: any) => {
        setMessageContent(originalContent); // Re-populate the input on error
        console.error("Error sending message: ", serverError);
        const permissionError = new FirestorePermissionError({
            path: messagesCollectionRef.path,
            operation: 'create',
            requestResourceData: messageData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsSending(false);
      });
  
    const chatRef = doc(db, 'chats', item.id);
    const lastMessageData = {
      content: contentForPreview,
      senderId: currentUser.uid,
      senderName: currentUser.name || currentUser.username || "User",
      timestamp: timestamp,
    };
  
    const chatUpdateData: { [key:string]: any } = { 
        lastMessage: lastMessageData 
    };
  
    if (item.id !== 'GENERAL_CHAT') {
      item.members.forEach(memberId => {
          if (memberId !== currentUser.uid) {
              chatUpdateData[`unreadCounts.${memberId}`] = increment(1);
          }
      });
    }
  
    updateDoc(chatRef, chatUpdateData).catch((error) => {
        console.error("Error updating chat metadata:", error);
    });
  };
  
  const isLoading = messagesLoading || chatLoading || (allUserIdsToFetch.length > 0 && membersLoading);

  return (
    <div className={cn("flex flex-col h-svh bg-background overflow-hidden", isMobile ? 'w-screen' : 'w-full')}>
      {/* Chat Header */}
      <header className="flex-shrink-0 flex items-center p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onClose} className="mr-2">
            <X className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 flex items-center min-w-0">
            {item.type === "dm" ? (
                otherUser ? ( // If we have the user, show the profile button
                    <button
                        className="flex items-center text-left hover:bg-accent p-1 rounded-md -m-1 transition-colors min-w-0"
                        onClick={() => setProfileDialogUser(otherUser)}
                        disabled={otherUser.id === currentUser.uid}
                    >
                        <UserAvatarWithStatus user={otherUser} isSavedMessages={otherUser.id === currentUser.uid} />
                        <div className="ml-3 truncate">
                            <h2 className="text-lg font-semibold font-headline truncate">{getChatName()}</h2>
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
                    className="flex items-center text-left hover:bg-accent p-1 rounded-md -m-1 transition-colors min-w-0"
                    onClick={() => setShowChatProfile(true)}
                    disabled={item.id === 'GENERAL_CHAT'}
                >
                    {item.iconComponent && <item.iconComponent className="h-8 w-8 mr-3 text-muted-foreground" />}
                    <div className="truncate">
                        <h2 className="text-lg font-semibold font-headline truncate">{getChatName()}</h2>
                        <p className="text-sm text-muted-foreground truncate">
                            {item.id === 'GENERAL_CHAT'
                                ? t('public_chat_description')
                                : t('members_count', { count: item.members?.length || 0 })}
                        </p>
                    </div>
                </button>
            )}
        </div>

        <div className="flex items-center gap-2 ml-2">
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
                                        <DropdownMenuItem onSelect={() => setProfileDialogUser(otherUser)}>
                                            <UserIcon className="mr-2 h-4 w-4" />
                                            <span>{t('view_profile')}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={promptUpdate}>
                                            <Phone className="mr-2 h-4 w-4" />
                                            <span>{t('audio_call')}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={promptUpdate}>
                                            <Video className="mr-2 h-4 w-4" />
                                            <span>{t('video_call')}</span>
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

      {/* Message List */}
      <div className="flex-1 relative min-h-0">
        <div ref={scrollContainerRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto">
            {isLoading ? (
                <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            ) : isMember && messages && messages.length > 0 ? (
                <>
                {stickyDate && (
                    <div className="sticky top-0 z-10 flex justify-center py-2 bg-background/80 backdrop-blur-sm pointer-events-none">
                        <Badge variant="secondary">{stickyDate}</Badge>
                    </div>
                )}
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
                                    promptUpdate={promptUpdate}
                                />
                            </React.Fragment>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
                </>
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

      {/* Message Input */}
      {canSendMessage && (
        <footer className="flex-shrink-0 p-4 border-t">
            <form onSubmit={handleSendMessage} className="relative">
            <Textarea
                placeholder={t('message_placeholder')}
                className="pr-24 py-3 resize-none"
                rows={1}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        handleSendMessage(e);
                    }
                }}
                disabled={isSending}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="icon" type="button" onClick={promptUpdate}>
                    <Paperclip className="h-5 w-5" />
                </Button>
                <Button size="icon" type="submit" disabled={isSending}>
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
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

    <FaqDialog open={showFaqDialog} onOpenChange={setShowFaqDialog} />
    </div>
  );
}

function ChatMessage({ message, sender, isCurrentUser, chatType, onAvatarClick, chat, currentUser, onInternalLinkClick, promptUpdate }: { message: Message, sender?: User, isCurrentUser: boolean, chatType: PopulatedChat['type'], onAvatarClick: (user: User) => void, chat: PopulatedChat, currentUser: AuthenticatedUser, onInternalLinkClick: (href: string) => Promise<void>, promptUpdate: () => void }) {
    const db = useFirestore();
    const { t } = useLanguage();
    const { toast } = useToast();
    const timestamp = message.timestamp ? format(new Date(message.timestamp.seconds * 1000), 'HH:mm') : '';
    const fromBot = message.type === 'announcement';
    const alignRight = isCurrentUser && !fromBot && chatType !== 'channel';

    const otherUserId = useMemo(() => {
        if (chat.type !== 'dm') return null;
        return chat.members.find((id) => id !== currentUser.uid);
    }, [chat, currentUser.uid]);

    const isRead = useMemo(() => {
        if (!isCurrentUser) return false;

        // If a message was sent before read receipts were implemented, it won't
        // have a `readBy` field. We'll treat these as "read" to avoid confusion.
        if (message.readBy === undefined) {
            return true;
        }
        
        if (!message.readBy || message.readBy.length === 0) return false;

        if (chat.type === 'dm') {
            return otherUserId ? message.readBy.includes(otherUserId) : false;
        }
        if (chat.type === 'group') {
            return message.readBy.some(readerId => readerId !== currentUser.uid);
        }
        return false;
    }, [message.readBy, chat.type, currentUser.uid, otherUserId, isCurrentUser]);


    const handleAvatarClick = () => {
        if (fromBot) return; // Don't open profile for bot
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
    
    const showAvatar = (chatType === 'group' && !isCurrentUser) || fromBot;

    // Create a fake User object for the bot from the message data
    const botUser: User | undefined = fromBot ? {
        id: 'INFINITE_BOT',
        name: message.senderName || 'Infinite',
        username: '@InfiniteBot',
        avatar: message.senderAvatar,
        status: 'online',
        isBot: true,
    } : undefined;

    const displaySender = fromBot ? botUser : sender;

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

        // External links
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={cn(alignRight ? "text-white" : "text-primary", "underline")} {...props}>
                {children}
            </a>
        );
    };
    
    return (
        <div className={cn(
            "flex items-end gap-3",
            alignRight ? "flex-row-reverse" : "flex-row"
        )}>
            {showAvatar ? (
                 <div className="w-10 h-10 flex-shrink-0">
                    {displaySender ? (
                        <button onClick={handleAvatarClick} disabled={isCurrentUser || fromBot}>
                            <UserAvatarWithStatus user={displaySender} />
                        </button>
                    ) : (
                        <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                    )}
                 </div>
            ) : chatType === 'group' && !alignRight ? (
                <div className="w-10 flex-shrink-0" />
            ) : null}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div className={cn(
                        "max-w-[85%] min-w-0 p-3 rounded-lg flex flex-col cursor-pointer",
                        alignRight
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-card text-card-foreground rounded-bl-none",
                    )}>
                        {((chatType === 'group' && !isCurrentUser) || (chatType === 'channel') || fromBot) && displaySender ? (
                            <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                                {displaySender.name}
                                {displaySender.isBot && <Badge variant="secondary">BOT</Badge>}
                            </p>
                        ): null}

                        <div className={cn(
                            "text-sm break-words prose prose-sm prose-p:my-0 prose-headings:my-2",
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
                        </div>
                        
                        <div className={cn("flex items-center gap-1.5 self-end mt-1 text-xs", alignRight ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            <span>{timestamp}</span>
                            {isCurrentUser && chat.type !== 'channel' && !fromBot && (
                                <CheckCheck className={cn("h-4 w-4", isRead ? "text-primary-foreground/70" : "text-primary-foreground/30")} />
                            )}
                        </div>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={alignRight ? 'end' : 'start'}>
                    <DropdownMenuItem onSelect={promptUpdate}>
                        <Reply className="mr-2 h-4 w-4" />
                        <span>{t('reply')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleCopy}>
                        <Copy className="mr-2 h-4 w-4" />
                        <span>{t('copy_text')}</span>
                    </DropdownMenuItem>
                    {isCurrentUser && !fromBot && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={promptUpdate}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>{t('edit_message')}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>{t('delete_message')}</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
