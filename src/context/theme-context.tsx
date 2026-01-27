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
  // 1. Initialize state with defaults for server render and initial client render to avoid hydration errors.
  const [theme, setThemeInternal] = useState<Theme>('orange');
  const [isDarkMode, setIsDarkModeInternal] = useState(false);

  // 2. On the client side, after the component mounts, read the saved preferences from localStorage.
  useEffect(() => {
    const storedTheme = localStorage.getItem('app-color-theme') as Theme | null;
    if (storedTheme && THEMES.includes(storedTheme)) {
      setThemeInternal(storedTheme);
    }
    
    const storedDarkMode = localStorage.getItem('app-theme-mode');
    if (storedDarkMode) {
      setIsDarkModeInternal(storedDarkMode === 'dark');
    } else {
      // Fallback to the user's system preference if nothing is stored.
      setIsDarkModeInternal(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []); // The empty dependency array ensures this effect runs only once on mount.

  // 3. This effect is responsible *only* for applying the current theme state to the DOM.
  useEffect(() => {
    const doc = document.documentElement;
    
    // Remove all old theme classes and add the current one.
    THEMES.forEach(t => doc.classList.remove(`theme-${t}`));
    doc.classList.add(`theme-${theme}`);
    
    // Apply or remove the 'dark' class.
    doc.classList.toggle('dark', isDarkMode);
  }, [theme, isDarkMode]);

  // 4. Create wrapper functions for setting state that *also* write the new preference to localStorage.
  // This ensures the preference is saved as soon as the user makes a change.
  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('app-color-theme', newTheme); // Save preference.
    setThemeInternal(newTheme); // Update the component's state.
  };

  const toggleTheme = () => {
    setIsDarkModeInternal(prev => {
      const newIsDarkMode = !prev;
      localStorage.setItem('app-theme-mode', newIsDarkMode ? 'dark' : 'light'); // Save preference.
      return newIsDarkMode; // Update the component's state.
    });
  };

  // 5. Provide the state and the setter functions to the rest of the app.
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
