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
  const [theme, setTheme] = useState<Theme>('orange');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Effect for initial load from localStorage
  useEffect(() => {
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    if (storedTheme && THEMES.includes(storedTheme)) {
      setTheme(storedTheme);
    }
    
    const storedDarkMode = localStorage.getItem('app-theme-mode');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDarkMode = storedDarkMode ? storedDarkMode === 'dark' : prefersDark;
    setIsDarkMode(initialDarkMode);
  }, []);

  // Effect to apply classes to document when theme or dark mode changes
  useEffect(() => {
    const doc = document.documentElement;
    
    // Apply dark mode class
    doc.classList.toggle('dark', isDarkMode);
    
    // Apply color theme class
    // Remove all possible theme classes before adding the new one
    THEMES.forEach(t => {
      if (doc.classList.contains(`theme-${t}`)) {
        doc.classList.remove(`theme-${t}`);
      }
    });
    doc.classList.add(`theme-${theme}`);
    
    // Persist changes to localStorage
    localStorage.setItem('app-color-theme', theme);
    localStorage.setItem('app-theme-mode', isDarkMode ? 'dark' : 'light');
  }, [theme, isDarkMode]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };
  
  const toggleTheme = () => {
    setIsDarkMode(prevIsDarkMode => !prevIsDarkMode);
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
