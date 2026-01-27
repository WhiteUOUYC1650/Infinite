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
  // Start with default values. These will be used for the server-rendered HTML.
  const [theme, setTheme] = useState<Theme>('orange');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // This effect runs only on the client, after the initial render.
  // It reads the saved preferences from localStorage and updates the state.
  // This avoids a server-client mismatch on the first render.
  useEffect(() => {
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    if (storedTheme && THEMES.includes(storedTheme)) {
      setTheme(storedTheme);
    }
    
    const storedDarkMode = localStorage.getItem('app-theme-mode');
    if (storedDarkMode) {
      setIsDarkMode(storedDarkMode === 'dark');
    } else {
      // If no preference is stored, use the browser/OS setting.
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  // This effect runs whenever the theme or dark mode state changes.
  // It applies the classes to the HTML element and saves the new preferences to localStorage.
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
