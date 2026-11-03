'use client';

/**
 * Material 3 conversations screen — independent from the classic 1.5 sidebar.
 *
 * Layout follows the Infinite 3.0 Material 3 mock-up:
 *   large app bar ("Infinite" + tagline + overflow menu)
 *   search field
 *   filter chips (All / DMs / Groups / Channels / Bots), text chips
 *   list: Saved messages, General chat, then the conversations
 *   16dp FAB (compose) + 3-destination navigation bar
 *   hamburger in the app bar opens the navigation drawer
 */

import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, query, collection, where } from 'firebase/firestore';
import {
  Bookmark,
  Cpu,
  Gamepad2,
  Globe,
  Menu,
  Music4,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Video,
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser, Chat } from '@/types';
import { NewChatDialog } from '@/components/new-chat-dialog';
import { SearchDialog } from '@/components/search-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { M3ChatRow, M3IconRow } from './m3-chat-row';
import { M3Avatar, M3RowItem, M3SearchBar } from './m3-surfaces';
import { M3Chip, M3Fab } from './m3-primitives';

export type M3Service = 'infvid' | 'infmusic' | 'infgames' | 'bot_studio' | 'feed';

type Filter = 'all' | 'dm' | 'group' | 'channel' | 'bots';

export function M3ChatList({
  currentUser,
  selectedId,
  onSelectChat,
  onSelectService,
  onSelectSaved,
  onSelectGeneral,
  onOpenSettings,
  onUnreadChange,
}: {
  currentUser: AuthenticatedUser;
  selectedId?: string;
  isOnline?: boolean;
  onSelectChat: (chat: Chat) => void;
  onSelectService: (service: M3Service) => void;
  onSelectSaved: () => void;
  onSelectGeneral: () => void;
  onOpenSettings: () => void;
  /** Lets the shell show the unread badge on the "Chats" navigation item. */
  onUnreadChange?: (total: number) => void;
}) {
  const db = useFirestore();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('all');
  const [queryText, setQueryText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const chatsQuery = useMemo(() => {
    if (!db || !currentUser.uid) return null;
    return query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid));
  }, [db, currentUser.uid]);

  const { data: chats, loading } = useCollection<Chat>(chatsQuery as any);

  const dmOtherIds = useMemo(
    () =>
      (chats || [])
        .filter((chat) => chat.type === 'dm')
        .map((chat) => chat.members.find((id) => id !== currentUser.uid))
        .filter(Boolean) as string[],
    [chats, currentUser.uid]
  );
  const { users: dmUsers } = useBatchUsers(dmOtherIds);

  const archived = useMemo(
    () => new Set(currentUser.archivedChats || []),
    [currentUser.archivedChats]
  );

  /** The other participant of a DM (bots included — they are DM chats too). */
  const otherOf = (chat: Chat) =>
    chat.type === 'dm'
      ? dmUsers[chat.members.find((member) => member !== currentUser.uid) || ''] || null
      : null;

  const isBotChat = (chat: Chat) => {
    if (chat.type !== 'dm') return false;
    const other = otherOf(chat);
    return !!(other?.isBot || other?.isCustomBot);
  };

  const visibleChats = useMemo(() => {
    const needle = queryText.trim().toLowerCase();
    return (chats || [])
      .filter((chat) => !archived.has(chat.id))
      // bots live in their own folder, never in "Direct messages"
      .filter((chat) => {
        if (filter === 'all') return true;
        if (filter === 'bots') return isBotChat(chat);
        if (filter === 'dm') return chat.type === 'dm' && !isBotChat(chat);
        return chat.type === filter;
      })
      .filter((chat) => {
        if (!needle) return true;
        const other =
          chat.type === 'dm' ? dmUsers[chat.members.find((m) => m !== currentUser.uid) || ''] : null;
        const haystack = `${chat.name || ''} ${other?.name || ''} ${other?.username || ''}`.toLowerCase();
        return haystack.includes(needle);
      })
      .sort(
        (a, b) =>
          (b.lastMessage?.timestamp?.toMillis?.() || 0) - (a.lastMessage?.timestamp?.toMillis?.() || 0)
      );
  }, [chats, archived, filter, queryText, dmUsers, currentUser.uid]);

  const generalChat = useMemo(
    () => (chats || []).find((chat) => chat.id === 'GENERAL_CHAT' || chat.link === '/G/Infinite'),
    [chats]
  );
  const generalUnread = generalChat?.unreadCounts?.[currentUser.uid] || 0;

  const unreadTotal = useMemo(
    () =>
      visibleChats.reduce((sum, chat) => sum + (chat.unreadCounts?.[currentUser.uid] || 0), 0),
    [visibleChats, currentUser.uid]
  );

  useEffect(() => {
    onUnreadChange?.(unreadTotal);
  }, [unreadTotal, onUnreadChange]);

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t('all_chats') },
    { id: 'dm', label: t('direct_messages') },
    { id: 'group', label: t('groups') },
    { id: 'channel', label: t('channels') },
    { id: 'bots', label: t('bots') },
  ];

  const services: { id: M3Service; label: string; icon: React.ElementType }[] = [
    { id: 'infvid', label: 'InfVid', icon: Video },
    { id: 'infmusic', label: 'InfMusic', icon: Music4 },
    { id: 'infgames', label: 'InfGames', icon: Gamepad2 },
    { id: 'bot_studio', label: 'Bot Studio', icon: Cpu },
    { id: 'feed', label: t('feed_title'), icon: Newspaper },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-m3-surface">
      <header className="sticky top-0 z-30 flex flex-col gap-1 bg-m3-surface pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <div className="flex items-start gap-1 pr-2">
          <div className="min-w-0 flex-1 pt-1">
            <span className="m3-app-bar-title-large truncate">Infinite</span>
            <span className="m3-app-bar-tagline truncate">3.0 / Redesign</span>
          </div>
          <button
            type="button"
            aria-label={t('more')}
            onClick={() => setMenuOpen(true)}
            className="m3-icon-button mt-1 text-m3-on-surface"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <div className="px-2">
          <M3SearchBar
            value={queryText}
            onChange={setQueryText}
            placeholder={t('search_people_messages')}
          />
        </div>
      </header>

      <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-2 pb-1 pt-2">
        {filters.map((item) => (
          <M3Chip
            key={item.id}
            label={item.label}
            active={filter === item.id}
            onClick={() => setFilter(item.id)}
          />
        ))}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 pb-28">
        {loading ? (
          <div className="space-y-1 pt-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2.5">
                <span className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-m3-surface-container-high" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-2/3 animate-pulse rounded-full bg-m3-surface-container-high" />
                  <span className="block h-2.5 w-1/2 animate-pulse rounded-full bg-m3-surface-container-high" />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            <M3IconRow
              icon={Bookmark}
              label={t('saved_messages')}
              description={t('saved_messages_desc')}
              onClick={onSelectSaved}
            />
            <M3IconRow
              icon={Globe}
              label={t('general_chat')}
              description={generalChat?.lastMessage?.content || t('app_tagline')}
              badge={generalUnread}
              onClick={onSelectGeneral}
            />

            {visibleChats.length ? (
              visibleChats.map((chat) => (
                <M3ChatRow
                  key={chat.id}
                  chat={chat}
                  otherUser={
                    chat.type === 'dm'
                      ? dmUsers[chat.members.find((id) => id !== currentUser.uid) || ''] || null
                      : null
                  }
                  currentUserId={currentUser.uid}
                  isSelected={selectedId === chat.id}
                  savedMessagesLabel={t('saved_messages')}
                  yesterdayLabel={t('yesterday')}
                  onClick={() => onSelectChat(chat)}
                />
              ))
            ) : (
              <p className="px-6 py-10 text-center text-sm text-m3-on-surface-variant">
                {t('no_chats_yet')}
              </p>
            )}
          </div>
        )}
      </div>

      <M3Fab
        icon={Pencil}
        label={t('new_conversation')}
        onClick={() => setNewChatOpen(true)}
        className="absolute bottom-5 right-4"
      />

      {/* navigation drawer opened by the hamburger in the app bar */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          hideCloseButton
          className="w-[300px] max-w-[85vw] border-0 bg-m3-surface-container-low p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t('more')}</SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-3 px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
            <M3Avatar name={currentUser.name} src={currentUser.avatar} size={48} />
            <div className="min-w-0">
              <p className="truncate text-[15.5px] font-semibold text-m3-on-surface">
                {currentUser.name}
              </p>
              <p className="truncate text-[13px] text-m3-on-surface-variant">
                {currentUser.username}
              </p>
            </div>
          </div>

          <div className="px-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <M3RowItem
              plain
              icon={Plus}
              label={t('new_conversation')}
              onClick={() => {
                setMenuOpen(false);
                setNewChatOpen(true);
              }}
            />
            <M3RowItem
              plain
              icon={Search}
              label={t('search_button')}
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
            />
            <M3RowItem
              plain
              icon={Bookmark}
              label={t('saved_messages')}
              onClick={() => {
                setMenuOpen(false);
                onSelectSaved();
              }}
            />
            <M3RowItem
              plain
              icon={Globe}
              label={t('general_chat')}
              onClick={() => {
                setMenuOpen(false);
                onSelectGeneral();
              }}
            />
            <div className="my-1 ml-4 border-t border-m3-outline-variant" />
            <M3RowItem
              plain
              icon={Sparkles}
              label={t('services')}
              onClick={() => {
                setMenuOpen(false);
                setServicesOpen(true);
              }}
            />
            <M3RowItem
              plain
              icon={Settings2}
              label={t('settings')}
              onClick={() => {
                setMenuOpen(false);
                onOpenSettings();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={servicesOpen} onOpenChange={setServicesOpen}>
        <SheetContent
          side="bottom"
          hideCloseButton
          className="border-0 bg-m3-surface-container-high px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2"
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-m3-on-surface-variant/40" />
          <SheetHeader className="px-4 pb-1 text-left">
            <SheetTitle className="text-base font-medium text-m3-on-surface">
              {t('services')}
            </SheetTitle>
          </SheetHeader>
          {services.map((service) => (
            <M3RowItem
              key={service.id}
              icon={service.icon}
              label={service.label}
              onClick={() => {
                setServicesOpen(false);
                onSelectService(service.id);
              }}
            />
          ))}
        </SheetContent>
      </Sheet>

      <SearchDialog
        currentUser={currentUser}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onChatSelected={(chat) => {
          setSearchOpen(false);
          onSelectChat(chat);
        }}
      />
      <NewChatDialog
        currentUser={currentUser}
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onChatCreated={async (chatId: string) => {
          setNewChatOpen(false);
          if (!db) return;
          const snap = await getDoc(doc(db, 'chats', chatId));
          if (snap.exists()) onSelectChat({ id: snap.id, ...snap.data() } as Chat);
        }}
      />
    </div>
  );
}
