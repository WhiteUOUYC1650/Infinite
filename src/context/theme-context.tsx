'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';

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
  const [theme, setTheme] = useState<Theme>('orange');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    const currentTheme = storedTheme && THEMES.includes(storedTheme) ? storedTheme : 'orange';
    
    const storedDarkMode = localStorage.getItem('app-theme-mode');
    const initialDarkMode = storedDarkMode === 'dark' || (!storedDarkMode && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    // Apply classes on initial load
    document.documentElement.classList.toggle('dark', initialDarkMode);
    THEMES.forEach(t => document.documentElement.classList.remove(`theme-${t}`));
    document.documentElement.classList.add(`theme-${currentTheme}`);

    // Set state after applying classes to avoid flicker
    setTheme(currentTheme);
    setIsDarkMode(initialDarkMode);

  }, []);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(prevTheme => {
      document.documentElement.classList.remove(`theme-${prevTheme}`);
      document.documentElement.classList.add(`theme-${newTheme}`);
      localStorage.setItem('app-color-theme', newTheme);
      return newTheme;
    });
  };
  
  const toggleTheme = () => {
    setIsDarkMode(prevIsDarkMode => {
      const newIsDarkMode = !prevIsDarkMode;
      localStorage.setItem('app-theme-mode', newIsDarkMode ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', newIsDarkMode);
      return newIsDarkMode;
    });
  }

  const value = {
    theme,
    setTheme: handleSetTheme,
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
