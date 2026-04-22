'use client';

import React, { useMemo } from 'react';
import { useTheme } from '@/context/theme-context';

export function Snowfall() {
  const { showSnowflakes } = useTheme();

  const snowflakes = useMemo(() => {
    if (!showSnowflakes) return [];
    return Array.from({ length: 30 }).map((_, i) => {
      const style = {
        left: `${Math.random() * 100}vw`,
        width: `${Math.random() * 2 + 1}px`,
        height: `${Math.random() * 2 + 1}px`,
        animationDelay: `${Math.random() * 10}s`,
        animationDuration: `${Math.random() * 8 + 7}s`,
      };
      return <div key={i} className="snowflake" style={style} />;
    });
  }, [showSnowflakes]);

  if (!showSnowflakes) {
    return null;
  }

  return <div className="fixed inset-0 pointer-events-none z-[101]">{snowflakes}</div>;
}
