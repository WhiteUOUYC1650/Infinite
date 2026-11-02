'use client';

/**
 * Material 3 conversations screen — independent from the classic 1.5 sidebar.
 */

import React, { useMemo, useState } from 'react';
import { collection, doc, getDoc, query, where } from 'firebase/firestore';
import {
  Bookmark,
  Cpu,
  Gamepad2,
  Globe,
  Music4,
  Newspaper,
  Plus,
  Search,
  Settings2,
  Video,
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser, Chat } from '@/types';
import { NewChatDialog } from '@/components/new-chat-dialog';
import { SearchDialog } from '@/components/search-dialog';
import { M3ChatRow } from './m3-chat-row';
import { M3Avatar, M3SearchBar, M3SectionLabel } from './m3-surfaces';
import { M3Chip, M3Fab, M3IconButton, M3TopAppBar } from './m3-primitives';

export type M3Service = 'infvid' | 'infmusic' | 'infgames' | 'bot_studio' | 'feed';

type Filter = 'all' | 'dm' | 'group' | 'channel';

export function M3ChatList({
  currentUser,
  selectedId,
  isOnline = true,
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
    <div className="relative flex h-full min-h-0 flex-col">
      <M3TopAppBar
        title={
          <span className="flex items-center gap-2">
            Infinite
            <span
              className={
                isOnline
                  ? 'h-2 w-2 rounded-full bg-emerald-500'
                  : 'h-2 w-2 rounded-full bg-muted-foreground/50'
              }
            />
          </span>
        }
        subtitle={isOnline ? t('online') : t('connecting')}
        avatar={
          <button type="button" onClick={onOpenSettings} aria-label={t('settings')} className="rounded-full">
            <M3Avatar name={currentUser.name} src={currentUser.avatar} size={40} />
          </button>
        }
        trailing={
          <>
            <M3IconButton icon={Search} label={t('search_placeholder')} onClick={() => setSearchOpen(true)} />
            <M3IconButton icon={Settings2} label={t('settings')} onClick={onOpenSettings} />
          </>
        }
      >
        <M3SearchBar value={queryText} onChange={setQueryText} placeholder={t('search_placeholder')} />
      </M3TopAppBar>

      <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-3 pb-2">
        {filters.map((item) => (
          <M3Chip
            key={item.id}
            label={item.label}
            active={filter === item.id}
            onClick={() => setFilter(item.id)}
          />
        ))}
      </div>

      <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-3 pb-3">
        <M3Chip label={t('saved_messages')} icon={Bookmark} onClick={onSelectSaved} />
        <M3Chip label={t('general_chat')} icon={Globe} onClick={onSelectGeneral} />
        {services.map((service) => (
          <M3Chip
            key={service.id}
            label={service.label}
            icon={service.icon}
            onClick={() => onSelectService(service.id)}
          />
        ))}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-24">
        <M3SectionLabel className="px-2 pb-1 pt-1">{t('chats_label')}</M3SectionLabel>
        <div className="space-y-0.5">
          {loading ? (
            <div className="space-y-2 px-1 pt-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="h-[52px] w-[52px] animate-pulse rounded-full bg-muted" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                    <span className="block h-2.5 w-1/2 animate-pulse rounded-full bg-muted" />
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
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('no_chats_yet')}</p>
          )}
        </div>
      </div>

      <M3Fab
        icon={Plus}
        label={t('new_conversation')}
        onClick={() => setNewChatOpen(true)}
        className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4"
      />

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
