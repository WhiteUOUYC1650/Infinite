'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const THEMES = {
  orange: { light: '25 95% 53%', dark: '25 95% 53%', foreground: '25 85% 95%', darkForeground: '25 85% 95%' },
  purple: { light: '255 91% 66%', dark: '255 91% 61%', foreground: '255 85% 98%', darkForeground: '255 85% 98%' },
  blue: { light: '217 91% 60%', dark: '217 91% 55%', foreground: '217 83% 98%', darkForeground: '217 83% 98%' },
  gray: { light: '220 9% 45%', dark: '220 9% 55%', foreground: '220 15% 98%', darkForeground: '220 20% 10%' },
  green: { light: '145 63% 42%', dark: '145 63% 37%', foreground: '145 76% 98%', darkForeground: '145 76% 98%' },
  red: { light: '0 84% 60%', dark: '0 84% 55%', foreground: '0 72% 98%', darkForeground: '0 72% 98%' },
  yellow: { light: '38 92% 50%', dark: '38 92% 45%', foreground: '38 96% 10%', darkForeground: '38 96% 10%' },
  pink: { light: '327 100% 50%', dark: '327 100% 45%', foreground: '327 81% 98%', darkForeground: '327 81% 98%' },
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
  const [theme, setThemeInternal] = useState<Theme>('orange');
  const [isDarkMode, setIsDarkModeInternal] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    if (storedTheme && THEMES[storedTheme]) {
      setThemeInternal(storedTheme);
    }
    
    const storedDarkMode = localStorage.getItem('app-theme-mode');
    if (storedDarkMode) {
      setIsDarkModeInternal(storedDarkMode === 'dark');
    } else {
      setIsDarkModeInternal(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  // Apply theme and dark mode changes to the DOM
  useEffect(() => {
    const doc = document.documentElement;
    doc.classList.toggle('dark', isDarkMode);

    const colorMode = isDarkMode ? 'dark' : 'light';
    const themeColors = THEMES[theme];
    
    const primaryColor = themeColors[colorMode];
    const foregroundColor = isDarkMode ? themeColors.darkForeground : themeColors.foreground;
    
    doc.style.setProperty('--primary', primaryColor);
    doc.style.setProperty('--primary-foreground', foregroundColor);
    doc.style.setProperty('--accent', primaryColor);
    doc.style.setProperty('--accent-foreground', foregroundColor);
    doc.style.setProperty('--ring', primaryColor);
    doc.style.setProperty('--sidebar-primary', primaryColor);
    doc.style.setProperty('--sidebar-primary-foreground', foregroundColor);
    doc.style.setProperty('--sidebar-ring', primaryColor);

  }, [theme, isDarkMode]);

  // Setters that also save to localStorage
  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('app-color-theme', newTheme);
    setThemeInternal(newTheme);
  };

  const toggleTheme = () => {
    setIsDarkModeInternal(prev => {
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

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
