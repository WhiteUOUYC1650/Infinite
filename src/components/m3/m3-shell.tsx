'use client';

/**
 * Material 3 application shell (Material 3 edition only).
 *
 * Owns the bottom-navigation state so the navigation bar never disappears:
 *   Chats    → conversation list
 *   Search   → global search screen (screen version of SearchDialog)
 *   Settings → settings screen (screen version of the settings dialog)
 * Opening a chat replaces the whole pane on mobile, as before.
 */

import React, { useEffect, useState } from 'react';
import { MessagesSquare, Search, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser, Chat } from '@/types';
import { M3ChatList, type M3Service } from './m3-chat-list';
import { M3SearchScreen } from './m3-search-screen';
import { M3SettingsScreen } from './m3-settings-screen';
import { M3EmptyState } from './m3-surfaces';
import { M3NavItem, M3NavigationBar } from './m3-primitives';
import './m3-theme.css';

type M3Tab = 'chats' | 'search' | 'settings';

export function M3Shell({
  currentUser,
  selectedId,
  hasContent,
  isOnline,
  children,
  onSelectChat,
  onSelectService,
  onSelectSaved,
  onSelectGeneral,
  onOpenSettings,
}: {
  currentUser: AuthenticatedUser;
  selectedId?: string;
  hasContent: boolean;
  isOnline?: boolean;
  children: React.ReactNode;
  onSelectChat: (chat: Chat) => void;
  onSelectService: (service: M3Service) => void;
  onSelectSaved: () => void;
  onSelectGeneral: () => void;
  onOpenSettings: () => void;
}) {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const [tab, setTab] = useState<M3Tab>('chats');
  const [unreadTotal, setUnreadTotal] = useState(0);

  const showList = !isMobile || !hasContent;

  /*
   * Safety net for Radix modals: while any dialog/sheet is open it sets
   * `pointer-events: none` on <body>. If the screen changes during the exit
   * animation the lock can survive, and the UI stops reacting to taps.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = window.setTimeout(() => {
      const openModal = document.querySelector('[role="dialog"][data-state="open"]');
      if (!openModal) document.body.style.pointerEvents = '';
    }, 320);
    return () => window.clearTimeout(id);
  }, [tab, hasContent]);

  return (
    <div className="flex h-svh w-full overflow-hidden bg-m3-surface">
      {showList && (
        <aside
          className={cn(
            'flex h-full min-h-0 flex-col',
            isMobile
              ? 'w-full'
              : 'w-[360px] shrink-0 border-r border-m3-outline-variant'
          )}
        >
          <div className="relative min-h-0 flex-1">
            {tab === 'chats' && (
              <M3ChatList
                currentUser={currentUser}
                selectedId={selectedId}
                isOnline={isOnline}
                onSelectChat={onSelectChat}
                onSelectService={onSelectService}
                onSelectSaved={onSelectSaved}
                onSelectGeneral={onSelectGeneral}
                onOpenSettings={onOpenSettings}
                onUnreadChange={setUnreadTotal}
              />
            )}
            {tab === 'search' && (
              <M3SearchScreen currentUser={currentUser} onSelectChat={onSelectChat} />
            )}
            {tab === 'settings' && (
              <M3SettingsScreen currentUser={currentUser} onOpenSettings={onOpenSettings} />
            )}
          </div>

          <M3NavigationBar>
            <M3NavItem
              icon={MessagesSquare}
              label={t('chats_label')}
              active={tab === 'chats'}
              badge={unreadTotal}
              onClick={() => setTab('chats')}
            />
            <M3NavItem
              icon={Search}
              label={t('search_button')}
              active={tab === 'search'}
              onClick={() => setTab('search')}
            />
            <M3NavItem
              icon={Settings2}
              label={t('settings')}
              active={tab === 'settings'}
              onClick={() => setTab('settings')}
            />
          </M3NavigationBar>
        </aside>
      )}

      {(!isMobile || hasContent) && (
        <main className="relative min-h-0 min-w-0 flex-1 bg-m3-surface">
          {hasContent ? (
            children
          ) : (
            <M3EmptyState
              icon={MessagesSquare}
              title={t('chat_not_selected')}
              description={t('app_tagline')}
            />
          )}
        </main>
      )}
    </div>
  );
}
