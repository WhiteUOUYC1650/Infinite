

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  SidebarFooter,
  SidebarHeader,
  SidebarContent as SidebarBody,
  useSidebar,
} from '@/components/ui/sidebar';

import type { Chat, PopulatedChat, User, AuthenticatedUser } from '@/types';
import { UserAvatarWithStatus } from '@/components/chat/user-avatar-with-status';
import { Badge } from '@/components/ui/badge';
import { Cog, Info, LogOut, Moon, Search, Sun, Users, Megaphone, PlusCircle, Bookmark, Languages, Globe, Trash2, Shield, Paintbrush, HelpCircle, Bot, Star, Video as VideoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, useCollection, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDoc, setDoc, serverTimestamp, updateDoc, arrayUnion, runTransaction, getDocs } from 'firebase/firestore';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

interface SidebarContentProps {
  onSelect: (item: PopulatedChat) => void;
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
  const { theme: colorTheme, setTheme: setColorTheme, isDarkMode, toggleTheme, showSnowflakes, toggleSnowflakes, useExperimentalMenu, toggleExperimentalMenu } = useTheme();
  const { setOpenMobile } = useSidebar();
  const [showVersion, setShowVersion] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [editProfileInitiallyShown, setEditProfileInitiallyShown] = useState(false);
  const [showUserProfilePopover, setShowUserProfilePopover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFaqDialog, setShowFaqDialog] = useState(false);
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

  const handleLogout = async () => {
    if (auth && db && currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      try {
        await setDoc(userRef, {
            status: 'offline',
            lastSeen: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error("Failed to update status on logout:", error);
      }
      auth.signOut();
    } else if (auth) {
        auth.signOut();
    }
  };
  
  const handleDeleteAccount = async () => {
    if (!auth || !db || !currentUser?.username) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete account. User data is missing.' });
        return;
    }
    
    setIsDeleting(true);
    sessionStorage.setItem('isDeletingAccount', 'true');

    const userToDelete = auth.currentUser;
    if (!userToDelete) {
        setIsDeleting(false);
        sessionStorage.removeItem('isDeletingAccount');
        return;
    }

    const usernameToDelete = currentUser.username;
    
    try {
        await runTransaction(db, async (transaction) => {
            const userDocRef = doc(db, 'users', userToDelete.uid);
            const usernameDocRef = doc(db, 'usernames', usernameToDelete);
            
            const usernameDoc = await transaction.get(usernameDocRef);

            transaction.update(userDocRef, {
                name: 'Deleted Account',
                username: `@deleted_${userToDelete.uid}`,
                avatar: '',
                status: 'offline',
                statusMessage: '',
                isDeleted: true,
            });

            if (usernameDoc.exists()) {
                transaction.delete(usernameDocRef);
            }
        });

        await deleteUser(userToDelete);
        
        router.push('/goodbye');

    } catch (error: any) {
        console.error("Error deleting account:", error);
        toast({
            variant: 'destructive',
            title: t('delete_account_error'),
            description: error.message || t('unexpected_error')
        });
        setIsDeleting(false);
        sessionStorage.removeItem('isDeletingAccount');
    }
  };

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
            <div className="py-1 md:px-4">
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
                           {/* This is a placeholder for a potential global verified chat */}
                           {/* <VerifiedBadge className="w-4 h-4" /> */}
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

      <SidebarFooter className="p-2">
        <div className="flex items-center gap-2">
          <Popover open={showUserProfilePopover} onOpenChange={setShowUserProfilePopover}>
            <PopoverTrigger asChild>
                <button className="flex items-center gap-2 flex-1 truncate p-2 rounded-md hover:bg-sidebar-accent text-left">
                    {currentUser.uid && currentUser.name && (
                    <UserAvatarWithStatus user={{id: currentUser.uid, name: currentUser.name, username: currentUser.username || '', avatar: currentUser.avatar, status: currentUser.status || "online", isDeleted: currentUser.isDeleted }} />
                    )}
                    <div className="flex-1 truncate">
                    <p className="font-semibold">{currentUser.isDeleted ? t('deleted_account') : (currentUser.name || currentUser.email)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{currentUser.isDeleted ? '' : t(currentUser.status as 'online' | 'away' | 'offline' || 'online')}</p>
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-80 mb-1">
                <UserProfileCard 
                    user={currentUser} 
                    onEditProfile={() => {
                        setShowUserProfilePopover(false);
                        setShowEditProfile(true);
                    }}
                />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
           
           {useExperimentalMenu ? (
                <Button variant="ghost" size="icon" onClick={() => setShowSettingsDialog(true)}>
                    <Cog className="h-5 w-5" />
                </Button>
            ) : (
                <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Cog className="h-5 w-5" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end">
                    <DropdownMenuLabel>{t('settings')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem onSelect={() => setShowEditProfile(true)}>{t('profile')}</DropdownMenuItem>
                        {currentUser.isAdmin && (
                            <DropdownMenuItem onSelect={() => router.push('/admin')}>
                                <Shield className="mr-2 h-4 w-4" />
                                <span>{t('admin_panel_title')}</span>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={promptUpdate}>{t('notifications')}</DropdownMenuItem>
                        <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Paintbrush className="mr-2 h-4 w-4" />
                            <span>{t('appearance')}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuLabel>{t('color_theme')}</DropdownMenuLabel>
                            <DropdownMenuRadioGroup value={colorTheme} onValueChange={(value) => setColorTheme(value as any)}>
                                <DropdownMenuRadioItem value="orange">{t('orange')}</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="purple">{t('purple')}</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="blue">{t('blue')}</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="gray">{t('gray')}</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="green">{t('green')}</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="red">{t('red')}</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="yellow">{t('yellow')}</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="pink">{t('pink')}</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="frutiger">{t('frutiger_aero')}</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Label htmlFor="snow-switch" className="flex w-full cursor-pointer items-center justify-between">
                                        <span>{t('snowflakes')}</span>
                                        <Switch
                                            id="snow-switch"
                                            checked={showSnowflakes}
                                            onCheckedChange={toggleSnowflakes}
                                        />
                                    </Label>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Label htmlFor="experimental-menu-switch" className="flex w-full cursor-pointer items-center justify-between">
                                        <span>{t('experimental_settings_menu_label')}</span>
                                        <Switch
                                            id="experimental-menu-switch"
                                            checked={useExperimentalMenu}
                                            onCheckedChange={toggleExperimentalMenu}
                                        />
                                    </Label>
                                </DropdownMenuItem>
                        </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Languages className="mr-2 h-4 w-4" />
                            <span>{t('language')}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup value={language} onValueChange={(value) => setLanguage(value as 'en' | 'ru')}>
                                <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="ru">Русский</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setShowFaqDialog(true)}>
                        <HelpCircle className="mr-2 h-4 w-4" />
                        <span>{t('help')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setShowVersion(true)}>
                        <Info className="mr-2 h-4 w-4" />
                        <span>{t('version')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>{t('delete_account')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>{t('logout')}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            )}

        </div>
      </SidebarFooter>

      <AlertDialog open={showVersion} onOpenChange={setShowVersion}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>{t('app_version')}</AlertDialogTitle>
            <AlertDialogDescription>
                {t('version_info')}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <Alert className="border-yellow-400 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 text-left mt-4">
              <Star className="h-4 w-4 !text-yellow-500 dark:!text-yellow-600" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                  {t('thank_you_beta')}
              </AlertDescription>
            </Alert>
            <AlertDialogFooter className='mt-4'>
            <AlertDialogAction onClick={() => setShowVersion(false)}>{t('ok')}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_account_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
                {t('delete_account_confirm_desc')}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteAccount} 
                disabled={isDeleting}
                className={cn(buttonVariants({ variant: "destructive" }))}
            >
                {isDeleting ? t('deleting_account') : t('delete_account')}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <FaqDialog
        open={showFaqDialog}
        onOpenChange={setShowFaqDialog}
      />

      {useExperimentalMenu && (
        <ExperimentalSettingsDialog
            open={showSettingsDialog}
            onOpenChange={setShowSettingsDialog}
            currentUser={currentUser}
        />
      )}

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
  } else {
    lastMessageContent = lastMessage?.content;
  }
  
  const lastMessageSenderIsCurrentUser = lastMessage?.senderId === currentUserId;

  let senderPrefix = '';
  if (lastMessageSenderIsCurrentUser && !isSavedMessages) {
      senderPrefix = `${t('you_message_preview')}: `;
  }

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
                    <p className={cn("text-xs truncate", isSelected ? "text-sidebar-accent-foreground/80" : "text-muted-foreground")}>
                       {senderPrefix}{lastMessageContent}
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
  
  let lastMessageContent: string | undefined;
  if (lastMessage?.imageUrl) {
    lastMessageContent = t('image_attachment_placeholder');
  } else if (lastMessage?.videoMimeType) {
    lastMessageContent = t('video_attachment_placeholder');
  } else {
    lastMessageContent = lastMessage?.content;
  }

  const senderIsCurrentUser = lastMessage?.senderId === currentUserId;
  let senderPrefix = '';
  if (item.type === 'group' && lastMessage) {
      if (senderIsCurrentUser) {
          senderPrefix = `${t('you_message_preview')}: `;
      } else if (lastMessage.senderName) {
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
                {lastMessage?.videoMimeType && <VideoIcon className="h-3 w-3 shrink-0" />}
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
