'use client';

import { useEffect } from 'react';

export function DebugConsole() {
  useEffect(() => {
    // Консоль появится только если добавить ?debug=true в конец ссылки
    // или можно убрать условие if, чтобы она была всегда на превью-ветках
    if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
      import('eruda').then((eruda) => {
        eruda.default.init();
      });
    }
  }, []);

  return null;
}