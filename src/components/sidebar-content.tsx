'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Cog, Info, LogOut, Moon, Search, Sun, Users, Megaphone, PlusCircle, Bookmark, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, useCollection, useFirestore } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore'; // Import getDocs and where
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

// --- New Optimized Hook for fetching users in batches ---
function useBatchUsers(userIds: string[]) {
    const db = useFirestore();
    const [users, setUsers] = useState<Record<string, User>>({});
    const [loading, setLoading] = useState(true);

    // Sort and stringify to create a stable dependency for useEffect
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
            
            // Firestore 'in' queries are limited to 30 elements.
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


const iconMap = {
    Users,
    Megaphone,
    Bookmark,
};

interface SidebarContentProps {
  onSelect: (item: PopulatedChat) => void;
  selectedId?: string;
  currentUser: AuthenticatedUser;
}

export function SidebarContent({ onSelect, selectedId, currentUser }: SidebarContentProps) {
  const auth = useAuth();
  const db = useFirestore();
  const { language, setLanguage, t } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { setOpenMobile } = useSidebar();
  const [showVersion, setShowVersion] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [editProfileInitiallyShown, setEditProfileInitiallyShown] = useState(false);


  const chatsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid));
  }, [db, currentUser.uid]);

  const { data: chats, loading: chatsLoading } = useCollection<Chat>(chatsQuery);
  
  // --- Optimization: Batch fetch user data for DMs ---
  const directMessages = useMemo(() => chats?.filter((chat) => chat.type === 'dm') || [], [chats]);
  const dmUserIds = useMemo(() => {
      return Array.from(new Set(directMessages
          .map(chat => chat.members.find(id => id !== currentUser.uid) || chat.members[0])
          .filter((id): id is string => !!id)));
  }, [directMessages, currentUser.uid]);

  const { users: dmUsers, loading: usersLoading } = useBatchUsers(dmUserIds);
  // --- End Optimization ---

  useEffect(() => {
    if (currentUser && currentUser.hasSetNickname === false && !editProfileInitiallyShown) {
        setShowEditProfile(true);
        setEditProfileInitiallyShown(true);
    }
  }, [currentUser, editProfileInitiallyShown]);

  const groupDiscussions = useMemo(() => chats?.filter((chat) => chat.type === 'group') || [], [chats]);
  const channels = useMemo(() => chats?.filter((chat) => chat.type === 'channel') || [], [chats]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const initialTheme =
      storedTheme === 'dark' ||
      (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light';
    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
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

  const handleLogout = () => {
    if (auth) {
      auth.signOut();
    }
  };

  return (
    <>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-headline text-primary">
            Infinite
            </h1>
            <Button variant="ghost" size="icon" onClick={() => setShowNewChat(true)}>
                <PlusCircle className="h-6 w-6" />
            </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('search')} className="pl-8" />
        </div>
      </SidebarHeader>

      <ScrollArea className="flex-1">
        <SidebarBody>
          {chatsLoading ? (
            <div className='p-4'>{t('loading_chats')}</div>
          ) : (
          <Accordion
            type="multiple"
            defaultValue={['direct-messages', 'groups', 'channels']}
            className="w-full px-2"
          >
            <AccordionItem value="direct-messages">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-2">
                {t('direct_messages')}
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <div className="space-y-1">
                  {directMessages.map((chat) => {
                    const otherUserId = chat.members.find(id => id !== currentUser.uid) || chat.members[0];
                    return (
                        <DMChatItemComponent
                        key={chat.id}
                        item={chat}
                        onSelect={handleSelect}
                        selectedId={selectedId}
                        currentUserId={currentUser.uid}
                        otherUser={dmUsers[otherUserId]}
                        isLoading={usersLoading}
                        />
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="groups">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-2">
                {t('groups')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {groupDiscussions.map((chat) => (
                    <ChatItemComponent key={chat.id} item={chat} onSelect={handleSelect} selectedId={selectedId} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="channels">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-2">
                {t('channels')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {channels.map((channel) => (
                     <ChatItemComponent key={channel.id} item={channel} onSelect={handleSelect} selectedId={selectedId} />
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
        <div className="flex items-center gap-2 p-2">
          {currentUser.uid && currentUser.name && (
            <UserAvatarWithStatus user={{id: currentUser.uid, name: currentUser.name, username: currentUser.username || '', avatar: currentUser.avatar || '', status: currentUser.status || "online" }} />
          )}
          <div className="flex-1 truncate">
            <p className="font-semibold">{currentUser.name || currentUser.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{currentUser.status || 'online'}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'light' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
           <DropdownMenu>
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
                    <DropdownMenuItem>{t('notifications')}</DropdownMenuItem>
                    <DropdownMenuItem>{t('appearance')}</DropdownMenuItem>
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
                <DropdownMenuItem onSelect={() => setShowVersion(true)}>
                    <Info className="mr-2 h-4 w-4" />
                    <span>{t('version')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
            <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowVersion(false)}>{t('ok')}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showEditProfile && (
        <EditProfileDialog 
            user={currentUser}
            open={showEditProfile}
            onOpenChange={setShowEditProfile}
        />
      )}

      {showNewChat && (
        <NewChatDialog
            currentUser={currentUser}
            open={showNewChat}
            onOpenChange={setShowNewChat}
            onChatCreated={handleChatCreated}
        />
      )}

    </>
  );
}

// --- Simplified DMChatItemComponent ---
function DMChatItemComponent({ item, onSelect, selectedId, currentUserId, otherUser, isLoading }: { item: Chat, onSelect: (item: Chat) => void, selectedId?: string, currentUserId: string, otherUser?: User, isLoading: boolean }) {
  const { t } = useLanguage();
  if (isLoading || !otherUser) {
    return (
        <Button variant="ghost" className="w-full justify-start h-auto p-2 text-left">
            <div className="flex items-center gap-3 w-full">
                <div className='w-10 h-10 bg-muted rounded-full animate-pulse' />
                <div className="flex-1 truncate space-y-2">
                    <div className='h-4 w-3/4 bg-muted rounded animate-pulse' />
                    <div className='h-3 w-1/2 bg-muted rounded animate-pulse' />
                </div>
            </div>
      </Button>
    )
  }

  const isSavedMessages = otherUser?.id === currentUserId;

  return (
    <Button
        key={item.id}
        variant="ghost"
        onClick={() => onSelect(item)}
        className={cn("w-full justify-start h-auto p-2 text-left", selectedId === item.id && 'bg-accent')}
        >
        <div className="flex items-center gap-3 w-full">
            <UserAvatarWithStatus user={otherUser} isSavedMessages={isSavedMessages} />
            <div className="flex-1 truncate">
                <p className="font-semibold">{isSavedMessages ? t('saved_messages') : otherUser.name}</p>
                {item.lastMessage?.content && <p className="text-xs text-muted-foreground truncate">{item.lastMessage.content}</p>}
            </div>
            {item.unreadCount && item.unreadCount > 0 && (
                <Badge className="bg-primary">{item.unreadCount}</Badge>
            )}
        </div>
    </Button>
  );
}

function ChatItemComponent({ item, onSelect, selectedId }: { item: Chat, onSelect: (item: Chat) => void, selectedId?: string }) {
  const lastMessage = item.lastMessage as { senderName?: string, content?: string };
  const Icon = item.icon ? iconMap[item.icon as keyof typeof iconMap] : null;
  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(item)}
      className={cn("w-full justify-start h-auto p-2 text-left", selectedId === item.id && 'bg-accent')}
    >
      <div className="flex items-center gap-3 w-full">
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        <div className="flex-1 truncate">
          <p className="font-semibold">{item.name}</p>
          {lastMessage?.content && <p className="text-xs text-muted-foreground truncate">{`${lastMessage.senderName?.split(' ')[0]}: ${lastMessage.content}`}</p>}
        </div>
        {item.unreadCount && item.unreadCount > 0 && (
            <Badge className="bg-primary">{item.unreadCount}</Badge>
        )}
      </div>
    </Button>
  );
}
