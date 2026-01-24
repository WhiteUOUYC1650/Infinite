'use client';

import { Button } from '@/components/ui/button';
import type { Message, PopulatedChat, User, AuthenticatedUser, Chat } from '@/types';
import { Loader2, Paperclip, Phone, Send, Video, X, MoreVertical, User as UserIcon, Info, Trash2, Users, Megaphone } from 'lucide-react';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { cn } from '@/lib/utils';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, Timestamp, addDoc, increment, getDocs, query, where, getDoc, setDoc } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';
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

// --- New Optimized Hook for fetching users in batches ---
function useBatchUsers(userIds: string[]) {
    const db = useFirestore();
    const [users, setUsers] = useState<Record<string, User>>({});
    const [loading, setLoading] = useState(true);

    const stringifiedUserIds = JSON.stringify(userIds.sort());

    useEffect(() => {
        const uniqueUserIds = JSON.parse(stringifiedUserIds);
        if (!db || uniqueUserIds.length === 0) {
            setUsers({});
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


export function ChatView({ item: initialItem, onClose, currentUser, onSelectChat }: { item: PopulatedChat, onClose: () => void, currentUser: AuthenticatedUser, onSelectChat: (chat: PopulatedChat) => void }) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState<User | null>(null);
  const [showChatProfile, setShowChatProfile] = useState(false);
  const isMobile = useIsMobile();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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

  const otherUserDocRef = useMemoFirebase(() => {
    if (!db || !otherUserId) return null;
    return doc(db, 'users', otherUserId);
  }, [db, otherUserId]);

  const { data: otherUser } = useDoc<User>(otherUserDocRef);
  // --- End Optimization ---

  // --- Fetch all members' data ---
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !isMember) return null;
    return collection(db, 'chats', item.id, 'messages');
  }, [db, item.id, isMember]);

  const collectionOptions = useMemo(() => ({ orderBy: 'timestamp' as const }), []);
  const { data: messages, loading: messagesLoading } = useCollection<Message>(messagesQuery, collectionOptions);

  const messageSenderIds = useMemo(() => {
    if (!messages) return [];
    const ids = messages.map(m => m.senderId);
    if(item.id === 'GENERAL_CHAT') {
        // For general chat, we also need to fetch all members who sent a message
        return Array.from(new Set(ids));
    }
    return Array.from(new Set(ids));
  }, [messages, item.id]);

  const allUserIdsToFetch = useMemo(() => {
      const combined = [...(item.members || []), ...messageSenderIds];
      return Array.from(new Set(combined));
  }, [item.members, messageSenderIds]);

  const { users: memberDetails, loading: membersLoading } = useBatchUsers(allUserIdsToFetch);


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

  const canSendMessage = useMemo(() => {
    if (!isMember) return false;
    return item.type !== 'channel' || (item.type === 'channel' && item.ownerId === currentUser.uid);
  }, [isMember, item.type, item.ownerId, currentUser.uid]);


  // --- Auto-scroll ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, item, chatLoading, messagesLoading, membersLoading]);


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
            <DropdownMenu>
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
                                    <DropdownMenuItem onSelect={() => toast({ title: t('placeholder_title'), description: t('placeholder_description') })}>
                                        <Phone className="mr-2 h-4 w-4" />
                                        <span>{t('audio_call')}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => toast({ title: t('placeholder_title'), description: t('placeholder_description') })}>
                                        <Video className="mr-2 h-4 w-4" />
                                        <span>{t('video_call')}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => toast({ title: t('placeholder_title'), description: t('placeholder_description') })} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>{t('delete_chat')}</span>
                                    </DropdownMenuItem>
                                </>
                            ) : (
                                <DropdownMenuItem onSelect={() => toast({ title: t('placeholder_title'), description: t('placeholder_description') })} className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
        </div>
      </header>

      {/* Message List */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-y-auto">
            {isLoading ? (
                <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            ) : isMember && messages && messages.length > 0 ? (
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
    </div>
  );
}

function ChatMessage({ message, sender, isCurrentUser, chatType, onAvatarClick }: { message: Message, sender?: User, isCurrentUser: boolean, chatType: PopulatedChat['type'], onAvatarClick: (user: User) => void }) {
    const timestamp = message.timestamp ? format(new Date(message.timestamp.seconds * 1000), 'dd.MM.yyyy, HH:mm') : '';
    
    const handleAvatarClick = () => {
        if (sender && !isCurrentUser) {
            onAvatarClick(sender);
        }
    };
    
    // Logic for avatar: only for other users in a group chat.
    const showAvatar = chatType === 'group' && !isCurrentUser;

    // Logic for alignment: user's own messages are on the right, except in channels where all messages are on the left.
    const alignRight = isCurrentUser && chatType !== 'channel';

    return (
        <div className={cn(
            "flex items-end gap-3",
            alignRight ? "flex-row-reverse" : "flex-row"
        )}>
            {showAvatar ? (
                 <div className="w-10 h-10 flex-shrink-0">
                    {sender ? (
                        <button onClick={handleAvatarClick} disabled={isCurrentUser}>
                            <UserAvatarWithStatus user={sender} />
                        </button>
                    ) : (
                        <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                    )}
                 </div>
            ) : (
                <div className={cn({'w-10': chatType === 'group' && isCurrentUser})} />
            )}

            <div className={cn(
                "max-w-[85%] p-3 rounded-lg flex flex-col",
                alignRight
                ? "bg-primary text-primary-foreground rounded-br-none"
                : "bg-card text-card-foreground rounded-bl-none"
            )}>
                {((chatType === 'group' && !isCurrentUser) || (chatType === 'channel')) && sender ? (
                     <p className="font-semibold text-sm mb-1">{sender.name}</p>
                ): null}

                <p className="text-sm break-words">{message.content}</p>
                <p className="text-xs opacity-70 mt-1 text-right self-end">{timestamp}</p>
            </div>
        </div>
    );
}
