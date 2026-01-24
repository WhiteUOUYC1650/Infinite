'use client';

import { Button } from '@/components/ui/button';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, addDoc, increment, getDocs, query, where } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';
import { useLanguage } from '@/context/language-context';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { UserProfileDialog } from '../user-profile-dialog';

// --- New Optimized Hook for fetching users in batches ---
function useBatchUsers(userIds: string[]) {
    const db = useFirestore();
    const [users, setUsers] = useState<Record<string, User>>({});
    const [loading, setLoading] = useState(true);

    const stringifiedUserIds = JSON.stringify(userIds.sort());

    useEffect(() => {
        const uniqueUserIds = JSON.parse(stringifiedUserIds);
        if (!db || uniqueUserIds.length === 0) {
            setLoading(false);
            return;
        }

        const fetchUsers = async () => {
            setLoading(true);
            const usersCollection = collection(db, 'users');
            const fetchedUsers: Record<string, User> = {};
            
            const chunks: string[][] = [];
            for (let i = 0; i < uniqueUserIds.length; i += 30) {
                chunks.push(uniqueUserIds.slice(i, i + 30));
            }

            try {
                const querySnapshots = await Promise.all(chunks.map(chunk => {
                    const q = query(usersCollection, where('__name__', 'in', chunk));
                    return getDocs(q);
                }));

                querySnapshots.forEach(snapshot => {
                    snapshot.forEach(doc => {
                        fetchedUsers[doc.id] = { id: doc.id, ...doc.data() } as User;
                    });
                });
                setUsers(fetchedUsers);
            } catch (error) {
                console.error("Error fetching users in batch:", error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, stringifiedUserIds]);

    return { users, loading };
}


export function ChatView({ item: initialItem, onClose, currentUser }: { item: PopulatedChat, onClose: () => void, currentUser: AuthenticatedUser }) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState<User | null>(null);

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
    if (db && currentUser?.uid && item.id && item.id !== 'GENERAL_CHAT') {
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

  // --- Fetch all members' data ---
  const { users: memberDetails, loading: membersLoading } = useBatchUsers(item.members);


  const messagesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'chats', item.id, 'messages');
  }, [db, item.id]);

  const collectionOptions = useMemo(() => ({ orderBy: 'timestamp' as const }), []);
  const { data: messages, loading: messagesLoading } = useCollection<Message>(messagesQuery, collectionOptions);

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
  }, [messages, messagesLoading]);

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
  }, [canSendMessage]);

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

  return (
    <div ref={chatViewRef} className="flex flex-col h-full bg-background overflow-hidden">
      {/* Chat Header */}
      <header ref={headerRef} className="flex-shrink-0 flex items-center p-4 border-b">
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
                <div className="flex items-center min-w-0">
                    {item.iconComponent && <item.iconComponent className="h-8 w-8 mr-3 text-muted-foreground" />}
                    <div className="truncate">
                        <h2 className="text-lg font-semibold font-headline truncate">{getChatName()}</h2>
                        <p className="text-sm text-muted-foreground truncate">
                            {item.id === 'GENERAL_CHAT'
                                ? t('public_chat_description')
                                : t('members_count', { count: item.members?.length || 0 })}
                        </p>
                    </div>
                </div>
            )}
        </div>

        {item.type === 'dm' && otherUser?.id !== currentUser.uid && (
            <div className="flex items-center gap-2 ml-2">
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
        {messagesLoading ? (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        ) : messages && messages.length > 0 ? (
            <div className="space-y-4 p-4">
                {messages.map((message) => {
                    const sender = memberDetails[message.senderId];
                    return (
                        <ChatMessage 
                            key={message.id} 
                            message={message} 
                            sender={sender}
                            isCurrentUser={message.senderId === currentUser.uid} 
                            chatType={item.type} 
                            onAvatarClick={setProfileDialogUser}
                        />
                    );
                })}
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
                  <Send className="h-5 w-5" />
                </Button>
            </div>
            </form>
        </footer>
      )}

      {profileDialogUser && (
        <UserProfileDialog 
            user={profileDialogUser}
            open={!!profileDialogUser}
            onOpenChange={(open) => {
                if(!open) setProfileDialogUser(null);
            }}
            onSendMessage={() => {
                setProfileDialogUser(null);
            }}
        />
      )}
    </div>
  );
}

function ChatMessage({ message, sender, isCurrentUser, chatType, onAvatarClick }: { message: Message, sender?: User, isCurrentUser: boolean, chatType: PopulatedChat['type'], onAvatarClick: (user: User) => void }) {
    const timestamp = message.timestamp ? format(new Date(message.timestamp.seconds * 1000), 'dd.MM.yyyy, HH:mm') : '';
    const showAvatarInGroup = !isCurrentUser && chatType === 'group';

    const handleAvatarClick = () => {
        if (sender) {
            onAvatarClick(sender);
        }
    };

    return (
        <div className={cn(
            "flex items-start gap-3",
            (isCurrentUser && chatType !== 'channel') && "flex-row-reverse"
        )}>
            {showAvatarInGroup && sender ? (
                <button onClick={handleAvatarClick} className="w-10 h-10 flex-shrink-0">
                    <UserAvatarWithStatus user={sender} />
                </button>
            ) : null}

            <div className={cn(
                "max-w-xs lg:max-w-md p-3 rounded-lg flex flex-col",
                (isCurrentUser && chatType !== 'channel')
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-card text-card-foreground rounded-bl-none"
            )}>
                {showAvatarInGroup && sender && (
                    <p className="font-semibold text-sm mb-1">{sender.name}</p>
                )}
                <p className="text-sm break-words">{message.content}</p>
                <p className="text-xs opacity-70 mt-1 text-right self-end">{timestamp}</p>
            </div>
        </div>
    );
}
