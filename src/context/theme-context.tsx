'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const THEMES = {
  orange: {
    light: '25 95% 53%',
    dark: '25 95% 53%',
    foreground: '25 85% 95%',
    darkForeground: '25 85% 95%',
    lightBackground: '30 71% 92%',
    darkBackground: '20 10% 10%',
  },
  purple: {
    light: '259 87% 66%',
    dark: '259 87% 66%',
    foreground: '259 85% 95%',
    darkForeground: '259 85% 95%',
    lightBackground: '259 60% 94%',
    darkBackground: '259 15% 12%',
  },
  blue: {
    light: '217 91% 60%',
    dark: '217 91% 55%',
    foreground: '217 83% 98%',
    darkForeground: '217 83% 98%',
    lightBackground: '217 60% 94%',
    darkBackground: '217 15% 12%',
  },
  gray: {
    light: '220 9% 45%',
    dark: '220 9% 55%',
    foreground: '220 15% 98%',
    darkForeground: '220 20% 10%',
    lightBackground: '220 10% 94%',
    darkBackground: '220 5% 12%',
  },
  green: {
    light: '145 63% 42%',
    dark: '145 63% 37%',
    foreground: '145 76% 98%',
    darkForeground: '145 76% 98%',
    lightBackground: '145 30% 94%',
    darkBackground: '145 15% 12%',
  },
  red: {
    light: '0 84% 60%',
    dark: '0 84% 55%',
    foreground: '0 72% 98%',
    darkForeground: '0 72% 98%',
    lightBackground: '0 60% 94%',
    darkBackground: '0 15% 12%',
  },
  yellow: {
    light: '48 96% 53%',
    dark: '48 96% 53%',
    foreground: '48 96% 10%',
    darkForeground: '48 96% 10%',
    lightBackground: '48 60% 94%',
    darkBackground: '48 15% 12%',
  },
  pink: {
    light: '327 86% 59%',
    dark: '327 86% 59%',
    foreground: '327 85% 95%',
    darkForeground: '327 85% 95%',
    lightBackground: '327 60% 94%',
    darkBackground: '327 15% 12%',
  },
} as const;

type Theme = keyof typeof THEMES;

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('orange');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    const storedDarkMode = localStorage.getItem('app-theme-mode');

    if (storedTheme && THEMES[storedTheme]) {
      setThemeState(storedTheme);
    }
    
    if (storedDarkMode) {
      setIsDarkMode(storedDarkMode === 'dark');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    setIsMounted(true);
  }, []);

  const applyTheme = useCallback((themeToApply: Theme, darkMode: boolean) => {
    const doc = document.documentElement;
    doc.classList.toggle('dark', darkMode);

    const colorMode = darkMode ? 'dark' : 'light';
    const themeColors = THEMES[themeToApply];
    
    const primaryColor = themeColors[colorMode];
    const foregroundColor = darkMode ? themeColors.darkForeground : themeColors.foreground;
    const backgroundColor = darkMode ? themeColors.darkBackground : themeColors.lightBackground;
    
    doc.style.setProperty('--primary', primaryColor);
    doc.style.setProperty('--primary-foreground', foregroundColor);
    doc.style.setProperty('--accent', primaryColor);
    doc.style.setProperty('--accent-foreground', foregroundColor);
    doc.style.setProperty('--ring', primaryColor);
    doc.style.setProperty('--sidebar-primary', primaryColor);
    doc.style.setProperty('--sidebar-primary-foreground', foregroundColor);
    doc.style.setProperty('--sidebar-ring', primaryColor);
    doc.style.setProperty('--background', backgroundColor);
  }, []);

  useEffect(() => {
    if (isMounted) {
      applyTheme(theme, isDarkMode);
    }
  }, [theme, isDarkMode, isMounted, applyTheme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('app-color-theme', newTheme);
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newIsDarkMode = !prev;
      localStorage.setItem('app-theme-mode', newIsDarkMode ? 'dark' : 'light');
      return newIsDarkMode;
    });
  };

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDarkMode,
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
