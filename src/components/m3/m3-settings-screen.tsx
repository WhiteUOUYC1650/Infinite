'use client';

/**
 * Material 3 settings *screen*.
 *
 * Every category opens a real in-screen page (Appearance, Chats, Language,
 * Data & storage, About) instead of jumping into the old settings dialog.
 * The dialog stays available behind "All settings" for the advanced sections
 * (InfGold, premium, PIN protection, stories, …).
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  HardDrive,
  Info,
  Languages,
  LogOut,
  MessageSquare,
  Palette,
  Settings2,
  UserCog,
} from 'lucide-react';
import { useAuth } from '@/firebase';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser } from '@/types';
import { EditProfileDialog } from '@/components/edit-profile-dialog';
import { M3Avatar, M3RowItem } from './m3-surfaces';
import { M3FilledButton, M3IconButton } from './m3-primitives';
import { M3AppearancePage, M3ChatsPage, M3LanguagePage } from './m3-settings-pages';
import { M3AboutPage, M3StoragePage } from './m3-settings-info';

type PageId = 'root' | 'appearance' | 'chats' | 'language' | 'storage' | 'about';

export function M3SettingsScreen({
  currentUser,
  onOpenSettings,
}: {
  currentUser: AuthenticatedUser;
  onOpenSettings: () => void;
}) {
  const { t, language } = useLanguage();
  const auth = useAuth();
  const [page, setPage] = useState<PageId>('root');
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const titles: Record<PageId, string> = {
    root: t('settings'),
    appearance: t('appearance'),
    chats: t('chat_settings'),
    language: t('language'),
    storage: t('data_storage'),
    about: t('about'),
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-m3-surface">
      <header className="flex items-center gap-1 px-2 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        {page !== 'root' && (
          <M3IconButton icon={ArrowLeft} label={t('back')} onClick={() => setPage('root')} />
        )}
        <h1 className="m3-app-bar-title-large min-w-0 flex-1 truncate px-1">{titles[page]}</h1>
        {page === 'root' && (
          <M3IconButton icon={Settings2} label={t('all_settings')} onClick={onOpenSettings} />
        )}
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-8">
        {page === 'root' && (
          <div className="px-2">
            <button
              type="button"
              onClick={() => setEditProfileOpen(true)}
              className="mb-3 flex w-full items-center gap-3 rounded-[1.5rem] bg-m3-surface-container-low px-4 py-3.5 text-left"
            >
              <M3Avatar name={currentUser.name} src={currentUser.avatar} size={56} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium leading-6 text-m3-on-surface">
                  {currentUser.name}
                </span>
                <span className="block truncate text-[13px] text-m3-on-surface-variant">
                  {currentUser.username}
                </span>
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-m3-surface-container-high text-m3-on-surface-variant">
                <UserCog className="h-4 w-4" />
              </span>
            </button>

            <div className="space-y-3">
              <div className="rounded-[1.5rem] bg-m3-surface-container-low py-1">
                <M3RowItem
                  plain
                  icon={Palette}
                  label={t('appearance')}
                  description={t('appearance_desc')}
                  onClick={() => setPage('appearance')}
                />
                <M3RowItem
                  plain
                  icon={MessageSquare}
                  label={t('chat_settings')}
                  description={t('chat_settings_desc')}
                  onClick={() => setPage('chats')}
                />
                <M3RowItem
                  plain
                  icon={Languages}
                  label={t('language')}
                  description={t('language_desc')}
                  value={<span className="text-sm text-m3-on-surface-variant">{language}</span>}
                  onClick={() => setPage('language')}
                />
              </div>

              <div className="rounded-[1.5rem] bg-m3-surface-container-low py-1">
                <M3RowItem
                  plain
                  icon={HardDrive}
                  label={t('data_storage')}
                  description={t('data_storage_desc')}
                  onClick={() => setPage('storage')}
                />
                <M3RowItem
                  plain
                  icon={Info}
                  label={t('about')}
                  description={t('about_desc')}
                  onClick={() => setPage('about')}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <M3FilledButton variant="tonal" icon={Settings2} onClick={onOpenSettings} className="w-full">
                {t('all_settings')}
              </M3FilledButton>
              <button
                type="button"
                onClick={() => void auth?.signOut()}
                className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-m3-error"
              >
                <LogOut className="h-[18px] w-[18px]" />
                {t('logout')}
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] text-m3-on-surface-variant">
              Infinite 3.0 · Redesign · {t('edition_material3')}
            </p>
          </div>
        )}

        {page === 'appearance' && <M3AppearancePage />}
        {page === 'chats' && <M3ChatsPage />}
        {page === 'language' && <M3LanguagePage />}
        {page === 'storage' && <M3StoragePage />}
        {page === 'about' && <M3AboutPage onOpenAllSettings={onOpenSettings} />}
      </div>

      <EditProfileDialog
        user={currentUser}
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
      />
    </div>
  );
}
