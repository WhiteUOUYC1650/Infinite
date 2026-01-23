'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { Message, PopulatedChat, User } from '@/types';
import { Paperclip, Phone, Send, Video, X } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCollection, useFirestore } from '@/firebase';
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

function useUsers(userIds: string[]) {
    const db = useFirestore();
    const [users, setUsers] = useState<Record<string, User>>({});

    const userDocs = useMemo(() => {
        if (!db || !userIds) return [];
        return userIds.map(uid => doc(db, 'users', uid));
    }, [db, userIds]);

    // This is not efficient, but use-doc doesn't support multiple docs
    useEffect(() => {
        if (!userDocs.length) return;

        const unsubscribes = userDocs.map(userDoc => {
            return onSnapshot(userDoc, (snapshot) => {
                if (snapshot.exists()) {
                    setUsers(prev => ({ ...prev, [snapshot.id]: { id: snapshot.id, ...snapshot.data() } as User }));
                }
            });
        });
        
        return () => unsubscribes.forEach(unsub => unsub());

    }, [userDocs]);
    
    return users;
}


export function ChatView({ item, onClose, currentUser }: { item: PopulatedChat, onClose: () => void, currentUser: FirebaseUser }) {
  const db = useFirestore();
  const [messageContent, setMessageContent] = useState('');

  const messagesQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'chats', item.id, 'messages');
  }, [db, item.id]);

  const { data: messages, loading: messagesLoading } = useCollection<Message>(messagesQuery, { orderBy: 'timestamp' });
  const allUserIds = useMemo(() => {
    const ids = new Set(item.members);
    if (messages) {
        messages.forEach(msg => ids.add(msg.senderId));
    }
    return Array.from(ids);
  }, [item.members, messages]);

  const usersData = useUsers(allUserIds);
  
  const otherUser = useMemo(() => {
    if (item.type !== 'dm' || !usersData) return null;
    const otherUserId = item.members.find((id) => id !== currentUser.uid);
    // For "Saved Messages", otherUserId might be undefined or self
    return otherUserId ? usersData[otherUserId] : usersData[currentUser.uid];
  }, [item, currentUser.uid, usersData]);
  
  const getChatName = () => {
    if (item.type === 'dm') {
      if (otherUser?.id === currentUser.uid) {
        return 'Saved Messages';
      }
      return otherUser?.name || 'Direct Message';
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
    if (!messageContent.trim() || !db) return;

    try {
      await addDoc(collection(db, 'chats', item.id, 'messages'), {
        senderId: currentUser.uid,
        content: messageContent,
        timestamp: serverTimestamp(),
      });
      setMessageContent('');
    } catch (error) {
      console.error("Error sending message: ", error);
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
            {item.type === "dm" && otherUser && otherUser.id !== currentUser.uid
              ? otherUser.status
              : `${item.members?.length || 0} members`}
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
        {messagesLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Loading messages...</div>
        ) : messages && messages.length > 0 ? (
            <div className="space-y-6">
                {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} sender={usersData[message.senderId]} isCurrentUser={message.senderId === currentUser.uid} chatType={item.type} />
                ))}
            </div>
        ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                There is nothing here yet.
            </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      {canSendMessage && (
        <footer className="p-4 border-t">
            <form onSubmit={handleSendMessage} className="relative">
            <Textarea
                placeholder="Type a message..."
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
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="icon" type="button">
                    <Paperclip className="h-5 w-5" />
                </Button>
                <Button size="icon" type="submit">
                  <Send className="h-5 w-5" />
                </Button>
            </div>
            </form>
        </footer>
      )}
    </div>
  );
}

function ChatMessage({ message, sender, isCurrentUser, chatType }: { message: Message, sender?: User, isCurrentUser: boolean, chatType: PopulatedChat['type'] }) {
    const timestamp = message.timestamp ? new Date(message.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const isChannel = chatType === 'channel';
    const alignRight = isCurrentUser && !isChannel;
    
  return (
    <div className={cn("flex items-end gap-3", alignRight && "flex-row-reverse")}>
      {(!alignRight) && sender && (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Avatar className="h-8 w-8">
                        {sender.avatar && <AvatarImage src={sender.avatar} alt={sender.name} />}
                        <AvatarFallback>{sender.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{sender.name}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      )}
      <div
        className={cn(
          "max-w-xs lg:max-w-md p-3 rounded-lg",
          alignRight
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-secondary text-secondary-foreground rounded-bl-none"
        )}
      >
        <p className="text-sm">{message.content}</p>
        <p className="text-xs opacity-70 mt-1 text-right">{timestamp}</p>
      </div>
    </div>
  );
}
