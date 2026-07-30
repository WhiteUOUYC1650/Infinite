'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
import { UserAvatarWithStatus, InfiniteLogo } from '@/components/chat/user-avatar-with-status';
import { Badge } from '@/components/ui/badge';
import { Cog, Info, LogOut, Moon, Search, Sun, Users, Megaphone, PlusCircle, Bookmark, Languages, Globe, Trash2, Shield, Paintbrush, HelpCircle, Bot, Star, Image as ImageIcon, Video as VideoIcon, Music as MusicIcon, Clock, Check, CheckCheck, PlayCircle, Rocket, PartyPopper, Heart, ShieldCheck, Flower2, Flag, Sparkles, Gamepad2, Newspaper, Cpu, Mic, File as FileIcon, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, doc, getDoc, setDoc, serverTimestamp, updateDoc, arrayUnion, runTransaction } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { EditProfileDialog } from './edit-profile-dialog';
import { NewChatDialog } from './new-chat-dialog';
import { useLanguage } from '@/context/language-context';
import { SearchDialog } from './search-dialog';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { UserProfileCard } from './user-profile-card';
import { useTheme } from '@/context/theme-context';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { Skeleton } from './ui/skeleton';
import { VerifiedBadge } from './ui/verified-badge';
import { PremBadge } from './ui/prem-badge';
import { BetaBadge } from './ui/beta-badge';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { ExperimentalSettingsDialog } from './experimental-settings-dialog';
import { useUpdatePrompt } from '@/context/update-prompt-context';
import { StoriesBar } from './stories/stories-bar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const iconMap = {
    Users,
    Megaphone,
    Bookmark,
    Globe,
    Bot,
};

function HolidayBanner() {
  const { t } = useLanguage();
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const holidays = [
    { day: 1, month: 1, name: 'holiday_new_year', icon: PartyPopper, color: 'from-blue-500 to-cyan-400' },
    { day: 7, month: 1, name: 'holiday_christmas', icon: Sparkles, color: 'from-blue-600 to-indigo-500' },
    { day: 14, month: 2, name: 'holiday_valentines', icon: Heart, color: 'from-rose-500 to-pink-400' },
    { day: 23, month: 2, name: 'holiday_defenders', icon: ShieldCheck, color: 'from-red-600 to-orange-600' },
    { day: 8, month: 3, name: 'holiday_womens_day', icon: Flower2, color: 'from-pink-500 to-rose-400' },
    { day: 12, month: 4, name: 'holiday_cosmonautics', icon: Rocket, color: 'from-indigo-600 to-purple-500' },
    { day: 1, month: 5, name: 'holiday_labor_day', icon: Flag, color: 'from-red-500 to-orange-500' },
    { day: 9, month: 5, name: 'holiday_victory_day', icon: Star, color: 'from-orange-600 to-red-700' },
    { day: 12, month: 6, name: 'holiday_russia_day', icon: Flag, color: 'from-blue-500 to-red-500' },
    { day: 4, month: 11, name: 'holiday_unity_day', icon: Users, color: 'from-blue-600 to-red-600' },
    { day: 31, month: 12, name: 'holiday_new_year_eve', icon: PartyPopper, color: 'from-blue-500 to-purple-600' },
  ];
  const currentHoliday = holidays.find(h => h.day === day && h.month === month);
  if (!currentHoliday) return null;
  const Icon = currentHoliday.icon;
  return (
    <div className={cn("mx-4 my-2 p-3 rounded-2xl bg-gradient-to-r text-white flex items-center gap-3 shadow-lg shadow-primary/10 animate-in fade-in slide-in-from-top-2 duration-500", currentHoliday.color)}>
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0"><Icon className="w-6 h-6" /></div>
      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{t('today_is')}</p><p className="font-bold text-sm leading-tight truncate">{t(currentHoliday.name as any)}</p></div>
    </div>
  );
}

interface SidebarContentProps {
  onSelect: (item: PopulatedChat | 'infvid' | 'infgames' | 'feed' | 'bot_studio') => void;
  selectedId?: string;
  currentUser: AuthenticatedUser;
}

export function SidebarContent({ onSelect, selectedId, currentUser }: SidebarContentProps) {
  const db = useFirestore(); 
  const { language, t } = useLanguage(); 
  const { toggleTheme, isDarkMode, experimentalDesign, glassEffect, showFeed } = useTheme(); 
  const { setOpenMobile } = useSidebar(); 
  const { isUpdateAvailable } = useUpdatePrompt();
  
  const [showEditProfile, setShowEditProfile] = useState(false); 
  const [showNewChat, setShowNewChat] = useState(false); 
  const [showSearchDialog, setShowSearchDialog] = useState(false); 
  const [editProfileInitiallyShown, setEditProfileInitiallyShown] = useState(false); 
  const [showUserProfilePopover, setShowUserProfilePopover] = useState(false); 
  const [showSettingsDialog, setShowSettingsDialog] = useState(false); 
  const [isOnline, setIsOnline] = useState(true);
  const [primaryBots, setPrimaryBots] = useState<User[]>([]); 
  const [isBotLoading, setIsBotLoading] = useState(true);
  
  const router = useRouter();

  useEffect(() => { 
    const handleStatus = () => setIsOnline(navigator.onLine); 
    if (typeof window !== 'undefined') { 
      window.addEventListener('online', handleStatus); 
      window.addEventListener('offline', handleStatus); 
      setIsOnline(navigator.onLine); 
    } 
    return () => { 
      if (typeof window !== 'undefined') { 
        window.removeEventListener('online', handleStatus); 
        window.removeEventListener('offline', handleStatus); 
      } 
    }; 
  }, []);
  
  const chatsQuery = useMemo(() => { 
    if (!db || !currentUser.uid) return null; 
    return query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid)); 
  }, [db, currentUser.uid]);
  
  const { data: chats, loading: chatsLoading } = useCollection<Chat>(chatsQuery);
  
  const sortedChats = useMemo(() => { 
    if (!chats) return []; 
    return [...chats].sort((a, b) => (b.lastMessage?.timestamp?.toMillis() || 0) - (a.lastMessage?.timestamp?.toMillis() || 0)); 
  }, [chats]);
  
  const directMessages = useMemo(() => sortedChats.filter((chat) => chat.type === 'dm' && chat.id !== currentUser.uid), [sortedChats, currentUser.uid]);
  
  const allDmUserIds = useMemo(() => {
    return Array.from(new Set(directMessages.map(c => c.members.find(m => m !== currentUser.uid)).filter(Boolean) as string[]));
  }, [directMessages, currentUser.uid]);
  
  const { users: dmUsers, loading: dmUsersLoading } = useBatchUsers(allDmUserIds);
  
  const otherBotMessages = useMemo(() => directMessages.filter(chat => { 
    const otherUserId = chat.members.find(id => id !== currentUser.uid); 
    if (!otherUserId) return false; 
    if (primaryBots.some(bot => bot.id === otherUserId)) return false; 
    const otherUser = dmUsers[otherUserId]; 
    return otherUser && otherUser.isBot; 
  }), [directMessages, dmUsers, primaryBots, currentUser.uid]);
  
  const userDirectMessages = useMemo(() => directMessages.filter(chat => { 
    const otherUserId = chat.members.find(id => id !== currentUser.uid); 
    if (!otherUserId) return true; 
    if (primaryBots.some(bot => bot.id === otherUserId)) return false; 
    const otherUser = dmUsers[otherUserId]; 
    return !otherUser || !otherUser.isBot; 
  }), [directMessages, dmUsers, primaryBots, currentUser.uid]);

  useEffect(() => { 
    if (currentUser && currentUser.hasSetNickname === false && !editProfileInitiallyShown) { 
      setShowEditProfile(true); 
      setEditProfileInitiallyShown(true); 
    } 
  }, [currentUser, editProfileInitiallyShown]);
  
  useEffect(() => {
    const findBots = async () => { 
      if (!db) return; 
      setIsBotLoading(true); 
      try { 
        const botLinks = ['/B/Infinite', '/B/Veo']; 
        const botsFound: User[] = []; 
        for (const link of botLinks) { 
          const botLinkRef = doc(db, 'botLinks', encodeURIComponent(link)); 
          const botLinkSnap = await getDoc(botLinkRef); 
          if (botLinkSnap.exists()) { 
            const botId = botLinkSnap.data().botId; 
            const botUserRef = doc(db, 'users', botId); 
            const botUserSnap = await getDoc(botUserRef); 
            if (botUserSnap.exists()) { 
              botsFound.push({ id: botId, ...botUserSnap.data() } as User); 
            } 
          } 
        } 
        setPrimaryBots(botsFound); 
      } catch (error) { 
        console.error("Error finding bots:", error); 
      } finally { 
        setIsBotLoading(false); 
      } 
    };
    findBots();
  }, [db]);

  const groupDiscussions = useMemo(() => sortedChats.filter((chat) => chat.type === 'group' && chat.id !== 'GENERAL_CHAT'), [sortedChats]);
  const channels = useMemo(() => sortedChats.filter((chat) => chat.type === 'channel' || (chat as any).type === 'broadcast'), [sortedChats]);

  const handleSelect = useCallback((item: Chat) => { 
    const iconName = (item.icon === 'Drum' || item.name === 'Infinite') ? 'Bot' : item.icon as keyof typeof iconMap | undefined; 
    onSelect({ ...item, iconComponent: iconName ? iconMap[iconName] : undefined } as PopulatedChat); 
    setOpenMobile(false); 
  }, [onSelect, setOpenMobile]);

  const handleChatCreated = useCallback(async (chatId: string) => {
    if (!db) return;
    try {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
        handleSelect(chatData);
      }
    } catch (e) {
      console.error("Error opening new chat:", e);
    }
  }, [db, handleSelect]);

  const handleSelectSavedMessages = async () => { 
    if (!db || !currentUser.uid) return; 
    const chatId = currentUser.uid; 
    const chatRef = doc(db, 'chats', chatId); 
    try { 
      const chatSnap = await getDoc(chatRef); 
      let chatData: Chat; 
      if (!chatSnap.exists()) { 
        chatData = { id: chatId, type: 'dm', members: [currentUser.uid], icon: 'Bookmark' }; 
        await setDoc(chatRef, { type: 'dm', members: [currentUser.uid], icon: 'Bookmark', unreadCounts: { [currentUser.uid]: 0 } }); 
      } else { 
        chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat; 
      } 
      handleSelect(chatData); 
    } catch (error) { 
      console.error(error); 
    } 
  };
  
  const handleSelectGeneralChat = async () => { 
    if (!db || !currentUser.uid) return; 
    const chatId = 'GENERAL_CHAT'; 
    const chatRef = doc(db, 'chats', chatId); 
    try { 
      const chatSnap = await getDoc(chatRef); 
      let chatData: Chat; 
      if (!chatSnap.exists()) { 
        chatData = { id: chatId, type: 'group', name: 'General Chat', members: [currentUser.uid], icon: 'Globe' }; 
        await setDoc(chatRef, { type: 'group', name: 'General Chat', icon: 'Globe', members: [currentUser.uid], }); 
      } else { 
        chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat; 
        if (!chatData.members.includes(currentUser.uid)) { 
          await updateDoc(chatRef, { members: arrayUnion(currentUser.uid) }); 
          chatData.members.push(currentUser.uid); 
        } 
      } 
      handleSelect(chatData); 
    } catch (error) { 
      console.error(error); 
    } 
  };
  
  const handleSelectBot = async (bot: User) => { 
    if (!db || !currentUser.uid) return; 
    const chatId = [currentUser.uid, bot.id].sort().join('_'); 
    const chatRef = doc(db, 'chats', chatId); 
    try { 
      const chatSnap = await getDoc(chatRef); 
      let chatData: Chat; 
      if (!chatSnap.exists()) { 
        chatData = { id: chatId, type: 'dm', members: [currentUser.uid, bot.id], icon: 'Bot' }; 
        await setDoc(chatRef, { type: 'dm', members: [currentUser.uid, bot.id], icon: 'Bot', unreadCounts: { [currentUser.uid]: 0, [bot.id]: 0 } }); 
      } else { 
        chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat; 
      } 
      handleSelect(chatData); 
    } catch(error) { 
      console.error(error); 
    } 
  };
  
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
  
  return (
    <div className="flex flex-col h-full bg-sidebar">
      <SidebarHeader className="p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className={cn("text-xl font-bold font-headline transition-all", isOnline ? "text-primary" : "text-muted-foreground animate-pulse")}>
              {isOnline ? 'Infinite' : t('searching')}
            </h1>
          </div>
          <div className='flex items-center'>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearchDialog(true)}>
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewChat(true)}>
              <PlusCircle className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarBody className="px-2 flex-1 overflow-y-auto no-scrollbar">
        <StoriesBar currentUser={currentUser} />
        <HolidayBanner />
        <div className="py-1 space-y-0.5">
          {showFeed && (
            <Button variant="ghost" onClick={() => { onSelect('feed'); setOpenMobile(false); }} className={cn("w-full justify-start h-auto py-1.5 text-left", selectedId === 'feed' && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
              <div className="flex items-center gap-3 w-full">
                <Newspaper className="h-4 w-4 text-muted-foreground" />
                <p className="font-semibold text-sm">{t('feed_title')}</p>
              </div>
            </Button>
          )}
          <Button variant="ghost" onClick={handleSelectSavedMessages} className={cn("w-full justify-start h-auto py-1.5 text-left", selectedId === currentUser.uid && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
            <div className="flex items-center gap-3 w-full">
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold text-sm">{t('saved_messages')}</p>
            </div>
          </Button>
          <Button variant="ghost" onClick={handleSelectGeneralChat} className={cn("w-full justify-start h-auto py-1.5 text-left", selectedId === 'GENERAL_CHAT' && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
            <div className="flex items-center gap-3 w-full">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{t('general_chat')}</p>
              </div>
            </div>
          </Button>
          <Button variant="ghost" onClick={() => { onSelect('infvid'); setOpenMobile(false); }} className={cn("w-full justify-start h-auto py-1.5 text-left", selectedId === 'infvid' && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
            <div className="flex items-center gap-3 w-full">
              <InfVidIcon className="h-4 w-4" />
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{t('infvid_title')}</p>
                <Badge variant="secondary" className="h-3.5 px-1 text-[9px] leading-none">BETA</Badge>
              </div>
            </div>
          </Button>
          <Button variant="ghost" onClick={() => { onSelect('infgames'); setOpenMobile(false); }} className={cn("w-full justify-start h-auto py-1.5 text-left", selectedId === 'infgames' && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
            <div className="flex items-center gap-3 w-full">
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{t('infgames_title')}</p>
              </div>
            </div>
          </Button>
          <Button variant="ghost" onClick={() => { onSelect('bot_studio'); setOpenMobile(false); }} className={cn("w-full justify-start h-auto py-1.5 text-left", selectedId === 'bot_studio' && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
            <div className="flex items-center gap-3 w-full">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{t('bot_studio_title')}</p>
              </div>
            </div>
          </Button>
        </div>
        
        {chatsLoading ? (
          <div className='p-4 text-xs'>{t('loading_chats')}</div>
        ) : (
          <Accordion type="multiple" defaultValue={['bots', 'direct-messages', 'groups', 'channels']} className="w-full">
            <AccordionItem value="bots" className="border-none">
              <AccordionTrigger className="hover:no-underline text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 py-2 px-4 h-auto">
                {t('bots')}
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <div className="space-y-0.5">
                  {isBotLoading ? (
                    <DMChatItemSkeleton />
                  ) : primaryBots.length > 0 ? (
                    primaryBots.map(bot => { 
                      const botChatId = [currentUser.uid, bot.id].sort().join('_'); 
                      const botChat = chats?.find(c => c.id === botChatId); 
                      return (
                        <DMChatItemComponent 
                          key={bot.id} 
                          item={botChat || { id: botChatId, type: 'dm', members: [currentUser.uid, bot.id] } as Chat} 
                          otherUser={bot} 
                          onSelect={() => handleSelectBot(bot)} 
                          selectedId={selectedId} 
                          currentUserId={currentUser.uid!} 
                        />
                      ); 
                    })
                  ) : (
                    <div className='px-4 text-[10px] text-muted-foreground'>{t('no_bots_found')}</div>
                  )}
                  {dmUsersLoading ? null : (otherBotMessages.length > 0 && <Separator className="my-1 mx-4" />)}
                  {dmUsersLoading ? (otherBotMessages.length > 0 && <DMChatItemSkeleton />) : otherBotMessages.length > 0 ? (
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
                          currentUserId={currentUser.uid!} 
                        />
                      ); 
                    })
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="direct-messages" className="border-none">
              <AccordionTrigger className="hover:no-underline text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 py-2 px-4 h-auto">
                {t('direct_messages')}
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <div className="space-y-0.5">
                  {dmUsersLoading ? (
                    <><DMChatItemSkeleton /><DMChatItemSkeleton /></>
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
                        currentUserId={currentUser.uid!} 
                      />
                    ); 
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="groups" className="border-none">
              <AccordionTrigger className="hover:no-underline text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 py-2 px-4 h-auto">
                {t('groups')}
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <div className="space-y-0.5">
                  {groupDiscussions.map((chat) => (
                    <ChatItemComponent 
                      key={chat.id} 
                      item={chat} 
                      onSelect={handleSelect} 
                      selectedId={selectedId} 
                      currentUserId={currentUser.uid!} 
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="channels" className="border-none">
              <AccordionTrigger className="hover:no-underline text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 py-2 px-4 h-auto">
                {t('channels')}
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <div className="space-y-0.5">
                  {channels.map((channel) => (
                    <ChatItemComponent 
                      key={channel.id} 
                      item={channel} 
                      onSelect={handleSelect} 
                      selectedId={selectedId} 
                      currentUserId={currentUser.uid!} 
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </SidebarBody>
      
      <Separator className="shrink-0" />
      
      <SidebarFooter className={cn("p-3 flex flex-col items-center shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] relative z-[100] border-t transition-all", (experimentalDesign || glassEffect) ? "bg-sidebar/40 backdrop-blur-3xl m-2 rounded-[2.5rem] border-white/20 shadow-2xl" : "bg-sidebar")}>
        <div className={cn("flex w-full gap-2 items-center", (experimentalDesign || glassEffect) ? "flex-col" : "flex-row")}>
          <Popover open={showUserProfilePopover} onOpenChange={setShowUserProfilePopover}>
            <PopoverTrigger asChild>
              <button className={cn("flex-1 truncate p-3 rounded-2xl hover:bg-sidebar-accent/50 transition-all", (experimentalDesign || glassEffect) ? "experimental-glow flex flex-col items-center gap-3 text-center w-full py-4" : "bg-sidebar-background border border-border/50 shadow-sm flex items-center gap-2 text-left")}>
                {currentUser.uid && currentUser.name && (
                  <div className="relative">
                    <UserAvatarWithStatus user={currentUser as any} className={cn("shrink-0", (experimentalDesign || glassEffect) ? "h-16 w-16" : "h-9 w-9")} />
                    {currentUser.activeGiftEmoji && (
                      <div className="absolute -bottom-1 -right-1 bg-background rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-sm border border-primary/20">
                        {currentUser.activeGiftEmoji}
                      </div>
                    )}
                  </div>
                )}
                <div className={cn("truncate", (experimentalDesign || glassEffect) ? "w-full space-y-1" : "flex-1")}>
                  <p className={cn("font-bold truncate", (experimentalDesign || glassEffect) ? "text-base" : "text-sm leading-tight")}>
                    {currentUser.isDeleted ? t('deleted_account') : (currentUser.name || currentUser.email)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-black truncate">
                    {currentUser.isDeleted ? '' : t(currentUser.status as any || 'online')}
                  </p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className={cn("w-80 mb-2 p-0 overflow-hidden max-h-[85vh] border-none shadow-2xl rounded-xl")}>
              <UserProfileCard user={currentUser} onEditProfile={() => { setShowUserProfilePopover(false); setShowEditProfile(true); }} />
            </PopoverContent>
          </Popover>
          
          <div className={cn("flex gap-1 shrink-0", (experimentalDesign || glassEffect) ? "flex-row w-full justify-center gap-2" : "flex-col")}>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className={cn("h-8 w-8", (experimentalDesign || glassEffect) && "glass-circle rounded-2xl h-12 w-12")}>
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSettingsDialog(true)} className={cn("relative h-8 w-8", (experimentalDesign || glassEffect) && "glass-circle rounded-2xl h-12 w-12")}>
              <div className="relative">
                <Cog className="h-5 w-5" />
                {isUpdateAvailable && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 rounded-full bg-orange-500 ring-2 ring-background animate-pulse" />
                )}
              </div>
            </Button>
          </div>
        </div>
      </SidebarFooter>
      
      <EditProfileDialog user={currentUser} open={showEditProfile} onOpenChange={setShowEditProfile} />
      <NewChatDialog currentUser={currentUser} open={showNewChat} onOpenChange={setShowNewChat} onChatCreated={handleChatCreated} />
      <SearchDialog currentUser={currentUser} open={showSearchDialog} onOpenChange={setShowSearchDialog} onChatSelected={handleSelect} />
      <ExperimentalSettingsDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog} currentUser={currentUser} />
    </div>
  );
}

function DMChatItemSkeleton() { 
  return (
    <div className={cn(buttonVariants({variant: "ghost"}), "w-full justify-start h-auto py-2 text-left pointer-events-none")}>
      <div className="flex items-center gap-3 w-full">
        <Skeleton className='w-9 h-9 rounded-full' />
        <div className="flex-1 truncate space-y-2">
          <Skeleton className='h-3.5 w-3/4' />
          <Skeleton className='h-2.5 w-1/2' />
        </div>
      </div>
    </div>
  ); 
}

const DMChatItemComponent = React.memo(({ item, otherUser, onSelect, selectedId, currentUserId }: { item: Chat, otherUser: User, onSelect: (item: Chat) => void, selectedId?: string, currentUserId: string }) => {
  const { t } = useLanguage(); 
  const isSavedMessages = otherUser?.id === currentUserId; 
  const unreadCount = item.unreadCounts?.[currentUserId] || 0; 
  const isSelected = selectedId === item.id;
  const isVerified = !isSavedMessages && (otherUser.username === '@Infinite' || otherUser.username === '@InfiniteBot' || otherUser.username === '@VeoBot' || otherUser.username === '@GeminiBot');
  const isPrem = !isSavedMessages && otherUser.subscriptionTier === 'prem' && otherUser.showPremBadge;
  const isBetaTester = !isSavedMessages && otherUser.isBetaTester;
  const displayName = isSavedMessages ? t('saved_messages') : (otherUser.isDeleted ? t('deleted_account') : otherUser.name);
  const isOfficialBot = otherUser?.username === '@InfiniteBot' || item.link === '/B/Infinite' || otherUser?.username === '@Infinite';
  const showBadge = unreadCount > 0 && !isOfficialBot;
  const lastMessage = item.lastMessage; 
  const lastMessageSenderIsCurrentUser = lastMessage?.senderId === currentUserId; 
  const otherUserIdInDM = item.members.find(id => id !== currentUserId);
  const isRead = useMemo(() => { 
    if (!lastMessage || !lastMessageSenderIsCurrentUser || !lastMessage.readBy) return false; 
    if (item.type === 'dm' && otherUserIdInDM) return lastMessage.readBy.includes(otherUserIdInDM); 
    return false; 
  }, [lastMessage, lastMessageSenderIsCurrentUser, item.type, otherUserIdInDM]);
  
  const { icon: AttachmentIcon, text: attachmentText } = useMemo(() => { 
    if (lastMessage?.imageUrl) return { icon: <ImageIcon className="h-3 w-3 shrink-0" />, text: t('photo') }; 
    if (lastMessage?.videoMimeType) return { icon: <VideoIcon className="h-3 w-3 shrink-0" />, text: t('video') }; 
    if (lastMessage?.musicMimeType) return { icon: <MusicIcon className="h-3 w-3 shrink-0" />, text: t('music') }; 
    if (lastMessage?.voiceStatus) return { icon: <Mic className="h-3 w-3 shrink-0" />, text: t('voice_message_short') }; 
    if (lastMessage?.fileStatus) return { icon: <FileIcon className="h-3 w-3 shrink-0" />, text: t('file') }; 
    if (lastMessage?.poll) return { icon: <ListTodo className="h-3 w-3 shrink-0" />, text: t('poll') }; 
    return { icon: null, text: '' }; 
  }, [lastMessage, t]);
  
  const displayContent = lastMessage?.content || attachmentText;
  
  return (
    <Button key={item.id} variant="ghost" onClick={() => onSelect(item)} className={cn("relative w-full justify-start h-auto py-1.5 text-left overflow-hidden transition-all", isSelected && 'bg-sidebar-accent')}>
      <div className="flex items-center gap-3 w-full">
        <div className="relative">
          <UserAvatarWithStatus user={otherUser} isSavedMessages={isSavedMessages} isSelected={isSelected} className="h-9 w-9" />
          {!isSavedMessages && otherUser.activeGiftEmoji && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full w-4 h-4 flex items-center justify-center text-[8px] shadow-sm border border-primary/20">
              {otherUser.activeGiftEmoji}
            </div>
          )}
        </div>
        <div className="flex-1 w-0 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <div className={cn("font-semibold truncate text-sm", isSelected && "text-sidebar-accent-foreground")}>
              {displayName}
            </div>
            {!isSavedMessages && (
              <>
                {isVerified && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
                {isPrem && <PremBadge className="w-3.5 h-3.5 shrink-0" />}
                {isBetaTester && <BetaBadge className="w-3.5 h-3.5 shrink-0" />}
              </>
            )}
          </div>
          {displayContent && (
            <div className={cn("text-[11px] truncate flex items-center gap-1", isSelected ? "text-sidebar-accent-foreground/80" : "text-muted-foreground")}>
              {lastMessageSenderIsCurrentUser && !isSavedMessages && (
                (lastMessage.videoStatus === 'uploading' || lastMessage.musicStatus === 'uploading') ? (
                  <Clock className="h-2.5 w-2.5 shrink-0" />
                ) : (
                  isRead ? <CheckCheck className="h-3 w-3 shrink-0" /> : <Check className="h-2.5 w-2.5 shrink-0" />
                )
              )}
              {AttachmentIcon}
              <div className="truncate flex-1 overflow-hidden">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <span className="inline truncate">{children}</span>, a: ({children}) => <span>{children}</span>, span: ({children}) => <span>{children}</span> }}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
      {showBadge && (<Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary h-4 min-w-4 px-1 text-[9px]">{unreadCount}</Badge>)}
    </Button>
  );
});
DMChatItemComponent.displayName = 'DMChatItemComponent';

const ChatItemComponent = React.memo(({ item, onSelect, selectedId, currentUserId }: { item: Chat, onSelect: (item: Chat) => void, selectedId?: string, currentUserId: string }) => {
  const { t } = useLanguage(); 
  const lastMessage = item.lastMessage; 
  const isGeneralChat = item.id === 'GENERAL_CHAT'; 
  const Icon = isGeneralChat ? Globe : (item.icon === 'Drum' || item.name === 'Infinite') ? Bot : (item.icon ? iconMap[item.icon as keyof typeof iconMap] : (item.type === 'group' ? Users : Megaphone));
  const unreadCount = item.unreadCounts?.[currentUserId] || 0; 
  const isSelected = selectedId === item.id; 
  const senderIsCurrentUser = lastMessage?.senderId === currentUserId;
  const isOfficialBot = item.link === '/B/Infinite' || item.name === 'Infinite'; 
  const showBadge = unreadCount > 0 && !isOfficialBot;
  
  const isRead = useMemo(() => { 
    if (!lastMessage || !senderIsCurrentUser || !lastMessage.readBy) return false; 
    if (item.type === 'group') return lastMessage.readBy.some(id => id !== currentUserId); 
    return false; 
  }, [lastMessage, senderIsCurrentUser, item.type, currentUserId]);
  
  const { icon: AttachmentIcon, text: attachmentText } = useMemo(() => { 
    if (lastMessage?.imageUrl) return { icon: <ImageIcon className="h-3 w-3 shrink-0" />, text: t('photo') }; 
    if (lastMessage?.videoMimeType) return { icon: <VideoIcon className="h-3 w-3 shrink-0" />, text: t('video') }; 
    if (lastMessage?.musicMimeType) return { icon: <MusicIcon className="h-3 w-3 shrink-0" />, text: t('music') }; 
    if (lastMessage?.voiceStatus) return { icon: <Mic className="h-3 w-3 shrink-0" />, text: t('voice_message_short') }; 
    if (lastMessage?.fileStatus) return { icon: <FileIcon className="h-3 w-3 shrink-0" />, text: t('file') }; 
    if (lastMessage?.poll) return { icon: <ListTodo className="h-3 w-3 shrink-0" />, text: t('poll') }; 
    return { icon: null, text: '' }; 
  }, [lastMessage, t]);
  
  const displayContent = lastMessage?.content || attachmentText;
  let senderPrefix = ''; 
  if (item.type === 'group' && lastMessage && !senderIsCurrentUser) {
    if (lastMessage.senderName) senderPrefix = `${lastMessage.senderName}: `;
  }
  
  return (
    <Button variant="ghost" onClick={() => onSelect(item)} className={cn("relative w-full justify-start h-auto py-1.5 text-left overflow-hidden transition-all", isSelected && 'bg-sidebar-accent')}>
      <div className="flex items-center gap-3 w-full">
        <Avatar className="h-9 w-9 shrink-0">
          {item.avatar ? (
            <AvatarImage src={item.avatar} alt={item.name} />
          ) : (
            <AvatarFallback className={cn(isSelected && "bg-sidebar-primary text-sidebar-primary-foreground")}>
              {Icon ? <Icon className="h-4 w-4" /> : <Megaphone className="h-4 w-4 text-muted-foreground" />}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1 w-0 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <div className={cn("font-semibold truncate text-sm", isSelected ? "text-sidebar-accent-foreground" : "")}>
              {item.name}
            </div>
            {(item.link === '/G/Infinite' || item.link === '/C/Infinite') && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
          </div>
          {displayContent && (
            <div className={cn("text-[11px] truncate flex items-center gap-1", isSelected ? "text-sidebar-accent-foreground/80" : "text-muted-foreground")}>
              {senderIsCurrentUser ? (
                (lastMessage?.videoStatus === 'uploading' || lastMessage?.musicStatus === 'uploading') ? (
                  <Clock className="h-2.5 w-2.5 shrink-0" />
                ) : (
                  isRead ? <CheckCheck className="h-3 w-3 shrink-0" /> : <Check className="h-2.5 w-2.5 shrink-0" />
                )
              ) : null}
              {AttachmentIcon}
              <div className="truncate flex-1 overflow-hidden">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <span className="inline truncate">{senderPrefix}{children}</span>, a: ({children}) => <span>{children}</span>, span: ({children}) => <span>{children}</span> }}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
      {showBadge && (<Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary h-4 min-w-4 px-1 text-[9px]">{unreadCount}</Badge>)}
    </Button>
  );
});
ChatItemComponent.displayName = 'ChatItemComponent';
