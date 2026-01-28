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
import { Cog, Info, LogOut, Moon, Search, Sun, Users, Megaphone, PlusCircle, Bookmark, Languages, Globe, Star, Trash2, Shield, Paintbrush, HelpCircle, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, useCollection, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
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
  const { theme: colorTheme, setTheme: setColorTheme, isDarkMode, toggleTheme } = useTheme();
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

  const botMessages = useMemo(() => {
    return directMessages.filter(chat => {
        const otherUserId = chat.members.find(id => id !== currentUser.uid);
        return otherUserId && dmUsers[otherUserId]?.isBot;
    });
  }, [directMessages, dmUsers, currentUser.uid]);

  const userDirectMessages = useMemo(() => {
    return directMessages.filter(chat => {
        const otherUserId = chat.members.find(id => id !== currentUser.uid);
        return !otherUserId || !dmUsers[otherUserId]?.isBot;
    });
  }, [directMessages, dmUsers, currentUser.uid]);

  
  useEffect(() => {
    if (currentUser && currentUser.hasSetNickname === false && !editProfileInitiallyShown) {
        setShowEditProfile(true);
        setEditProfileInitiallyShown(true);
    }
  }, [currentUser, editProfileInitiallyShown]);

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

    const userToDelete = auth.currentUser;
    if (!userToDelete) {
        setIsDeleting(false);
        return;
    }

    const usernameToDelete = currentUser.username;
    
    try {
        await runTransaction(db, async (transaction) => {
            const userDocRef = doc(db, 'users', userToDelete.uid);
            const usernameDocRef = doc(db, 'usernames', usernameToDelete);
            transaction.delete(userDocRef);
            transaction.delete(usernameDocRef);
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
                        <p className="font-semibold">{t('general_chat')}</p>
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
                  {dmUsersLoading ? (
                    <>
                      <DMChatItemSkeleton />
                    </>
                  ) : botMessages.map((chat) => (
                    <ChatItemComponent key={chat.id} item={chat} onSelect={handleSelect} selectedId={selectedId} currentUserId={currentUser.uid} />
                  ))}
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
                    <UserAvatarWithStatus user={{id: currentUser.uid, name: currentUser.name, username: currentUser.username || '', avatar: currentUser.avatar, status: currentUser.status || "online" }} />
                    )}
                    <div className="flex-1 truncate">
                    <p className="font-semibold">{currentUser.name || currentUser.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{t(currentUser.status as 'online' | 'away' | 'offline' || 'online')}</p>
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
                            <span>Admin Panel</span>
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
                          </DropdownMenuRadioGroup>
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

  return (
    <Button
        key={item.id}
        variant="ghost"
        onClick={() => onSelect(item)}
        className={cn("w-full justify-start h-auto py-2 text-left", isSelected && 'bg-sidebar-accent')}
        >
        <div className="flex items-center gap-3 w-full px-4 md:px-0">
            <UserAvatarWithStatus user={otherUser} isSavedMessages={isSavedMessages} isSelected={isSelected} />
            <div className="flex-1 truncate">
                <p className={cn("font-semibold", isSelected && "text-sidebar-accent-foreground")}>{isSavedMessages ? t('saved_messages') : otherUser.name}</p>
                {item.lastMessage?.content && <p className={cn("text-xs truncate", isSelected ? "text-sidebar-accent-foreground/80" : "text-muted-foreground")}>{item.lastMessage.content}</p>}
            </div>
            {unreadCount > 0 && (
                <Badge className="bg-primary">{unreadCount}</Badge>
            )}
        </div>
    </Button>
  );
}

function ChatItemComponent({ item, onSelect, selectedId, currentUserId }: { item: Chat, onSelect: (item: Chat) => void, selectedId?: string, currentUserId: string }) {
  const lastMessage = item.lastMessage as { senderName?: string, content?: string };
  const Icon = item.icon ? iconMap[item.icon as keyof typeof iconMap] : null;
  const unreadCount = item.unreadCounts?.[currentUserId] || 0;
  const isSelected = selectedId === item.id;

  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(item)}
      className={cn("w-full justify-start h-auto py-2 text-left", isSelected && 'bg-sidebar-accent')}
    >
      <div className="flex items-center gap-3 w-full px-4 md:px-0">
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        <div className="flex-1 truncate">
          <p className={cn("font-semibold", isSelected && "text-sidebar-accent-foreground")}>{item.name}</p>
          {lastMessage?.content && <p className={cn("text-xs truncate", isSelected ? "text-sidebar-accent-foreground/80" : "text-muted-foreground")}>{`${lastMessage.senderName?.split(' ')[0]}: ${lastMessage.content}`}</p>}
        </div>
        {unreadCount > 0 && (
            <Badge className="bg-primary">{unreadCount}</Badge>
        )}
      </div>
    </Button>
  );
}
