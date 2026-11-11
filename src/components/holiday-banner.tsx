'use client';

/**
 * Holiday banner shown between the stories row and the chat folders.
 * Extracted from the classic sidebar so every edition can render the same card.
 */

import React from 'react';
import {
  Flag,
  Flower2,
  Heart,
  PartyPopper,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

export function HolidayBanner() {
  const { t } = useLanguage();
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const holidays = [
    { day: 1, month: 1, name: 'holiday_new_year', icon: PartyPopper, color: 'from-blue-500 to-cyan-400' },
    { day: 7, month: 1, name: 'holiday_christmas', icon: Sparkles, color: 'from-blue-600 to-indigo-500' },
    { day: 14, month: 2, name: 'holiday_valentines', icon: Heart, color: 'from-rose-500 to-pink-400' },
    { day: 23, month: 2, name: 'holiday_defenders', icon: ShieldCheck, color: 'from-red-600 to-orange-600' },
    { day: 8, month: 3, name: 'holiday_womens_day', icon: Flower2, color: 'from-pink-500 to-rose-400' },
    { day: 12, month: 4, name: 'holiday_cosmonautics', icon: Rocket, color: 'from-indigo-600 to-purple-500' },
    { day: 1, month: 5, name: 'holiday_labor_day', icon: Flag, color: 'from-red-500 to-orange-500' },
    { day: 9, month: 5, name: 'holiday_victory_day', icon: Star, color: 'from-orange-600 to-red-700' },
    { day: 12, month: 6, name: 'holiday_russia_day', icon: Flag, color: 'from-blue-500 to-red-500' },
    { day: 4, month: 11, name: 'holiday_unity_day', icon: Users, color: 'from-blue-600 to-red-600' },
    { day: 31, month: 12, name: 'holiday_new_year_eve', icon: PartyPopper, color: 'from-blue-500 to-purple-600' },
  ];
  const currentHoliday = holidays.find((holiday) => holiday.day === day && holiday.month === month);
  if (!currentHoliday) return null;
  const Icon = currentHoliday.icon;
  return (
    <div
      className={cn(
        'mx-2 my-1.5 flex items-center gap-3 rounded-2xl bg-gradient-to-r p-3 text-white shadow-lg shadow-primary/10',
        currentHoliday.color
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{t('today_is')}</p>
        <p className="truncate text-sm font-bold leading-tight">{t(currentHoliday.name as any)}</p>
      </div>
    </div>
  );
}
