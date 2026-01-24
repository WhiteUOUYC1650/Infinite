'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { Message, PopulatedChat, User, AuthenticatedUser } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';
import { useLanguage } from '@/context/language-context';

export function ChatView({ item, onClose, currentUser }: { item: PopulatedChat, onClose: () => void, currentUser: AuthenticatedUser }) {
  const db = useFirestore();
  const { t } = useLanguage();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // --- Optimized User fetching for DM header ---
  const otherUserId = useMemo(() => {
    if (item.type !== 'dm') return null;
    // For DMs, find the other user's ID. For 'Saved Messages', it's the current user's ID.
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

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || !db || isSending) return;

    setIsSending(true);
    const content = messageContent;
    setMessageContent(''); // Optimistic UI update

    const chatRef = doc(db, 'chats', item.id);
    const messagesCollectionRef = collection(chatRef, 'messages');

    // Denormalize sender info into the message for fewer reads
    const messageData = {
      senderId: currentUser.uid,
      content: content,
      timestamp: serverTimestamp(),
      senderName: currentUser.name || currentUser.username || "User",
      senderAvatar: currentUser.avatar || ''
    };

    const lastMessageData = {
        content: content,
        senderId: currentUser.uid,
        senderName: currentUser.name || currentUser.username || "User",
        timestamp: serverTimestamp(),
    };
    
    try {
        const batch = writeBatch(db);
        const newMessageRef = doc(messagesCollectionRef); // Create ref with auto-id
        
        batch.set(newMessageRef, messageData);
        batch.update(chatRef, { lastMessage: lastMessageData });
        
        await batch.commit();

    } catch (serverError: any) {
        // Revert optimistic UI on failure
        setMessageContent(content);

        console.error("Error sending message: ", serverError);
        const permissionError = new FirestorePermissionError({
            path: messagesCollectionRef.path,
            operation: 'create',
            requestResourceData: messageData,
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsSending(false);
    }
  };

  const canSendMessage = item.type !== 'channel' || (item.type === 'channel' && item.ownerId === currentUser.uid);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Header */}
      <header className="flex items-center p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onClose} className="mr-2">
            <X className="h-5 w-5" />
        </Button>
        {item.type === "dm" && otherUser ? (
          <UserAvatarWithStatus user={otherUser} isSavedMessages={otherUser.id === currentUser.uid} />
        ) : (
          item.iconComponent && <item.iconComponent className="h-8 w-8 mr-3 text-muted-foreground" />
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold font-headline">{getChatName()}</h2>
          <p className="text-sm text-muted-foreground">
            {item.type === 'dm'
              ? otherUser && otherUser.id !== currentUser.uid
                ? otherUser.status
                : null
              : t('members_count', {count: item.members?.length || 0})}
          </p>
        </div>
        {item.type === 'dm' && otherUser?.id !== currentUser.uid && (
            <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
                <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
                <Video className="h-5 w-5" />
            </Button>
            </div>
        )}
      </header>

      {/* Message List */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {loadingMessages ? (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        ) : messages && messages.length > 0 ? (
            <div className="space-y-6">
                {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} isCurrentUser={message.senderId === currentUser.uid} chatType={item.type} />
                ))}
            </div>
        ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                {t('no_messages_yet')}
            </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      {canSendMessage && (
        <footer className="p-4 border-t">
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
                <Button variant="ghost" size="icon" type="button">
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

// Simplified ChatMessage component that uses denormalized data
function ChatMessage({ message, isCurrentUser, chatType }: { message: Message, isCurrentUser: boolean, chatType: PopulatedChat['type']}) {
    const timestamp = message.timestamp ? format(new Date(message.timestamp.seconds * 1000), 'dd.MM.yyyy, HH:mm') : '';
    const isChannel = chatType === 'channel';
    
    const senderName = message.senderName;
    const senderAvatar = message.senderAvatar || '';
    
  return (
    <div className={cn(
        "flex items-end gap-3", 
        !isChannel && isCurrentUser && "flex-row-reverse"
    )}>
       {!isCurrentUser && isChannel && senderName && (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Avatar className="h-8 w-8">
                        {senderAvatar ? <AvatarImage src={senderAvatar} alt={senderName || ''} /> : <AvatarFallback>{senderName?.charAt(0)}</AvatarFallback>}
                    </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{senderName}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      )}
      <div
        className={cn(
          "max-w-xs lg:max-w-md p-3 rounded-lg",
          isCurrentUser
            ? "bg-primary text-primary-foreground rounded-br-none ml-auto"
            : "bg-card text-card-foreground rounded-bl-none"
        )}
      >
        {!isCurrentUser && isChannel && <p className="text-xs font-bold mb-1">{senderName}</p>}
        <p className="text-sm">{message.content}</p>
        <p className="text-xs opacity-70 mt-1 text-right">{timestamp}</p>
      </div>
    </div>
  );
}
