
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import placeholderImages from '@/lib/placeholder-images.json';
import { CustomThemeConfig } from '@/types';
import { applyM3Palette } from '@/lib/m3-palette';

export type Theme =
  | 'orange' | 'purple' | 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'pink'
  | 'shining_gold' | 'first_version' | 'custom'
  /* Material 3 palette additions (used by the Material 3 edition) */
  | 'deep_purple' | 'indigo' | 'light_blue' | 'cyan' | 'teal' | 'light_green'
  | 'lime' | 'amber' | 'deep_orange' | 'brown' | 'blue_grey';

/**
 * Design edition is baked in at build time, see .github/workflows/main.yml:
 *   NEXT_PUBLIC_INFINITE_EDITION=material3  → "Material 3" edition of Infinite 3.0
 *   NEXT_PUBLIC_INFINITE_EDITION=material2  → "Material 2" edition (Android 5.0+)
 *   unset / any other value                 → classic Infinite 1.5 interface (default)
 *
 * The editions are separate APKs and never switch at runtime, so the classic
 * 1.5 interface stays byte-for-byte identical for its build.
 */
export type AppEdition = 'material3' | 'material2' | 'classic';

const EDITION_ENV = process.env.NEXT_PUBLIC_INFINITE_EDITION;

export const APP_EDITION: AppEdition =
  EDITION_ENV === 'material3' ? 'material3' : EDITION_ENV === 'material2' ? 'material2' : 'classic';

type ThemeColors = { [key: string]: string };

type ThemeConfig = {
  light: ThemeColors;
  dark: ThemeColors;
  backgroundImage?: keyof typeof placeholderImages;
};

const DEFAULT_CUSTOM_COLORS: CustomThemeConfig = {
    primary: { h: 25, s: 95, l: 53 },
    background: { h: 30, s: 71, l: 92 }
};

/**
 * Material 3 palette entry: a primary colour plus matching tonal surfaces.
 * Kept separate from the classic theme rows above so the 1.5 interface is
 * completely unaffected by these additions.
 */
const makePaletteTheme = (
  h: number,
  s: number,
  l: number,
  bgH: number,
  bgS: number,
  bgL: number
): ThemeConfig => {
  const lightMuted = `${bgH} ${Math.max(bgS - 20, 8)}% ${Math.max(bgL - 4, 60)}%`;
  const card = `${bgH} ${bgS}% ${Math.min(bgL + 3, 98)}%`;
  return {
    light: {
      primary: `${h} ${s}% ${l}%`,
      foreground: `${h} ${Math.max(60, s - 10)}% 95%`,
      background: `${bgH} ${bgS}% ${bgL}%`,
      card,
      'sidebar-background': card,
      popover: card,
      muted: lightMuted,
      border: `${bgH} 30% ${Math.max(bgL - 10, 45)}%`,
      input: `${bgH} 30% ${Math.max(bgL - 7, 50)}%`,
      sidebarForeground: '20 14.3% 20.1%',
      sidebarAccent: lightMuted,
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
    dark: {
      primary: `${h} ${s}% ${l}%`,
      foreground: `${h} ${Math.max(60, s - 10)}% 95%`,
      background: `${bgH} 10% 10%`,
      card: `${bgH} 10% 12%`,
      'sidebar-background': `${bgH} 10% 12%`,
      popover: `${bgH} 10% 10%`,
      muted: `${bgH} 10% 20%`,
      border: `${bgH} 10% 25%`,
      input: `${bgH} 10% 25%`,
      sidebarForeground: `${bgH} ${Math.min(s, 30)}% 92%`,
      sidebarAccent: `${bgH} 10% 20%`,
      sidebarAccentForeground: `${bgH} 20% 100%`,
    },
  };
};

const THEMES: Record<Exclude<Theme, 'custom'>, ThemeConfig> = {
  /* ---- Material 3 palette (Material 500 primaries, tonal surfaces) ---- */
  deep_purple: makePaletteTheme(262, 52, 47, 262, 45, 94),
  indigo: makePaletteTheme(231, 48, 48, 231, 50, 94),
  light_blue: makePaletteTheme(199, 98, 48, 199, 60, 93),
  cyan: makePaletteTheme(187, 100, 42, 187, 55, 93),
  teal: makePaletteTheme(174, 100, 29, 174, 40, 92),
  light_green: makePaletteTheme(88, 50, 53, 88, 45, 93),
  lime: makePaletteTheme(66, 70, 54, 66, 55, 92),
  amber: makePaletteTheme(45, 100, 51, 45, 75, 93),
  deep_orange: makePaletteTheme(14, 100, 57, 14, 75, 93),
  brown: makePaletteTheme(16, 25, 38, 16, 25, 92),
  blue_grey: makePaletteTheme(200, 18, 46, 200, 20, 93),
  orange: {
    light: {
      primary: '25 95% 53%',
      foreground: '25 85% 95%',
      background: '30 71% 92%',
      card: '30 71% 95%',
      'sidebar-background': '30 71% 95%',
      popover: '30 71% 95%',
      muted: '30 50% 88%',
      border: '30 30% 82%',
      input: '30 30% 87%',
      sidebarForeground: '20 14.3% 20.1%',
      sidebarAccent: '30 50% 88%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
    dark: {
      primary: '25 95% 53%',
      foreground: '25 85% 95%',
      background: '20 10% 10%',
      card: '20 10% 12%',
      'sidebar-background': '20 10% 12%',
      popover: '20 10% 10%',
      muted: '20 10% 20%',
      border: '20 10% 25%',
      input: '20 10% 25%',
      sidebarForeground: '30 71% 92%',
      sidebarAccent: '30 50% 88%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
  },
  first_version: {
    light: {
      primary: '33 100% 50%',
      foreground: '33 100% 98%',
      background: '33 40% 95%',
      card: '33 40% 97%',
      'sidebar-background': '33 40% 97%',
      popover: '33 40% 97%',
      muted: '33 30% 90%',
      border: '33 20% 85%',
      input: '33 20% 88%',
      sidebarForeground: '33 10% 15%',
      sidebarAccent: '33 30% 90%',
      sidebarAccentForeground: '33 10% 5%',
    },
    dark: {
      primary: '33 100% 50%',
      foreground: '33 100% 98%',
      background: '33 15% 10%',
      card: '33 15% 12%',
      'sidebar-background': '33 15% 12%',
      popover: '33 15% 10%',
      muted: '33 10% 18%',
      border: '33 10% 25%',
      input: '33 10% 25%',
      sidebarForeground: '33 20% 95%',
      sidebarAccent: '33 10% 18%',
      sidebarAccentForeground: '33 20% 100%',
    },
  },
  purple: {
    light: {
      primary: '259 87% 66%',
      foreground: '259 85% 95%',
      background: '259 60% 94%',
      card: '259 60% 96%',
      'sidebar-background': '259 60% 96%',
      popover: '259 60% 96%',
      muted: '259 50% 90%',
      border: '259 30% 85%',
      input: '259 30% 88%',
      sidebarForeground: '20 14.3% 20.1%',
      sidebarAccent: '259 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
    dark: {
      primary: '259 87% 66%',
      foreground: '259 85% 95%',
      background: '259 15% 12%',
      card: '259 15% 14%',
      'sidebar-background': '259 15% 14%',
      popover: '259 15% 12%',
      muted: '259 10% 22%',
      border: '259 10% 27%',
      input: '259 10% 27%',
      sidebarForeground: '30 71% 92%',
      sidebarAccent: '259 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
  },
  blue: {
    light: {
      primary: '217 91% 60%',
      foreground: '217 83% 98%',
      background: '217 60% 94%',
      card: '217 60% 96%',
      'sidebar-background': '217 60% 96%',
      popover: '217 60% 96%',
      muted: '217 50% 90%',
      border: '217 30% 85%',
      input: '217 30% 88%',
      sidebarForeground: '20 14.3% 20.1%',
      sidebarAccent: '217 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
    dark: {
      primary: '217 91% 55%',
      foreground: '217 83% 98%',
      background: '217 15% 12%',
      card: '217 15% 14%',
      'sidebar-background': '217 15% 14%',
      popover: '217 15% 12%',
      muted: '217 10% 22%',
      border: '217 10% 27%',
      input: '217 10% 27%',
      sidebarForeground: '30 71% 92%',
      sidebarAccent: '217 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
  },
  gray: {
    light: {
      primary: '220 9% 45%',
      foreground: '220 15% 98%',
      background: '220 10% 94%',
      card: '220 10% 96%',
      'sidebar-background': '220 10% 96%',
      popover: '220 10% 96%',
      muted: '220 10% 90%',
      border: '220 10% 85%',
      input: '220 10% 88%',
      sidebarForeground: '20 14.3% 20.1%',
      sidebarAccent: '220 10% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
    dark: {
      primary: '220 9% 55%',
      foreground: '220 20% 10%',
      background: '220 5% 12%',
      card: '220 5% 14%',
      'sidebar-background': '220 5% 14%',
      popover: '220 5% 12%',
      muted: '220 5% 22%',
      border: '220 5% 27%',
      input: '220 5% 27%',
      sidebarForeground: '30 71% 92%',
      sidebarAccent: '220 10% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
  },
  green: {
    light: {
      primary: '145 63% 42%',
      foreground: '145 76% 98%',
      background: '145 30% 94%',
      card: '145 30% 96%',
      'sidebar-background': '145 30% 96%',
      popover: '145 30% 96%',
      muted: '145 25% 90%',
      border: '145 20% 85%',
      input: '145 20% 88%',
      sidebarForeground: '20 14.3% 20.1%',
      sidebarAccent: '145 25% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
    dark: {
      primary: '145 63% 37%',
      foreground: '145 76% 98%',
      background: '145 15% 12%',
      card: '145 15% 14%',
      'sidebar-background': '145 15% 14%',
      popover: '145 15% 12%',
      muted: '145 10% 22%',
      border: '145 10% 27%',
      input: '145 10% 27%',
      sidebarForeground: '30 71% 92%',
      sidebarAccent: '145 25% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
  },
  red: {
    light: {
      primary: '0 84% 60%',
      foreground: '0 72% 98%',
      background: '0 60% 94%',
      card: '0 60% 96%',
      'sidebar-background': '0 60% 96%',
      popover: '0 60% 96%',
      muted: '0 50% 90%',
      border: '0 30% 85%',
      input: '0 30% 88%',
      sidebarForeground: '20 14.3% 20.1%',
      sidebarAccent: '0 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
    dark: {
      primary: '0 84% 55%',
      foreground: '0 72% 98%',
      background: '0 15% 12%',
      card: '0 15% 14%',
      'sidebar-background': '0 15% 14%',
      popover: '0 15% 12%',
      muted: '0 10% 22%',
      border: '0 10% 27%',
      input: '0 10% 27%',
      sidebarForeground: '30 71% 92%',
      sidebarAccent: '0 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
  },
  yellow: {
    light: {
      primary: '48 96% 53%',
      foreground: '48 96% 10%',
      background: '48 60% 94%',
      card: '48 60% 96%',
      'sidebar-background': '48 60% 96%',
      popover: '48 60% 96%',
      muted: '48 50% 90%',
      border: '48 30% 85%',
      input: '48 30% 88%',
      sidebarForeground: '20 14.3% 20.1%',
      sidebarAccent: '48 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
    dark: {
      primary: '48 96% 53%',
      foreground: '48 96% 10%',
      background: '48 15% 12%',
      card: '48 15% 14%',
      'sidebar-background': '48 15% 14%',
      popover: '48 15% 12%',
      muted: '48 10% 22%',
      border: '48 10% 27%',
      input: '48 10% 27%',
      sidebarForeground: '30 71% 92%',
      sidebarAccent: '48 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
  },
  pink: {
    light: {
      primary: '327 86% 59%',
      foreground: '327 85% 95%',
      background: '327 60% 94%',
      card: '327 60% 96%',
      'sidebar-background': '327 60% 96%',
      popover: '327 60% 96%',
      muted: '327 50% 90%',
      border: '327 30% 85%',
      input: '327 30% 88%',
      sidebarForeground: '20 14.3% 20.1%',
      sidebarAccent: '327 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
    dark: {
      primary: '327 86% 59%',
      foreground: '327 85% 95%',
      background: '327 15% 12%',
      card: '327 15% 14%',
      'sidebar-background': '327 15% 14%',
      popover: '327 15% 12%',
      muted: '327 10% 22%',
      border: '327 10% 27%',
      input: '327 10% 27%',
      sidebarForeground: '30 71% 92%',
      sidebarAccent: '327 50% 90%',
      sidebarAccentForeground: '20 14.3% 4.1%',
    },
  },
  shining_gold: {
    light: {
      primary: '42 90% 55%',
      foreground: '42 90% 98%',
      background: '38 30% 95%',
      card: '38 30% 98%',
      'sidebar-background': '38 30% 98%',
      popover: '38 30% 98%',
      muted: '38 30% 92%',
      border: '38 25% 85%',
      input: '38 25% 88%',
      sidebarForeground: '38 20% 20%',
      sidebarAccent: '38 30% 92%',
      sidebarAccentForeground: '38 20% 20%',
    },
    dark: {
      primary: '42 90% 55%',
      foreground: '42 90% 10%',
      background: '35 15% 10%',
      card: '35 15% 12%',
      'sidebar-background': '35 15% 12%',
      popover: '35 15% 10%',
      muted: '35 15% 18%',
      border: '35 10% 25%',
      input: '35 10% 25%',
      sidebarForeground: '35 20% 95%',
      sidebarAccent: '35 15% 18%',
      sidebarAccentForeground: '35 20% 95%',
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
  showSnowflakes: boolean;
  toggleSnowflakes: () => void;
  sendOnEnter: boolean;
  toggleSendOnEnter: () => void;
  smoothScroll: boolean;
  toggleSmoothScroll: () => void;
  minimizeCallOnClose: boolean;
  toggleMinimizeCallOnClose: () => void;
  experimentalDesign: boolean;
  toggleExperimentalDesign: () => void;
  /** Design edition, fixed at build time (Material 3 build only). */
  material3Design: boolean;
  /** Design edition, fixed at build time (Material 2 build only). */
  material2Design: boolean;
  appEdition: AppEdition;
  glassEffect: boolean;
  toggleGlassEffect: () => void;
  glassIntensity: number;
  showFeed: boolean;
  toggleShowFeed: () => void;
  useSystemFont: boolean;
  toggleSystemFont: () => void;
  /** Hide the seasonal / holiday banner above the chat list. */
  hideHolidayBanners: boolean;
  toggleHideHolidayBanners: () => void;
  /** Hide the user-created chat folders (chips). */
  hideUserFolders: boolean;
  toggleHideUserFolders: () => void;
  /** Hide the built-in chat folders (All / DMs / Groups / Channels / Bots). */
  hideChatFolders: boolean;
  toggleHideChatFolders: () => void;
  /** Hide the stories row. */
  hideStories: boolean;
  toggleHideStories: () => void;
  customThemeConfig: CustomThemeConfig;
  setCustomThemeConfig: (config: CustomThemeConfig) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('orange');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSnowflakes, setShowSnowflakes] = useState(false);
  const [sendOnEnter, setSendOnEnter] = useState(false);
  const [smoothScroll, setSmoothScroll] = useState(false);
  const [minimizeCallOnClose, setMinimizeCallOnClose] = useState(false);
  const [experimentalDesign, setExperimentalDesign] = useState(false);
  const material3Design = APP_EDITION === 'material3';
  const material2Design = APP_EDITION === 'material2';
  const [glassEffect, setGlassEffect] = useState(false);
  const [showFeed, setShowFeed] = useState(true);
  const [hideHolidayBanners, setHideHolidayBanners] = useState(false);
  const [hideUserFolders, setHideUserFolders] = useState(false);
  const [hideChatFolders, setHideChatFolders] = useState(false);
  const [hideStories, setHideStories] = useState(false);
  const [useSystemFont, setUseSystemFont] = useState(true);
  const [customThemeConfig, setCustomThemeConfig] = useState<CustomThemeConfig>(DEFAULT_CUSTOM_COLORS);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    const storedDarkMode = localStorage.getItem('app-theme-mode');
    const storedSnowflakes = localStorage.getItem('app-snowflakes-mode');
    const storedSendOnEnter = localStorage.getItem('app-send-on-enter');
    const storedSmoothScroll = localStorage.getItem('app-smooth-scroll');
    const storedMinimizeCall = localStorage.getItem('app-minimize-call');
    const storedExperimental = localStorage.getItem('app-experimental-design');
    const storedGlassEffect = localStorage.getItem('app-glass-effect');
    const storedShowFeed = localStorage.getItem('app-show-feed');
    const storedSystemFont = localStorage.getItem('app-use-system-font');
    const storedCustomColors = localStorage.getItem('app-custom-theme-config');
    const storedHideHoliday = localStorage.getItem('app-hide-holiday-banners');
    const storedHideUserFolders = localStorage.getItem('app-hide-user-folders');
    const storedHideChatFolders = localStorage.getItem('app-hide-chat-folders');
    const storedHideStories = localStorage.getItem('app-hide-stories');

    if (storedTheme && (THEMES[storedTheme as keyof typeof THEMES] || storedTheme === 'custom')) {
      setTheme(storedTheme);
    }
    
    if (storedDarkMode) {
      setIsDarkMode(storedDarkMode === 'dark');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    
    if (storedSnowflakes) setShowSnowflakes(storedSnowflakes === 'true');
    if (storedSendOnEnter) setSendOnEnter(storedSendOnEnter === 'true');
    if (storedSmoothScroll) setSmoothScroll(storedSmoothScroll === 'true');
    if (storedMinimizeCall) setMinimizeCallOnClose(storedMinimizeCall === 'true');
    if (storedExperimental) setExperimentalDesign(storedExperimental === 'true');
    if (storedGlassEffect) setGlassEffect(storedGlassEffect === 'true');
    if (storedShowFeed) setShowFeed(storedShowFeed === 'true');
    if (storedSystemFont !== null) setUseSystemFont(storedSystemFont === 'true');
    if (storedHideHoliday) setHideHolidayBanners(storedHideHoliday === 'true');
    if (storedHideUserFolders) setHideUserFolders(storedHideUserFolders === 'true');
    if (storedHideChatFolders) setHideChatFolders(storedHideChatFolders === 'true');
    if (storedHideStories) setHideStories(storedHideStories === 'true');
    if (storedCustomColors) {
        try { setCustomThemeConfig(JSON.parse(storedCustomColors)); } catch(e) {}
    }

    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      const root = document.documentElement;
      root.classList.toggle('dark', isDarkMode);
      localStorage.setItem('app-theme-mode', isDarkMode ? 'dark' : 'light');

      root.setAttribute('data-glass-effect', glassEffect ? 'true' : 'false');
      root.setAttribute('data-experimental-design', experimentalDesign ? 'true' : 'false');
      root.setAttribute('data-material3', material3Design ? 'true' : 'false');
      root.setAttribute('data-material2', material2Design ? 'true' : 'false');
      root.classList.toggle('md3', material3Design);
      root.classList.toggle('md2', material2Design);

      if (theme === 'shining_gold') {
        root.classList.add('theme-shining-gold');
      } else {
        root.classList.remove('theme-shining-gold');
      }
      
      let themeColors: ThemeColors;

      if (theme === 'custom') {
          const cfg = customThemeConfig;
          const p = `${cfg.primary.h} ${cfg.primary.s}% ${cfg.primary.l}%`;
          const b = isDarkMode 
            ? `${cfg.background.h} ${Math.max(0, cfg.background.s - 50)}% ${Math.min(15, cfg.background.l / 5)}%` 
            : `${cfg.background.h} ${cfg.background.s}% ${cfg.background.l}%`;
          
          themeColors = {
              primary: p,
              background: b,
              foreground: isDarkMode ? '0 0% 98%' : '0 0% 10%',
              card: isDarkMode ? `${cfg.background.h} ${Math.max(0, cfg.background.s - 50)}% ${Math.min(18, cfg.background.l / 4)}%` : b,
              popover: b,
              muted: isDarkMode ? '0 0% 15%' : '0 0% 92%',
              border: isDarkMode ? '0 0% 25%' : '0 0% 85%',
              input: isDarkMode ? '0 0% 25%' : '0 0% 85%',
              sidebarForeground: isDarkMode ? '0 0% 95%' : '0 0% 20%',
              sidebarAccent: isDarkMode ? '0 0% 20%' : '0 0% 90%',
              sidebarAccentForeground: isDarkMode ? '0 0% 100%' : '0 0% 10%',
          };
      } else {
          themeColors = THEMES[theme as keyof typeof THEMES][isDarkMode ? 'dark' : 'light'];
      }
      
      const varsToSet = {
        '--background': themeColors.background,
        '--primary': themeColors.primary,
        '--primary-foreground': themeColors.foreground || (isDarkMode ? '0 0% 98%' : '0 0% 10%'),
        '--card': themeColors.card,
        '--popover': themeColors.popover,
        '--secondary': themeColors.muted,
        '--muted': themeColors.muted,
        '--accent': themeColors.primary,
        '--accent-foreground': themeColors.foreground || (isDarkMode ? '0 0% 98%' : '0 0% 10%'),
        '--border': themeColors.border,
        '--input': themeColors.input,
        '--ring': themeColors.primary,
        '--sidebar-background': themeColors['sidebar-background'] || themeColors.card,
        '--sidebar-foreground': themeColors.sidebarForeground,
        '--sidebar-primary': themeColors.primary,
        '--sidebar-primary-foreground': themeColors.foreground || (isDarkMode ? '0 0% 98%' : '0 0% 10%'),
        '--sidebar-accent': themeColors.sidebarAccent,
        '--sidebar-accent-foreground': themeColors.sidebarAccentForeground,
        '--sidebar-border': themeColors.border,
        '--sidebar-ring': themeColors.primary,
      };

      for (const [property, value] of Object.entries(varsToSet)) {
          if (value) root.style.setProperty(property, value);
      }

      // Material 3 edition: the seed colour is expanded into the full set of
      // Material You color roles (surface-container-*, primary-container, …)
      // and the legacy semantic variables are remapped onto them. The classic
      // 1.5 and Material 2 editions keep the palette set above.
      if (material3Design) {
          applyM3Palette(root, themeColors.primary, isDarkMode);
      }
    }
  }, [theme, isDarkMode, glassEffect, experimentalDesign, material3Design, material2Design, isMounted, customThemeConfig]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('app-color-theme', newTheme);
  };

  const handleSetCustomConfig = (config: CustomThemeConfig) => {
      setCustomThemeConfig(config);
      localStorage.setItem('app-custom-theme-config', JSON.stringify(config));
  };

  const handleToggleTheme = () => setIsDarkMode(prev => !prev);
  const handleToggleSnowflakes = () => {
    setShowSnowflakes(prev => {
      localStorage.setItem('app-snowflakes-mode', String(!prev));
      return !prev;
    });
  };
  const togglePersisted = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(prev => {
      localStorage.setItem(key, String(!prev));
      return !prev;
    });
  };

  const handleToggleHideHolidayBanners = () => togglePersisted('app-hide-holiday-banners', setHideHolidayBanners);
  const handleToggleHideUserFolders = () => togglePersisted('app-hide-user-folders', setHideUserFolders);
  const handleToggleHideChatFolders = () => togglePersisted('app-hide-chat-folders', setHideChatFolders);
  const handleToggleHideStories = () => togglePersisted('app-hide-stories', setHideStories);

  const handleToggleSendOnEnter = () => {
    setSendOnEnter(prev => {
      localStorage.setItem('app-send-on-enter', String(!prev));
      return !prev;
    });
  };
  const handleToggleSmoothScroll = () => {
    setSmoothScroll(prev => {
      localStorage.setItem('app-smooth-scroll', String(!prev));
      return !prev;
    });
  };
  const handleToggleMinimizeCallOnClose = () => {
    setMinimizeCallOnClose(prev => {
      localStorage.setItem('app-minimize-call', String(!prev));
      return !prev;
    });
  };
  const handleToggleExperimentalDesign = () => {
    setExperimentalDesign(prev => {
      const next = !prev;
      localStorage.setItem('app-experimental-design', String(next));
      return next;
    });
  };
  const toggleGlassEffect = () => {
    setGlassEffect(prev => {
      localStorage.setItem('app-glass-effect', String(!prev));
      return !prev;
    });
  };
  const toggleShowFeed = () => {
    setShowFeed(prev => {
      localStorage.setItem('app-show-feed', String(!prev));
      return !prev;
    });
  };
  const toggleSystemFont = () => {
    setUseSystemFont(prev => {
      localStorage.setItem('app-use-system-font', String(!prev));
      return !prev;
    });
  };

  const value = {
    theme,
    setTheme: handleSetTheme,
    toggleTheme: handleToggleTheme,
    isDarkMode,
    androidVersion: getAndroidVersion(),
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    systemColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    showSnowflakes,
    toggleSnowflakes: handleToggleSnowflakes,
    sendOnEnter,
    toggleSendOnEnter: handleToggleSendOnEnter,
    smoothScroll,
    toggleSmoothScroll: handleToggleSmoothScroll,
    minimizeCallOnClose,
    toggleMinimizeCallOnClose: handleToggleMinimizeCallOnClose,
    experimentalDesign,
    toggleExperimentalDesign: handleToggleExperimentalDesign,
    material3Design,
    material2Design,
    appEdition: APP_EDITION,
    glassEffect,
    toggleGlassEffect,
    glassIntensity: glassEffect ? 70 : 0,
    showFeed,
    toggleShowFeed,
    useSystemFont,
    toggleSystemFont,
    hideHolidayBanners,
    toggleHideHolidayBanners: handleToggleHideHolidayBanners,
    hideUserFolders,
    toggleHideUserFolders: handleToggleHideUserFolders,
    hideChatFolders,
    toggleHideChatFolders: handleToggleHideChatFolders,
    hideStories,
    toggleHideStories: handleToggleHideStories,
    customThemeConfig,
    setCustomThemeConfig: handleSetCustomConfig
  };

  if (!isMounted) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
