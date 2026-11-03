'use client';

/**
 * Material 3 settings *screen* — the screen version of
 * ExperimentalSettingsDialog. It shows in place of the conversation list while
 * the bottom navigation is on the "Settings" tab (so the navigation bar stays
 * visible); the full settings dialog is still one tap away.
 */

import React from 'react';
import {
  Languages,
  LogOut,
  Moon,
  Palette,
  Settings2,
  Smartphone,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/firebase';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';
import type { AuthenticatedUser } from '@/types';
import { Switch } from '@/components/ui/switch';
import { M3Avatar, M3RowItem } from './m3-surfaces';
import { M3FilledButton } from './m3-primitives';

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3">
      <Icon className="h-5 w-5 shrink-0 text-m3-on-surface-variant" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base leading-6 text-m3-on-surface">{label}</span>
        {description && (
          <span className="mt-0.5 block truncate text-[13px] leading-tight text-m3-on-surface-variant">
            {description}
          </span>
        )}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function M3SettingsScreen({
  currentUser,
  onOpenSettings,
}: {
  currentUser: AuthenticatedUser;
  onOpenSettings: () => void;
}) {
  const { t, language } = useLanguage();
  const { isDarkMode, toggleTheme, useSystemFont, toggleSystemFont } = useTheme();
  const auth = useAuth();

  return (
    <div className="flex h-full min-h-0 flex-col bg-m3-surface">
      <header className="px-2 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <h1 className="m3-app-bar-title-large truncate">{t('settings')}</h1>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        <button
          type="button"
          onClick={onOpenSettings}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-m3-surface-container-low px-4 py-3 text-left"
        >
          <M3Avatar name={currentUser.name} src={currentUser.avatar} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-semibold leading-6 text-m3-on-surface">
              {currentUser.name}
            </span>
            <span className="block truncate text-[13px] text-m3-on-surface-variant">
              {currentUser.username}
            </span>
          </span>
        </button>

        <div className="rounded-2xl bg-m3-surface-container-low py-1">
          <ToggleRow
            icon={isDarkMode ? Moon : Sun}
            label={t('dark_mode')}
            checked={isDarkMode}
            onCheckedChange={toggleTheme}
          />
          <ToggleRow
            icon={Smartphone}
            label={t('use_system_font_label')}
            description={t('use_system_font_desc')}
            checked={useSystemFont}
            onCheckedChange={toggleSystemFont}
          />
        </div>

        <div className="mt-3 rounded-2xl bg-m3-surface-container-low py-1">
          <M3RowItem
            icon={Languages}
            label={t('language')}
            description={t('language_desc')}
            value={<span className="text-sm text-m3-on-surface-variant">{language}</span>}
            onClick={onOpenSettings}
          />
          <M3RowItem
            icon={Palette}
            label={t('appearance')}
            description={t('appearance_desc')}
            onClick={onOpenSettings}
          />
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
    </div>
  );
}
