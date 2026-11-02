'use client';

/**
 * Material 3 application shell (Material 3 edition only).
 *
 * Renders the independent M3 navigation (conversation list + navigation bar)
 * next to the content pane. The classic Infinite 1.5 shell
 * (src/components/app-shell.tsx) is not used for this edition and is left
 * untouched.
 */

import React from 'react';
import { MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser, Chat } from '@/types';
import { M3ChatList, type M3Service } from './m3-chat-list';
import { M3EmptyState } from './m3-surfaces';
import './m3-theme.css';

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

  const showList = !isMobile || !hasContent;

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
          <M3ChatList
            currentUser={currentUser}
            selectedId={selectedId}
            isOnline={isOnline}
            onSelectChat={onSelectChat}
            onSelectService={onSelectService}
            onSelectSaved={onSelectSaved}
            onSelectGeneral={onSelectGeneral}
            onOpenSettings={onOpenSettings}
          />
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
