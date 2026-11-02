'use client';

/**
 * Material 3 conversations screen — independent from the classic 1.5 sidebar.
 *
 * Layout follows the Infinite 3.0 Material 3 mock-up:
 *   top app bar (avatar · title · search/settings)
 *   search field
 *   filter chips (All / DMs / Groups / Channels)
 *   assist chips (Saved messages / General chat)
 *   flat conversation list
 *   FAB (new chat) + navigation bar (Chats / Services / Feed / Settings)
 */

import React, { useMemo, useState } from 'react';
import { doc, getDoc, query, collection, where } from 'firebase/firestore';
import {
  Bookmark,
  Cpu,
  Gamepad2,
  Globe,
  MessageSquare,
  Music4,
  Newspaper,
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
import { M3ChatRow } from './m3-chat-row';
import { M3Avatar, M3RowItem, M3SearchBar } from './m3-surfaces';
import {
  M3Chip,
  M3Fab,
  M3IconButton,
  M3NavItem,
  M3NavigationBar,
  M3TopAppBar,
} from './m3-primitives';

export type M3Service = 'infvid' | 'infmusic' | 'infgames' | 'bot_studio' | 'feed';

type Filter = 'all' | 'dm' | 'group' | 'channel';

export function M3ChatList({
  currentUser,
  selectedId,
  onSelectChat,
  onSelectService,
  onSelectSaved,
  onSelectGeneral,
  onOpenSettings,
}: {
  currentUser: AuthenticatedUser;
  selectedId?: string;
  isOnline?: boolean;
  onSelectChat: (chat: Chat) => void;
  onSelectService: (service: M3Service) => void;
  onSelectSaved: () => void;
  onSelectGeneral: () => void;
  onOpenSettings: () => void;
}) {
  const db = useFirestore();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('all');
  const [queryText, setQueryText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

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

  const visibleChats = useMemo(() => {
    const needle = queryText.trim().toLowerCase();
    return (chats || [])
      .filter((chat) => !archived.has(chat.id))
      .filter((chat) => (filter === 'all' ? true : chat.type === filter))
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

  const unreadTotal = useMemo(
    () =>
      visibleChats.reduce((sum, chat) => sum + (chat.unreadCounts?.[currentUser.uid] || 0), 0),
    [visibleChats, currentUser.uid]
  );

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t('all_chats') },
    { id: 'dm', label: t('direct_messages') },
    { id: 'group', label: t('groups') },
    { id: 'channel', label: t('channels') },
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
      <M3TopAppBar
        leading={
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t('settings')}
            className="ml-1 mr-1 shrink-0 rounded-full"
          >
            <M3Avatar name={currentUser.name} src={currentUser.avatar} size={36} />
          </button>
        }
        title="Infinite"
        trailing={
          <>
            <M3IconButton icon={Search} label={t('search_placeholder')} onClick={() => setSearchOpen(true)} />
            <M3IconButton icon={Settings2} label={t('settings')} onClick={onOpenSettings} />
          </>
        }
      >
        <M3SearchBar
          className="mt-1"
          value={queryText}
          onChange={setQueryText}
          placeholder={t('search_placeholder')}
        />
      </M3TopAppBar>

      <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 pb-2 pt-1">
        {filters.map((item) => (
          <M3Chip
            key={item.id}
            label={item.label}
            active={filter === item.id}
            onClick={() => setFilter(item.id)}
          />
        ))}
      </div>

      <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 pb-2">
        <M3Chip label={t('saved_messages')} icon={Bookmark} onClick={onSelectSaved} />
        <M3Chip label={t('general_chat')} icon={Globe} onClick={onSelectGeneral} />
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-28">
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
        ) : visibleChats.length ? (
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
          <p className="px-6 py-12 text-center text-sm text-m3-on-surface-variant">
            {t('no_chats_yet')}
          </p>
        )}
      </div>

      <M3Fab
        icon={Plus}
        label={t('new_conversation')}
        onClick={() => setNewChatOpen(true)}
        className="absolute bottom-[calc(96px+env(safe-area-inset-bottom))] right-4"
      />

      <M3NavigationBar>
        <M3NavItem icon={MessageSquare} label={t('chats_label')} active badge={unreadTotal} />
        <M3NavItem icon={Sparkles} label={t('services')} onClick={() => setServicesOpen(true)} />
        <M3NavItem icon={Newspaper} label={t('feed_title')} onClick={() => onSelectService('feed')} />
        <M3NavItem icon={Settings2} label={t('settings')} onClick={onOpenSettings} />
      </M3NavigationBar>

      <Sheet open={servicesOpen} onOpenChange={setServicesOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[28px] border-0 bg-m3-surface-container-high px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2"
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
          <div className="mx-4 mt-1 border-t border-m3-outline-variant pt-1">
            <M3RowItem
              icon={Bookmark}
              label={t('saved_messages')}
              onClick={() => {
                setServicesOpen(false);
                onSelectSaved();
              }}
            />
            <M3RowItem
              icon={Globe}
              label={t('general_chat')}
              onClick={() => {
                setServicesOpen(false);
                onSelectGeneral();
              }}
            />
          </div>
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
