'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { translations, Language, TranslationKey, interpolate } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: Record<string, any>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('ru'); // Default to Russian

  useEffect(() => {
    const storedLang = localStorage.getItem('app-lang') as Language | null;
    if (storedLang && translations[storedLang]) {
      setLanguage(storedLang);
    } else {
      // Try to detect browser language
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'es') setLanguage('es');
      else if (browserLang === 'pt') setLanguage('pt-BR');
      else if (browserLang === 'ru') setLanguage('ru');
      else setLanguage('en');
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app-lang', lang);
  };

  const t = useMemo(
    () =>
      (key: TranslationKey, values?: Record<string, any>): string => {
        const translationString = translations[language]?.[key] || translations['en'][key];
        if (values) {
          // Pass the current language to interpolate for correct plural rules
          return interpolate(translationString, values, language);
        }
        return translationString;
      },
    [language]
  );

  const value = {
    language,
    setLanguage: handleSetLanguage,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
