'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const THEMES = ['orange', 'purple', 'blue', 'gray', 'green', 'red', 'yellow', 'pink'] as const;
type Theme = (typeof THEMES)[number];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // We initialize state with a function to ensure localStorage is only accessed on the client.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'orange'; // Default for SSR
    }
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    return storedTheme && THEMES.includes(storedTheme) ? storedTheme : 'orange';
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
     if (typeof window === 'undefined') {
      return false; // Default for SSR
    }
    const storedDarkMode = localStorage.getItem('app-theme-mode');
    if (storedDarkMode) {
      return storedDarkMode === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // This effect runs whenever the theme or dark mode state changes on the client.
  useEffect(() => {
    const doc = document.documentElement;

    // Apply color theme
    THEMES.forEach(t => doc.classList.remove(`theme-${t}`));
    doc.classList.add(`theme-${theme}`);
    localStorage.setItem('app-color-theme', theme);

    // Apply dark mode
    doc.classList.toggle('dark', isDarkMode);
    localStorage.setItem('app-theme-mode', isDarkMode ? 'dark' : 'light');
    
  }, [theme, isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  }

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
