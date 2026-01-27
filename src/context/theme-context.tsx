'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'orange' | 'purple' | 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'pink';

const THEMES: Record<Theme, any> = {
  orange: {
    light: {
      primary: '25 95% 53%',
      foreground: '25 85% 95%',
      background: '30 71% 92%',
      card: '30 71% 95%',
      muted: '30 50% 88%',
      border: '30 30% 82%',
      input: '30 30% 87%',
    },
    dark: {
      primary: '25 95% 53%',
      foreground: '25 85% 95%',
      background: '20 10% 10%',
      card: '20 10% 12%',
      muted: '20 10% 20%',
      border: '20 10% 25%',
      input: '20 10% 25%',
    },
  },
  purple: {
    light: {
      primary: '259 87% 66%',
      foreground: '259 85% 95%',
      background: '259 60% 94%',
      card: '259 60% 96%',
      muted: '259 50% 90%',
      border: '259 30% 85%',
      input: '259 30% 88%',
    },
    dark: {
      primary: '259 87% 66%',
      foreground: '259 85% 95%',
      background: '259 15% 12%',
      card: '259 15% 14%',
      muted: '259 10% 22%',
      border: '259 10% 27%',
      input: '259 10% 27%',
    },
  },
  blue: {
    light: {
      primary: '217 91% 60%',
      foreground: '217 83% 98%',
      background: '217 60% 94%',
      card: '217 60% 96%',
      muted: '217 50% 90%',
      border: '217 30% 85%',
      input: '217 30% 88%',
    },
    dark: {
      primary: '217 91% 55%',
      foreground: '217 83% 98%',
      background: '217 15% 12%',
      card: '217 15% 14%',
      muted: '217 10% 22%',
      border: '217 10% 27%',
      input: '217 10% 27%',
    },
  },
  gray: {
    light: {
      primary: '220 9% 45%',
      foreground: '220 15% 98%',
      background: '220 10% 94%',
      card: '220 10% 96%',
      muted: '220 10% 90%',
      border: '220 10% 85%',
      input: '220 10% 88%',
    },
    dark: {
      primary: '220 9% 55%',
      foreground: '220 20% 10%',
      background: '220 5% 12%',
      card: '220 5% 14%',
      muted: '220 5% 22%',
      border: '220 5% 27%',
      input: '220 5% 27%',
    },
  },
  green: {
    light: {
      primary: '145 63% 42%',
      foreground: '145 76% 98%',
      background: '145 30% 94%',
      card: '145 30% 96%',
      muted: '145 25% 90%',
      border: '145 20% 85%',
      input: '145 20% 88%',
    },
    dark: {
      primary: '145 63% 37%',
      foreground: '145 76% 98%',
      background: '145 15% 12%',
      card: '145 15% 14%',
      muted: '145 10% 22%',
      border: '145 10% 27%',
      input: '145 10% 27%',
    },
  },
  red: {
    light: {
      primary: '0 84% 60%',
      foreground: '0 72% 98%',
      background: '0 60% 94%',
      card: '0 60% 96%',
      muted: '0 50% 90%',
      border: '0 30% 85%',
      input: '0 30% 88%',
    },
    dark: {
      primary: '0 84% 55%',
      foreground: '0 72% 98%',
      background: '0 15% 12%',
      card: '0 15% 14%',
      muted: '0 10% 22%',
      border: '0 10% 27%',
      input: '0 10% 27%',
    },
  },
  yellow: {
    light: {
      primary: '48 96% 53%',
      foreground: '48 96% 10%',
      background: '48 60% 94%',
      card: '48 60% 96%',
      muted: '48 50% 90%',
      border: '48 30% 85%',
      input: '48 30% 88%',
    },
    dark: {
      primary: '48 96% 53%',
      foreground: '48 96% 10%',
      background: '48 15% 12%',
      card: '48 15% 14%',
      muted: '48 10% 22%',
      border: '48 10% 27%',
      input: '48 10% 27%',
    },
  },
  pink: {
    light: {
      primary: '327 86% 59%',
      foreground: '327 85% 95%',
      background: '327 60% 94%',
      card: '327 60% 96%',
      muted: '327 50% 90%',
      border: '327 30% 85%',
      input: '327 30% 88%',
    },
    dark: {
      primary: '327 86% 59%',
      foreground: '327 85% 95%',
      background: '327 15% 12%',
      card: '327 15% 14%',
      muted: '327 10% 22%',
      border: '327 10% 27%',
      input: '327 10% 27%',
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('orange');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // This effect runs once on mount to restore theme from localStorage
  useEffect(() => {
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    const storedDarkMode = localStorage.getItem('app-theme-mode');

    const initialTheme = storedTheme && THEMES[storedTheme] ? storedTheme : 'orange';
    const initialDarkMode = storedDarkMode ? storedDarkMode === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    setTheme(initialTheme);
    setIsDarkMode(initialDarkMode);
    setIsMounted(true); // Signal that the initial theme has been loaded
  }, []);

  // This effect applies the theme whenever it changes, but only after mounting
  useEffect(() => {
    if (isMounted) {
      const root = document.documentElement;
      root.classList.toggle('dark', isDarkMode);

      const themeColors = THEMES[theme][isDarkMode ? 'dark' : 'light'];
      
      const varsToSet = {
        '--background': themeColors.background,
        '--primary': themeColors.primary,
        '--primary-foreground': themeColors.foreground,
        '--card': themeColors.card,
        '--popover': themeColors.card,
        '--secondary': themeColors.muted,
        '--muted': themeColors.muted,
        '--accent': themeColors.primary,
        '--accent-foreground': themeColors.foreground,
        '--border': themeColors.border,
        '--input': themeColors.input,
        '--ring': themeColors.primary,
        '--sidebar-background': themeColors.card,
        '--sidebar-primary': themeColors.primary,
        '--sidebar-primary-foreground': themeColors.foreground,
        '--sidebar-accent': themeColors.muted,
        '--sidebar-border': themeColors.border,
        '--sidebar-ring': themeColors.primary,
      };

      for (const [property, value] of Object.entries(varsToSet)) {
          root.style.setProperty(property, value);
      }
    }
  }, [theme, isDarkMode, isMounted]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('app-color-theme', newTheme);
  };

  const handleToggleTheme = () => {
    setIsDarkMode(prev => {
      const newIsDarkMode = !prev;
      localStorage.setItem('app-theme-mode', newIsDarkMode ? 'dark' : 'light');
      return newIsDarkMode;
    });
  };

  const value = {
    theme,
    setTheme: handleSetTheme,
    toggleTheme: handleToggleTheme,
    isDarkMode,
  };

  // We prevent rendering the children until the theme is mounted to avoid a flash of unstyled content
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
