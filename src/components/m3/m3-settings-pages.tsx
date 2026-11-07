'use client';

/**
 * Material 3 settings pages: Appearance, Chats, Language.
 * These are real in-screen pages (no settings dialog involved).
 */

import React from 'react';
import {
  Moon,
  Paintbrush,
  Send,
  Smartphone,
  Snowflake,
  Sparkles,
  Sun,
  Waves,
  Minimize2,
  MonitorSmartphone,
  Check,
} from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { useTheme, type Theme } from '@/context/theme-context';
import type { Language } from '@/lib/translations';
import { M3RowItem } from './m3-surfaces';
import { M3SectionLabel } from './m3-surfaces';
import { M3ThemeSwatches, M3ToggleRow } from './m3-settings-rows';

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ru', label: 'Русский' },
  { id: 'es', label: 'Español' },
  { id: 'pt-BR', label: 'Português (BR)' },
  { id: 'be', label: 'Беларуская' },
  { id: 'old-ru', label: 'Русскій (дореформенный)' },
];

export function M3AppearancePage() {
  const { t } = useLanguage();
  const {
    theme,
    setTheme,
    isDarkMode,
    toggleTheme,
    useSystemFont,
    toggleSystemFont,
    showSnowflakes,
    toggleSnowflakes,
    experimentalDesign,
    toggleExperimentalDesign,
    glassEffect,
    toggleGlassEffect,
    showFeed,
    toggleShowFeed,
  } = useTheme();

  return (
    <div className="space-y-3 px-2">
      <div className="rounded-[1.5rem] bg-m3-surface-container-low">
        <M3ToggleRow
          icon={isDarkMode ? Moon : Sun}
          label={t('dark_mode')}
          description={t('light_mode')}
          checked={isDarkMode}
          onCheckedChange={toggleTheme}
        />
        <M3ToggleRow
          icon={Smartphone}
          label={t('use_system_font_label')}
          description={t('use_system_font_desc')}
          checked={useSystemFont}
          onCheckedChange={toggleSystemFont}
        />
      </div>

      <div className="rounded-[1.5rem] bg-m3-surface-container-low py-1">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Paintbrush className="h-5 w-5 text-m3-on-surface-variant" />
          <span className="text-base text-m3-on-surface">{t('color_theme')}</span>
        </div>
        <M3ThemeSwatches
          value={theme}
          onChange={(next: Theme) => setTheme(next)}
          labelFor={(id) => t(id as any)}
        />
      </div>

      <div className="rounded-[1.5rem] bg-m3-surface-container-low">
        <M3ToggleRow
          icon={Snowflake}
          label={t('snowflakes')}
          checked={showSnowflakes}
          onCheckedChange={toggleSnowflakes}
        />
        <M3ToggleRow
          icon={Sparkles}
          label={t('experimental_design_label')}
          description={t('experimental_design_desc')}
          checked={experimentalDesign}
          onCheckedChange={toggleExperimentalDesign}
        />
        <M3ToggleRow
          icon={Waves}
          label={t('glass_effect_label')}
          description={t('glass_effect_desc')}
          checked={glassEffect}
          onCheckedChange={toggleGlassEffect}
        />
        <M3ToggleRow
          icon={MonitorSmartphone}
          label={t('show_feed_label')}
          description={t('show_feed_desc')}
          checked={showFeed}
          onCheckedChange={toggleShowFeed}
        />
      </div>
    </div>
  );
}

export function M3ChatsPage() {
  const { t } = useLanguage();
  const { sendOnEnter, toggleSendOnEnter, smoothScroll, toggleSmoothScroll, minimizeCallOnClose, toggleMinimizeCallOnClose } = useTheme();

  return (
    <div className="space-y-3 px-2">
      <M3SectionLabel className="px-2">{t('chat_settings')}</M3SectionLabel>
      <div className="rounded-[1.5rem] bg-m3-surface-container-low">
        <M3ToggleRow
          icon={Send}
          label={t('send_on_enter_label')}
          checked={sendOnEnter}
          onCheckedChange={toggleSendOnEnter}
        />
        <M3ToggleRow
          icon={Waves}
          label={t('smooth_scroll_label')}
          description={t('smooth_scroll_desc')}
          checked={smoothScroll}
          onCheckedChange={toggleSmoothScroll}
        />
        <M3ToggleRow
          icon={Minimize2}
          label={t('minimize_call_on_close_label')}
          checked={minimizeCallOnClose}
          onCheckedChange={toggleMinimizeCallOnClose}
        />
      </div>
    </div>
  );
}

export function M3LanguagePage() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="space-y-3 px-2">
      <div className="rounded-[1.5rem] bg-m3-surface-container-low py-1">
        {LANGUAGES.map((item) => (
          <M3RowItem
            key={item.id}
            plain
            icon={Check}
            label={item.label}
            right={
              language === item.id ? (
                <span className="text-sm font-medium text-m3-primary">{t('selected')}</span>
              ) : undefined
            }
            className={language === item.id ? 'bg-m3-secondary-container' : undefined}
            onClick={() => setLanguage(item.id)}
          />
        ))}
      </div>
      <p className="px-4 text-[12px] leading-relaxed text-m3-on-surface-variant">
        {t('language_desc')}
      </p>
    </div>
  );
}
