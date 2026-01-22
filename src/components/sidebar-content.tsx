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
} from '@/components/ui/dropdown-menu';
import {
  SidebarFooter,
  SidebarHeader,
  SidebarContent as SidebarBody,
  useSidebar,
} from '@/components/ui/sidebar';

import type { Chat, Channel, PopulatedChat, User, AuthenticatedUser } from '@/types';
import { UserAvatarWithStatus } from '@/components/chat/user-avatar-with-status';
import { Badge } from '@/components/ui/badge';
import { Cog, Info, LogOut, Moon, Search, Sun, Users, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, useCollection } from '@/firebase';
import { collection, getFirestore, query, where, doc } from 'firebase/firestore';
import { useDoc } from '@/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


const iconMap = {
    Users,
    Megaphone,
};

interface SidebarContentProps {
  onSelect: (item: PopulatedChat) => void;
  selectedId?: string;
  currentUser: AuthenticatedUser;
}

export function SidebarContent({ onSelect, selectedId, currentUser }: SidebarContentProps) {
  const auth = useAuth();
  const db = getFirestore();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { setOpenMobile } = useSidebar();
  const [showVersion, setShowVersion] = useState(false);

  const chatsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid));
  }, [db, currentUser.uid]);

  const { data: chats, loading: chatsLoading } = useCollection<Chat>(chatsQuery);

  const directMessages = useMemo(() => chats?.filter((chat) => chat.type === 'dm') || [], [chats]);
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

  const handleLogout = () => {
    if (auth) {
      auth.signOut();
    }
  };

  return (
    <>
      <SidebarHeader className="p-4">
        <h1 className="text-2xl font-bold font-headline text-primary">
          Infinite
        </h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-8" />
        </div>
      </SidebarHeader>

      <ScrollArea className="flex-1">
        <SidebarBody>
          {chatsLoading ? (
            <div className='p-4'>Loading chats...</div>
          ) : (
          <Accordion
            type="multiple"
            defaultValue={['direct-messages', 'groups', 'channels']}
            className="w-full px-2"
          >
            <AccordionItem value="direct-messages">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-2">
                Direct Messages
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <div className="space-y-1">
                  {directMessages.map((chat) => (
                    <DMChatItemComponent
                      key={chat.id}
                      item={chat}
                      onSelect={handleSelect}
                      selectedId={selectedId}
                      currentUserId={currentUser.uid}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="groups">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-2">
                Group Discussions
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
                Broadcast Channels
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
          {currentUser.id && currentUser.name && currentUser.avatar && (
            <UserAvatarWithStatus user={{id: currentUser.id, name: currentUser.name, username: currentUser.username || '', avatar: currentUser.avatar, status: currentUser.status || "online" }} />
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
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Notifications</DropdownMenuItem>
                    <DropdownMenuItem>Appearance</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setShowVersion(true)}>
                    <Info className="mr-2 h-4 w-4" />
                    <span>Version</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>

      <AlertDialog open={showVersion} onOpenChange={setShowVersion}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>App Version</AlertDialogTitle>
            <AlertDialogDescription>
                You are currently running version 0.1 of Infinite messenger.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowVersion(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DMChatItemComponent({ item, onSelect, selectedId, currentUserId }: { item: Chat, onSelect: (item: Chat) => void, selectedId?: string, currentUserId: string }) {
  const db = getFirestore();
  const otherUserId = useMemo(() => item.members.find(id => id !== currentUserId), [item.members, currentUserId]);
  
  const userDocRef = useMemo(() => {
    if (!db || !otherUserId) return null;
    return doc(db, 'users', otherUserId);
  }, [db, otherUserId]);

  const { data: otherUser, loading } = useDoc<User>(userDocRef);
  
  if (loading || !otherUser) {
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

  return (
    <Button
        key={item.id}
        variant="ghost"
        onClick={() => onSelect(item)}
        className={cn("w-full justify-start h-auto p-2 text-left", selectedId === item.id && 'bg-accent')}
        >
        <div className="flex items-center gap-3 w-full">
            {otherUser && (
                <UserAvatarWithStatus user={otherUser} />
            )}
            <div className="flex-1 truncate">
                <p className="font-semibold">{otherUser?.name}</p>
                {/* lastMessage can be implemented later */}
                {/* {item.lastMessage && <p className="text-xs text-muted-foreground truncate">{item.lastMessage.content}</p>} */}
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
          {lastMessage && <p className="text-xs text-muted-foreground truncate">{`${lastMessage.senderName?.split(' ')[0]}: ${lastMessage.content}`}</p>}
        </div>
        {item.unreadCount && item.unreadCount > 0 && (
            <Badge className="bg-primary">{item.unreadCount}</Badge>
        )}
      </div>
    </Button>
  );
}
