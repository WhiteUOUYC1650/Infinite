'use client';

import { Button } from '@/components/ui/button';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, addDoc, increment } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';
import { useLanguage } from '@/context/language-context';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export function ChatView({ item: initialItem, onClose, currentUser }: { item: PopulatedChat, onClose: () => void, currentUser: AuthenticatedUser }) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // --- Refs for height calculation and scrolling ---
  const chatViewRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Get live chat data ---
  const chatDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'chats', initialItem.id);
  }, [db, initialItem.id]);

  const { data: liveChatData } = useDoc<Chat>(chatDocRef);

  const item = useMemo(() => {
      return { ...initialItem, ...liveChatData };
  }, [initialItem, liveChatData]);
  // --- End live chat data ---

  // --- Reset unread count ---
  useEffect(() => {
    if (db && currentUser?.uid && item.id) {
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
  }, [db, currentUser?.uid, item.id, item.unreadCounts]);

  // --- Optimized User fetching for DM header ---
  const otherUserId = useMemo(() => {
    if (item.type !== 'dm') return null;
    return item.members.find((id) => id !== currentUser.uid) || currentUser.uid;
  }, [item, currentUser.uid]);

  const otherUserDocRef = useMemoFirebase(() => {
    if (!db || !otherUserId) return null;
    return doc(db, 'users', otherUserId);
  }, [db, otherUserId]);

  const { data: otherUser } = useDoc<User>(otherUserDocRef);
  // --- End Optimization ---

  const messagesQuery = useMemoFirebase(() => {
    if (!db) return null;
    setLoadingMessages(true);
    return collection(db, 'chats', item.id, 'messages');
  }, [db, item.id]);

  const collectionOptions = useMemo(() => ({ orderBy: 'timestamp' as const }), []);
  const { data: messages, loading: messagesLoading } = useCollection<Message>(messagesQuery, collectionOptions);

  useEffect(() => {
    if (item) {
      setLoadingMessages(true);
    }
  }, [item]);

  useEffect(() => {
      if(!messagesLoading) {
        setLoadingMessages(false);
      }
  }, [messagesLoading]);

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
    
    if (user.status === 'offline' && user.lastSeen) {
      const lastSeenDate = new Date(user.lastSeen.seconds * 1000);
      return `${t('was_online')} ${format(lastSeenDate, 'dd.MM.yyyy, HH:mm')}`;
    }
    
    if (user.status === 'online' || user.status === 'away') {
      return t(user.status);
    }
    
    return t('offline');
  }

  // --- Auto-scroll to bottom ---
  useLayoutEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, loadingMessages]);

  const canSendMessage = item.type !== 'channel' || (item.type === 'channel' && item.ownerId === currentUser.uid);

  // --- Dynamic Height Calculation ---
  useLayoutEffect(() => {
    const calculateAndSetHeight = () => {
      if (chatViewRef.current && headerRef.current && messagesContainerRef.current) {
        const totalHeight = chatViewRef.current.offsetHeight;
        const headerHeight = headerRef.current.offsetHeight;
        const footerHeight = footerRef.current ? footerRef.current.offsetHeight : 0;
        
        const messagesHeight = totalHeight - headerHeight - footerHeight;
        
        messagesContainerRef.current.style.height = `${messagesHeight}px`;
      }
    };

    calculateAndSetHeight();

    const resizeObserver = new ResizeObserver(calculateAndSetHeight);
    if (chatViewRef.current) {
      resizeObserver.observe(chatViewRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [canSendMessage]); // Recalculate if footer appears/disappears

  const handleSendMessage = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || !db) return;
  
    setIsSending(true);
    const content = messageContent;
    const now = new Date();
    const timestamp = Timestamp.fromDate(now);

    setMessageContent('');
  
    const messagesCollectionRef = collection(db, 'chats', item.id, 'messages');
  
    const messageData: { [key: string]: any } = {
        senderId: currentUser.uid,
        content: content,
        timestamp: timestamp,
        senderName: currentUser.name || currentUser.username || "User",
    };

    if (currentUser.avatar) {
        messageData.senderAvatar = currentUser.avatar;
    }
  
    addDoc(messagesCollectionRef, messageData)
      .catch((serverError: any) => {
        setMessageContent(content); // Re-populate the input on error
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
      content: content,
      senderId: currentUser.uid,
      senderName: currentUser.name || currentUser.username || "User",
      timestamp: timestamp,
    };
  
    const chatUpdateData: { [key:string]: any } = { 
        lastMessage: lastMessageData 
    };
  
    item.members.forEach(memberId => {
        if (memberId !== currentUser.uid) {
            chatUpdateData[`unreadCounts.${memberId}`] = increment(1);
        }
    });
  
    updateDoc(chatRef, chatUpdateData).catch((error) => {
        console.error("Error updating chat metadata:", error);
    });
  };

  return (
    <div ref={chatViewRef} className="flex flex-col h-full bg-background overflow-hidden">
      {/* Chat Header */}
      <header ref={headerRef} className="flex-shrink-0 flex items-center p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onClose} className="mr-2">
            <X className="h-5 w-5" />
        </Button>
        {item.type === "dm" && otherUser ? (
          <UserAvatarWithStatus user={otherUser} isSavedMessages={otherUser.id === currentUser.uid} />
        ) : (
          item.iconComponent && <item.iconComponent className="h-8 w-8 mr-3 text-muted-foreground" />
        )}
        <div className={cn("flex-1", item.type === 'dm' && 'ml-3')}>
          <h2 className="text-lg font-semibold font-headline">{getChatName()}</h2>
           <p className="text-sm text-muted-foreground">
            {item.type === 'dm'
              ? otherUser?.id !== currentUser.uid
                ? getStatusText(otherUser)
                : item.members.length === 1 ? null : t('members_count', {count: item.members?.length || 0})
              : t('members_count', {count: item.members?.length || 0})}
          </p>
        </div>
        {item.type === 'dm' && otherUser?.id !== currentUser.uid && (
            <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => toast({ title: t('placeholder_title'), description: t('placeholder_description') })}>
                <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => toast({ title: t('placeholder_title'), description: t('placeholder_description') })}>
                <Video className="h-5 w-5" />
            </Button>
            </div>
        )}
      </header>

      {/* Message List */}
      <div ref={messagesContainerRef} className="overflow-y-auto">
        {loadingMessages ? (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        ) : messages && messages.length > 0 ? (
            <div className="space-y-6 p-4">
                {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} isCurrentUser={message.senderId === currentUser.uid} chatType={item.type} />
                ))}
                <div ref={messagesEndRef} />
            </div>
        ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground p-4">
                {t('no_messages_yet')}
                <div ref={messagesEndRef} />
            </div>
        )}
      </div>

      {/* Message Input */}
      {canSendMessage && (
        <footer ref={footerRef} className="flex-shrink-0 p-4 border-t">
            <form onSubmit={handleSendMessage} className="relative">
            <Textarea
                placeholder={t('message_placeholder')}
                className="pr-24 py-3 resize-none"
                rows={1}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                    }
                }}
                disabled={isSending}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="icon" type="button" onClick={() => toast({ title: t('placeholder_title'), description: t('placeholder_description') })}>
                    <Paperclip className="h-5 w-5" />
                </Button>
                <Button size="icon" type="submit" disabled={isSending}>
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
            </div>
            </form>
        </footer>
      )}
    </div>
  );
}

function ChatMessage({ message, isCurrentUser, chatType }: { message: Message, isCurrentUser: boolean, chatType: PopulatedChat['type']}) {
    const timestamp = message.timestamp ? format(new Date(message.timestamp.seconds * 1000), 'dd.MM.yyyy, HH:mm') : '';
    const isChannel = chatType === 'channel';

  return (
    <div className={cn(
        "flex items-end gap-3", 
        isCurrentUser && !isChannel && "flex-row-reverse"
    )}>
      <div
        className={cn(
          "max-w-xs lg:max-w-md p-3 rounded-lg",
          isCurrentUser && !isChannel
            ? "bg-primary text-primary-foreground rounded-br-none ml-auto"
            : "bg-card text-card-foreground rounded-bl-none"
        )}
      >
        <p className="text-sm">{message.content}</p>
        <p className="text-xs opacity-70 mt-1 text-right">{timestamp}</p>
      </div>
    </div>
  );
}
