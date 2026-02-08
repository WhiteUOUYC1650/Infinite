'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import placeholderImages from '@/lib/placeholder-images.json';

type Theme = 'orange' | 'purple' | 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'pink' | 'frutiger';

type ThemeColors = { [key: string]: string };

type ThemeConfig = {
  light: ThemeColors;
  dark: ThemeColors;
  backgroundImage?: keyof typeof placeholderImages;
};

const THEMES: Record<Theme, ThemeConfig> = {
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
  frutiger: {
    light: {
      primary: '205 80% 55% / 0.8',
      foreground: '205 50% 98%',
      background: 'transparent',
      card: '130 40% 97% / 0.6',
      'sidebar-background': '130 40% 97% / 0.6',
      popover: '130 40% 97% / 0.6',
      muted: '130 30% 90% / 0.5',
      border: '130 20% 85% / 0.5',
      input: '130 20% 88% / 0.5',
      sidebarForeground: '215 25% 25%',
      sidebarAccent: '130 30% 90% / 0.5',
      sidebarAccentForeground: '215 25% 25%',
    },
    dark: {
      primary: '205 80% 60% / 0.8',
      foreground: '205 50% 98%',
      background: 'transparent',
      card: '140 15% 10% / 0.75',
      'sidebar-background': '140 15% 10% / 0.75',
      popover: '140 15% 10% / 0.75',
      muted: '140 10% 15% / 0.6',
      border: '140 10% 20% / 0.5',
      input: '140 10% 20% / 0.6',
      sidebarForeground: '140 20% 95%',
      sidebarAccent: '140 10% 15% / 0.6',
      sidebarAccentForeground: '140 20% 95%',
    },
    backgroundImage: 'frutiger_aero_background',
  },
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
  showSnowflakes: boolean;
  toggleSnowflakes: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('orange');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSnowflakes, setShowSnowflakes] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    const storedDarkMode = localStorage.getItem('app-theme-mode');
    const storedSnowflakes = localStorage.getItem('app-snowflakes-mode');

    if (storedTheme && THEMES[storedTheme]) {
      setTheme(storedTheme);
    }
    
    if (storedDarkMode) {
      setIsDarkMode(storedDarkMode === 'dark');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    
    if (storedSnowflakes) {
      setShowSnowflakes(storedSnowflakes === 'true');
    }

    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      const root = document.documentElement;
      const body = document.body;

      root.classList.toggle('dark', isDarkMode);
      localStorage.setItem('app-theme-mode', isDarkMode ? 'dark' : 'light');

      if (theme === 'frutiger') {
        root.classList.add('theme-frutiger');
      } else {
        root.classList.remove('theme-frutiger');
      }
      
      const themeConfig = THEMES[theme];
      const bgImageKey = themeConfig.backgroundImage;

      if (bgImageKey && (placeholderImages as any)[bgImageKey]) {
        body.style.backgroundImage = `url(${(placeholderImages as any)[bgImageKey].url})`;
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundAttachment = 'fixed';
      } else {
        body.style.backgroundImage = 'none';
      }
      
      const themeColors = THEMES[theme][isDarkMode ? 'dark' : 'light'];
      
      const varsToSet = {
        '--background': themeColors.background,
        '--primary': themeColors.primary,
        '--primary-foreground': themeColors.foreground,
        '--card': themeColors.card,
        '--popover': themeColors.popover,
        '--secondary': themeColors.muted,
        '--muted': themeColors.muted,
        '--accent': themeColors.primary,
        '--accent-foreground': themeColors.foreground,
        '--border': themeColors.border,
        '--input': themeColors.input,
        '--ring': themeColors.primary,
        '--sidebar-background': themeColors['sidebar-background'],
        '--sidebar-foreground': themeColors.sidebarForeground,
        '--sidebar-primary': themeColors.primary,
        '--sidebar-primary-foreground': themeColors.foreground,
        '--sidebar-accent': themeColors.sidebarAccent,
        '--sidebar-accent-foreground': themeColors.sidebarAccentForeground,
        '--sidebar-border': themeColors.border,
        '--sidebar-ring': themeColors.primary,
      };

      for (const [property, value] of Object.entries(varsToSet)) {
          if (value) root.style.setProperty(property, value);
      }

      if (theme === 'frutiger') {
        body.style.backgroundColor = 'transparent';
      } else {
        body.style.backgroundColor = '';
      }
    }
  }, [theme, isDarkMode, isMounted]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('app-color-theme', newTheme);
  };

  const handleToggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const handleToggleSnowflakes = () => {
    setShowSnowflakes(prev => {
      const newState = !prev;
      localStorage.setItem('app-snowflakes-mode', String(newState));
      return newState;
    });
  };

  const value = {
    theme,
    setTheme: handleSetTheme,
    toggleTheme: handleToggleTheme,
    isDarkMode,
    showSnowflakes,
    toggleSnowflakes: handleToggleSnowflakes,
  };

  if (!isMounted) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
