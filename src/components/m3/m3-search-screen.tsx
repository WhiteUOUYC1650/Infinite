'use client';

/**
 * Material 3 global search *screen* (the screen version of SearchDialog).
 *
 * Rendered in place of the conversation list while the bottom navigation is on
 * the "Search" tab, so the navigation bar stays visible. Both this screen and
 * the classic dialog share `runGlobalSearch` from src/lib/global-search.ts.
 */

import React, { useState } from 'react';
import { Gamepad2, Loader2, Megaphone, Search, Users } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import type { AuthenticatedUser, Chat } from '@/types';
import {
  ensureDmChat,
  joinChatIfNeeded,
  runGlobalSearch,
  type GlobalSearchResult,
} from '@/lib/global-search';
import { M3Avatar, M3EmptyState, M3SearchBar } from './m3-surfaces';

export function M3SearchScreen({
  currentUser,
  onSelectChat,
}: {
  currentUser: AuthenticatedUser;
  onSelectChat: (chat: Chat) => void;
}) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const submit = async () => {
    const queryText = value.trim();
    if (!db || queryText.length < 2) return;
    setLoading(true);
    try {
      setResults(await runGlobalSearch(db, queryText));
      setSearched(true);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong during search.',
      });
    } finally {
      setLoading(false);
    }
  };

  const openResult = async (result: GlobalSearchResult) => {
    if (!db) return;
    if (result.type === 'game') {
      window.dispatchEvent(new CustomEvent('open-infgames', { detail: { gameId: result.data.id } }));
      return;
    }
    if (result.type === 'user') {
      const { chatId, members } = await ensureDmChat(db, currentUser.uid, result.data.id);
      onSelectChat({ id: chatId, members, type: 'dm' } as Chat);
      return;
    }
    try {
      onSelectChat(await joinChatIfNeeded(db, result.data, currentUser.uid));
    } catch (error) {
      console.error('Error joining chat:', error);
    }
  };

  const titleOf = (result: GlobalSearchResult) =>
    result.type === 'user'
      ? result.data.name || result.data.username || '…'
      : result.data.name || '…';

  const descriptionOf = (result: GlobalSearchResult) => {
    if (result.type === 'user') {
      return `${result.data.username || ''}${result.data.isBot ? ` · ${t('bots')}` : ''}`;
    }
    if (result.type === 'chat') {
      return result.data.link || t(result.data.type === 'group' ? 'groups' : 'channels');
    }
    return t('infgames_title');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-m3-surface">
      <header className="flex flex-col gap-2 px-2 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <h1 className="m3-app-bar-title-large truncate">{t('search_dialog_title')}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex items-end gap-2"
        >
          <div className="min-w-0 flex-1">
            <M3SearchBar value={value} onChange={setValue} placeholder={t('search_placeholder')} />
          </div>
          <button
            type="button"
            aria-label={t('search_button')}
            onClick={() => void submit()}
            className="m3-fab h-14 w-14 shrink-0"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          </button>
        </form>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">
        {results.length ? (
          <div className="space-y-0.5">
            {results.map((result) => (
              <button
                key={`${result.type}-${result.data.id}`}
                type="button"
                onClick={() => void openResult(result)}
                className="m3-list-item"
              >
                {result.type === 'game' ? (
                  <span className="m3-icon-tile">
                    <Gamepad2 className="h-5 w-5" />
                  </span>
                ) : (
                  <M3Avatar
                    name={titleOf(result)}
                    src={result.type === 'user' ? result.data.avatar : (result.data as Chat).avatar}
                    size={48}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-semibold leading-6 text-m3-on-surface">
                    {titleOf(result)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13.5px] leading-5 text-m3-on-surface-variant">
                    {result.type === 'chat' && result.data.type === 'channel' && (
                      <Megaphone className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {result.type === 'chat' && result.data.type === 'group' && (
                      <Users className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {descriptionOf(result)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : searched && !loading ? (
          <p className="px-6 py-12 text-center text-sm text-m3-on-surface-variant">
            {t('no_results_found')}
          </p>
        ) : (
          <M3EmptyState
            icon={Search}
            title={t('search_dialog_title')}
            description={t('search_dialog_desc')}
          />
        )}
      </div>
    </div>
  );
}
