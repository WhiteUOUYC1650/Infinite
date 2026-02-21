'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button, buttonVariants } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  SidebarFooter,
  SidebarHeader,
  SidebarContent as SidebarBody,
  useSidebar,
} from '@/components/ui/sidebar';

import type { Chat, PopulatedChat, User, AuthenticatedUser } from '@/types';
import { UserAvatarWithStatus } from '@/components/chat/user-avatar-with-status';
import { Badge } from '@/components/ui/badge';
import { Cog, Info, LogOut, Moon, Search, Sun, Users, Megaphone, PlusCircle, Bookmark, Languages, Globe, Trash2, Shield, Paintbrush, HelpCircle, Bot, Star, Video as VideoIcon, Music as MusicIcon, Clock, Check, CheckCheck, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, doc, getDoc, setDoc, serverTimestamp, updateDoc, arrayUnion, runTransaction } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EditProfileDialog } from './edit-profile-dialog';
import { NewChatDialog } from './new-chat-dialog';
import { useLanguage } from '@/context/language-context';
import { SearchDialog } from './search-dialog';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { UserProfileCard } from './user-profile-card';
import { Alert, AlertDescription } from './ui/alert';
import { useUpdatePrompt } from '@/context/update-prompt-context';
import { useTheme } from '@/context/theme-context';
import { FaqDialog } from './faq-dialog';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { Skeleton } from './ui/skeleton';
import { VerifiedBadge } from './ui/verified-badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ExperimentalSettingsDialog } from './experimental-settings-dialog';

const iconMap = {
    Users,
    Megaphone,
    Bookmark,
    Globe,
    Bot,
};

// Custom InfVid Icon: Infinite logo inside a Play triangle
const InfVidIcon = ({ className }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    <svg viewBox="0 0 24 24" fill="#FF8C00" className="absolute w-full h-full">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative w-3/5 h-3/5">
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4z" />
    </svg>
  </div>
);

interface SidebarContentProps {
  onSelect: (item: PopulatedChat | 'infvid') => void;
  selectedId?: string;
  currentUser: AuthenticatedUser;
}

export function SidebarContent({ onSelect, selectedId, currentUser }: SidebarContentProps) {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  const { promptUpdate } = useUpdatePrompt();
  const { theme: colorTheme, setTheme: setColorTheme, isDarkMode, toggleTheme, experimentalDesign } = useTheme();
  const { setOpenMobile } = useSidebar();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [editProfileInitiallyShown, setEditProfileInitiallyShown] = useState(false);
  const [showUserProfilePopover, setShowUserProfilePopover] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const [infiniteBot, setInfiniteBot] = useState<User | null>(null);
  const [isBotLoading, setIsBotLoading] = useState(true);

  const chatsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid));
  }, [db, currentUser.uid]);

  const { data: chats, loading: chatsLoading } = useCollection<Chat>(chatsQuery);
  
  const directMessages = useMemo(() => chats?.filter((chat) => chat.type === 'dm' && chat.id !== currentUser.uid) || [], [chats, currentUser.uid]);
  
  const allDmUserIds = useMemo(() => {
    return Array.from(new Set(directMessages.map(c => c.members.find(m => m !== currentUser.uid)).filter(Boolean) as string[]));
  }, [directMessages, currentUser.uid]);

  const { users: dmUsers, loading: dmUsersLoading } = useBatchUsers(allDmUserIds);

  const otherBotMessages = useMemo(() => {
    return directMessages.filter(chat => {
        const otherUserId = chat.members.find(id => id !== currentUser.uid);
        if (!otherUserId) return false;
        if (infiniteBot && otherUserId === infiniteBot.id) return false;
        
        const otherUser = dmUsers[otherUserId];
        return otherUser && otherUser.isBot;
    });
  }, [directMessages, dmUsers, currentUser.uid, infiniteBot]);

  const userDirectMessages = useMemo(() => {
    return directMessages.filter(chat => {
        const otherUserId = chat.members.find(id => id !== currentUser.uid);
        if (!otherUserId) return true;
        if (infiniteBot && otherUserId === infiniteBot.id) return false;
        const otherUser = dmUsers[otherUserId];
        return !otherUser || !otherUser.isBot;
    });
  }, [directMessages, dmUsers, currentUser.uid, infiniteBot]);

  useEffect(() => {
    if (currentUser && currentUser.hasSetNickname === false && !editProfileInitiallyShown) {
        setShowEditProfile(true);
        setEditProfileInitiallyShown(true);
    }
  }, [currentUser, editProfileInitiallyShown]);

  useEffect(() => {
    const findBot = async () => {
        if (!db) return;
        setIsBotLoading(true);
        try {
            const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/Infinite'));
            const botLinkSnap = await getDoc(botLinkRef);

            if (botLinkSnap.exists()) {
                const botId = botLinkSnap.data().botId;
                const botUserRef = doc(db, 'users', botId);
                const botUserSnap = await getDoc(botUserRef);
                if (botUserSnap.exists()) {
                    setInfiniteBot({ id: botUserSnap.id, ...botUserSnap.data() } as User);
                } else {
                    setInfiniteBot(null);
                }
            } else {
                setInfiniteBot(null);
            }
        } catch (error) {
            console.error("Error finding Infinite bot:", error);
            setInfiniteBot(null);
        } finally {
            setIsBotLoading(false);
        }
    };
    findBot();
  }, [db]);


  const groupDiscussions = useMemo(() => chats?.filter((chat) => chat.type === 'group') || [], [chats]);
  const channels = useMemo(() => chats?.filter((chat) => chat.type === 'channel') || [], [chats]);

  const handleSelect = (item: Chat) => {
    const iconName = item.icon as keyof typeof iconMap | undefined;
    const populatedItem: PopulatedChat = {
        ...item,
        iconComponent: iconName ? iconMap[iconName] : undefined,
    };
    onSelect(populatedItem);
    setOpenMobile(false);
  };
  
  const handleChatCreated = (chatId: string) => {
    const newChat = chats?.find(c => c.id === chatId);
    if (newChat) {
      handleSelect(newChat);
    }
  }

  const handleSelectSavedMessages = async () => {
    if (!db) return;
    const chatId = currentUser.uid;
    const chatRef = doc(db, 'chats', chatId);

    try {
        const chatSnap = await getDoc(chatRef);
        let chatData: Chat;

        if (!chatSnap.exists()) {
            chatData = {
                id: chatId,
                type: 'dm',
                members: [currentUser.uid],
                icon: 'Bookmark',
            };
            await setDoc(chatRef, {
                type: 'dm',
                members: [currentUser.uid],
                icon: 'Bookmark',
                unreadCounts: { [currentUser.uid]: 0 },
            });
        } else {
            chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat;
        }

        handleSelect(chatData);

    } catch (error) {
        console.error("Error handling Saved Messages:", error);
        toast({ title: 'Error', description: 'Could not open Saved Messages.'});
    }
  };

  const handleSelectGeneralChat = async () => {
    if (!db) return;
    const chatId = 'GENERAL_CHAT';
    const chatRef = doc(db, 'chats', chatId);

    try {
        const chatSnap = await getDoc(chatRef);
        let chatData: Chat;

        if (!chatSnap.exists()) {
            chatData = {
                id: chatId,
                type: 'group',
                name: 'General Chat',
                members: [currentUser.uid],
                icon: 'Globe',
            };
            await setDoc(chatRef, {
                type: 'group',
                name: 'General Chat',
                icon: 'Globe',
                members: [currentUser.uid],
            });
        } else {
            chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat;
            if (!chatData.members.includes(currentUser.uid)) {
                await updateDoc(chatRef, {
                    members: arrayUnion(currentUser.uid)
                });
                chatData.members.push(currentUser.uid);
            }
        }

        handleSelect(chatData);

    } catch (error) {
        console.error("Error handling General Chat:", error);
        toast({ title: 'Error', description: 'Could not open General Chat.' });
    }
  };

  const handleSelectInfiniteBot = async () => {
    if (!db || !infiniteBot) {
        toast({
            variant: 'destructive',
            title: 'Bot not found',
            description: 'The Infinite bot account may not have been created yet.'
        });
        return;
    }
    const chatId = [currentUser.uid, infiniteBot.id].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);

    try {
        const chatSnap = await getDoc(chatRef);
        let chatData: Chat;

        if (!chatSnap.exists()) {
            chatData = {
                id: chatId,
                type: 'dm',
                members: [currentUser.uid, infiniteBot.id],
                icon: 'Bot',
            };
            await setDoc(chatRef, {
                type: 'dm',
                members: [currentUser.uid, infiniteBot.id],
                icon: 'Bot',
            });
        } else {
            chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat;
        }
        handleSelect(chatData);
    } catch(error) {
        console.error("Error creating chat with bot:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not open a chat with the bot.'
        });
    }
  };


  return (
    <>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-headline text-primary">
                Infinite
              </h1>
            </div>
            <div className='flex items-center'>
              <Button variant="ghost" size="icon" onClick={() => setShowSearchDialog(true)}>
                  <Search className="h-6 w-6" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowNewChat(true)}>
                  <PlusCircle className="h-6 w-6" />
              </Button>
            </div>
        </div>
      </SidebarHeader>

      <ScrollArea className="flex-1">
        <SidebarBody>
            <div className="py-1 md:px-4 space-y-1">
                <Button
                    variant="ghost"
                    onClick={handleSelectSavedMessages}
                    className={cn("w-full justify-start h-auto py-2 text-left", selectedId === currentUser.uid && 'bg-sidebar-accent text-sidebar-accent-foreground')}
                >
                    <div className="flex items-center gap-3 w-full px-4 md:px-0">
                        <Bookmark className="h-5 w-5 text-muted-foreground" />
                        <p className="font-semibold">{t('saved_messages')}</p>
                    </div>
                </Button>
                <Button
                    variant="ghost"
                    onClick={handleSelectGeneralChat}
                    className={cn("w-full justify-start h-auto py-2 text-left", selectedId === 'GENERAL_CHAT' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
                >
                    <div className="flex items-center gap-3 w-full px-4 md:px-0">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                           <p className="font-semibold">{t('general_chat')}</p>
                        </div>
                    </div>
                </Button>
                <Button
                    variant="ghost"
                    onClick={() => { onSelect('infvid'); setOpenMobile(false); }}
                    className={cn("w-full justify-start h-auto py-2 text-left", selectedId === 'infvid' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
                >
                    <div className="flex items-center gap-3 w-full px-4 md:px-0">
                        <InfVidIcon className="h-5 w-5" />
                        <div className="flex items-center gap-2">
                           <p className="font-semibold">{t('infvid_title')}</p>
                           <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">BETA</Badge>
                        </div>
                    </div>
                </Button>
            </div>
          {chatsLoading ? (
            <div className='p-4'>{t('loading_chats')}</div>
          ) : (
          <Accordion
            type="multiple"
            defaultValue={['bots', 'direct-messages', 'groups', 'channels']}
            className="w-full"
          >
            <AccordionItem value="bots">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-4">
                {t('bots')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                    {isBotLoading ? (
                        <DMChatItemSkeleton />
                    ) : infiniteBot ? (
                        <Button
                            variant="ghost"
                            onClick={handleSelectInfiniteBot}
                            className={cn("relative w-full justify-start h-auto py-2 text-left overflow-hidden", selectedId === [currentUser.uid, infiniteBot.id].sort().join('_') && 'bg-sidebar-accent')}
                        >
                            <div className="flex items-center gap-3 w-full px-4 md:px-0">
                                <UserAvatarWithStatus user={infiniteBot} isSelected={selectedId === [currentUser.uid, infiniteBot.id].sort().join('_')} />
                                <div className="flex-1 w-0 min-w-0 overflow-hidden">
                                     <div className="flex items-center gap-2">
                                        <div className={cn("font-semibold truncate", selectedId === [currentUser.uid, infiniteBot.id].sort().join('_') && "text-sidebar-accent-foreground")}>{infiniteBot.name}</div>
                                        <VerifiedBadge className="w-4 h-4 shrink-0" />
                                    </div>
                                </div>
                            </div>
                        </Button>
                    ) : (
                        <div className='px-4 text-xs text-muted-foreground'>{t('no_bots_found')}</div>
                    )}

                    {dmUsersLoading ? null : (otherBotMessages.length > 0 && <Separator className="my-1" />)}

                    {dmUsersLoading ? (
                        otherBotMessages.length > 0 && <DMChatItemSkeleton />
                    ) : otherBotMessages.length > 0 ? (
                        otherBotMessages.map((chat) => {
                        const otherUserId = chat.members.find(id => id !== currentUser.uid);
                        const otherUser = otherUserId ? dmUsers[otherUserId] : null;
                        if (!otherUser) return <DMChatItemSkeleton key={chat.id} />;

                        return (
                            <DMChatItemComponent
                            key={chat.id}
                            item={chat}
                            otherUser={otherUser}
                            onSelect={handleSelect}
                            selectedId={selectedId}
                            currentUserId={currentUser.uid}
                            />
                        );
                    })) : null}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="direct-messages">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-4">
                {t('direct_messages')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {dmUsersLoading ? (
                    <>
                        <DMChatItemSkeleton />
                        <DMChatItemSkeleton />
                    </>
                  ) : userDirectMessages.map((chat) => {
                    const otherUserId = chat.members.find(id => id !== currentUser.uid);
                    const otherUser = otherUserId ? dmUsers[otherUserId] : null;
                    if (!otherUser) return <DMChatItemSkeleton key={chat.id} />;

                    return (
                        <DMChatItemComponent
                            key={chat.id}
                            item={chat}
                            otherUser={otherUser}
                            onSelect={handleSelect}
                            selectedId={selectedId}
                            currentUserId={currentUser.uid}
                        />
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="groups">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-4">
                {t('groups')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {groupDiscussions.map((chat) => (
                    <ChatItemComponent key={chat.id} item={chat} onSelect={handleSelect} selectedId={selectedId} currentUserId={currentUser.uid} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="channels">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-4">
                {t('channels')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {channels.map((channel) => (
                     <ChatItemComponent key={channel.id} item={channel} onSelect={handleSelect} selectedId={selectedId} currentUserId={currentUser.uid} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
          )}
        </SidebarBody>
      </ScrollArea>
      
      <Separator />

      <SidebarFooter className={cn("p-2", experimentalDesign && "bg-muted/30 rounded-t-2xl border-t shadow-[0_-4px_12px_rgba(0,0,0,0.05)]")}>
        <div className="flex items-center gap-2">
          <Popover open={showUserProfilePopover} onOpenChange={setShowUserProfilePopover}>
            <PopoverTrigger asChild>
                <button className={cn(
                  "flex items-center gap-2 flex-1 truncate p-2 rounded-xl hover:bg-sidebar-accent text-left transition-all",
                  experimentalDesign && "bg-background/50 backdrop-blur-md border border-border/50 shadow-sm"
                )}>
                    {currentUser.uid && currentUser.name && (
                    <UserAvatarWithStatus user={{id: currentUser.uid, name: currentUser.name, username: currentUser.username || '', avatar: currentUser.avatar, status: currentUser.status || "online", isDeleted: currentUser.isDeleted }} />
                    )}
                    <div className="flex-1 truncate">
                    <p className="font-bold text-sm leading-tight">{currentUser.isDeleted ? t('deleted_account') : (currentUser.name || currentUser.email)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{currentUser.isDeleted ? '' : t(currentUser.status as 'online' | 'away' | 'offline' || 'online')}</p>
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className={cn("w-80 mb-2 p-0 overflow-hidden", experimentalDesign ? "rounded-[2rem] border-none shadow-2xl" : "rounded-xl")}>
                <UserProfileCard 
                    user={currentUser} 
                    onEditProfile={() => {
                        setShowUserProfilePopover(false);
                        setShowEditProfile(true);
                    }}
                />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className={cn(experimentalDesign && "rounded-xl bg-background/50")}>
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
           
          <Button variant="ghost" size="icon" onClick={() => setShowSettingsDialog(true)} className={cn(experimentalDesign && "rounded-xl bg-background/50")}>
              <Cog className="h-5 w-5" />
          </Button>
        </div>
      </SidebarFooter>

      <EditProfileDialog 
          user={currentUser}
          open={showEditProfile}
          onOpenChange={setShowEditProfile}
      />

      <NewChatDialog
          currentUser={currentUser}
          open={showNewChat}
          onOpenChange={setShowNewChat}
          onChatCreated={handleChatCreated}
      />

      <SearchDialog
          currentUser={currentUser}
          open={showSearchDialog}
          onOpenChange={setShowSearchDialog}
          onChatSelected={handleSelect}
      />

      <ExperimentalSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          currentUser={currentUser}
      />

    </>
  );
}

function DMChatItemSkeleton() {
    return (
        <div className={cn(buttonVariants({variant: "ghost"}), "w-full justify-start h-auto py-2 text-left pointer-events-none")}>
            <div className="flex items-center gap-3 w-full px-4 md:px-0">
                <Skeleton className='w-10 h-10 rounded-full' />
                <div className="flex-1 truncate space-y-2">
                    <Skeleton className='h-4 w-3/4' />
                    <Skeleton className='h-3 w-1/2' />
                </div>
            </div>
      </div>
    )
}

function DMChatItemComponent({ item, otherUser, onSelect, selectedId, currentUserId }: { item: Chat, otherUser: User, onSelect: (item: Chat) => void, selectedId?: string, currentUserId: string }) {
  const { t } = useLanguage();
  
  const isSavedMessages = otherUser?.id === currentUserId;
  const unreadCount = item.unreadCounts?.[currentUserId] || 0;
  const isSelected = selectedId === item.id;
  const isVerified = otherUser.username === '@Infinite' || otherUser.username === '@InfiniteBot';
  const displayName = isSavedMessages ? t('saved_messages') : (otherUser.isDeleted ? t('deleted_account') : otherUser.name);
  
  const lastMessage = item.lastMessage;
  let lastMessageContent: string | undefined;
  if (lastMessage?.imageUrl) {
    lastMessageContent = t('image_attachment_placeholder');
  } else if (lastMessage?.videoMimeType) {
    lastMessageContent = t('video_attachment_placeholder');
  } else if (lastMessage?.musicMimeType) {
    lastMessageContent = t('music_attachment_placeholder');
  } else {
    lastMessageContent = lastMessage?.content;
  }
  
  const lastMessageSenderIsCurrentUser = lastMessage?.senderId === currentUserId;

  const otherUserIdInDM = item.members.find(id => id !== currentUserId);

  const isRead = useMemo(() => {
    if (!lastMessage || !lastMessageSenderIsCurrentUser || !lastMessage.readBy) return false;
    if (item.type === 'dm' && otherUserIdInDM) {
        return lastMessage.readBy.includes(otherUserIdInDM);
    }
    return false;
  }, [lastMessage, lastMessageSenderIsCurrentUser, item.type, otherUserIdInDM]);

  return (
    <Button
        key={item.id}
        variant="ghost"
        onClick={() => onSelect(item)}
        className={cn("relative w-full justify-start h-auto py-2 text-left overflow-hidden", isSelected && 'bg-sidebar-accent')}
        >
        <div className="flex items-center gap-3 w-full px-4 md:px-0">
            <UserAvatarWithStatus user={otherUser} isSavedMessages={isSavedMessages} isSelected={isSelected} />
            <div className="flex-1 w-0 min-w-0 overflow-hidden">
                <div className="flex items-center gap-2">
                    <div className={cn("font-semibold truncate", isSelected && "text-sidebar-accent-foreground")}>
                        {displayName}
                    </div>
                    {isVerified && <VerifiedBadge className="w-4 h-4 shrink-0" />}
                </div>
                {lastMessageContent && 
                    <p className={cn("text-xs truncate flex items-center gap-1", isSelected ? "text-sidebar-accent-foreground/80" : "text-muted-foreground")}>
                        {lastMessageSenderIsCurrentUser && !isSavedMessages ? (
                            (lastMessage.videoStatus === 'uploading' || lastMessage.musicStatus === 'uploading') ? (
                                <Clock className="h-3 w-3 shrink-0" />
                            ) : (
                                isRead ? <CheckCheck className="h-4 w-4" /> : <Check className="h-3 w-3 shrink-0" />
                            )
                        ) : null}
                       <span>{lastMessageContent}</span>
                    </p>
                }
            </div>
        </div>
        {unreadCount > 0 && (
            <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary">{unreadCount}</Badge>
        )}
    </Button>
  );
}

function ChatItemComponent({ item, onSelect, selectedId, currentUserId }: { item: Chat, onSelect: (item: Chat) => void, selectedId?: string, currentUserId: string }) {
  const { t } = useLanguage();
  const lastMessage = item.lastMessage;
  const Icon = item.icon ? iconMap[item.icon as keyof typeof iconMap] : null;
  const unreadCount = item.unreadCounts?.[currentUserId] || 0;
  const isSelected = selectedId === item.id;
  const senderIsCurrentUser = lastMessage?.senderId === currentUserId;

  const isRead = useMemo(() => {
    if (!lastMessage || !senderIsCurrentUser || !lastMessage.readBy) return false;
    if (item.type === 'group') {
        return lastMessage.readBy.some(id => id !== currentUserId);
    }
    return false; // No read receipts for channels in sidebar
  }, [lastMessage, senderIsCurrentUser, item.type, currentUserId]);
  
  let lastMessageContent: string | undefined;
  if (lastMessage?.imageUrl) {
    lastMessageContent = t('image_attachment_placeholder');
  } else if (lastMessage?.videoMimeType) {
    lastMessageContent = t('video_attachment_placeholder');
  } else if (lastMessage?.musicMimeType) {
    lastMessageContent = t('music_attachment_placeholder');
  } else {
    lastMessageContent = lastMessage?.content;
  }

  let senderPrefix = '';
  if (item.type === 'group' && lastMessage && !senderIsCurrentUser) {
    if (lastMessage.senderName) {
        senderPrefix = `${lastMessage.senderName}: `;
    }
  }

  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(item)}
      className={cn("relative w-full justify-start h-auto py-2 text-left overflow-hidden", isSelected && 'bg-sidebar-accent')}
    >
      <div className="flex items-center gap-3 w-full px-4 md:px-0">
        <Avatar className="h-10 w-10">
            {item.avatar ? (
                <AvatarImage src={item.avatar} alt={item.name} />
            ) : (
                <AvatarFallback className={cn(isSelected && "bg-sidebar-primary text-sidebar-primary-foreground")}>
                    {Icon && <Icon className="h-5 w-5" />}
                </AvatarFallback>
            )}
        </Avatar>
        <div className="flex-1 w-0 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <div className={cn("font-semibold truncate", isSelected ? "text-sidebar-accent-foreground" : "")}>
                {item.name}
            </div>
            {(item.link === '/G/Infinite' || item.link === '/C/Infinite') && <VerifiedBadge className="w-4 h-4 shrink-0" />}
          </div>
          {lastMessageContent && (
            <p className={cn("text-xs truncate flex items-center gap-1", isSelected ? "text-sidebar-accent-foreground/80" : "text-muted-foreground")}>
                {senderIsCurrentUser ? (
                    (lastMessage?.videoStatus === 'uploading' || lastMessage?.musicStatus === 'uploading') ? (
                        <Clock className="h-3 w-3 shrink-0" />
                    ) : (
                        isRead ? <CheckCheck className="h-4 w-4" /> : <Check className="h-3 w-3 shrink-0" />
                    )
                ) : (
                    (lastMessage?.videoMimeType && <VideoIcon className="h-3 w-3 shrink-0" />) || (lastMessage?.musicMimeType && <MusicIcon className="h-3 w-3 shrink-0" />)
                )}
                <span>{senderPrefix}{lastMessageContent}</span>
            </p>
          )}
        </div>
      </div>
      {unreadCount > 0 && (
          <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary">{unreadCount}</Badge>
      )}
    </Button>
  );
}
