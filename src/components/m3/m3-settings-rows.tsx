'use client';

/**
 * Shared building blocks for the Material 3 settings pages.
 */

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { Theme } from '@/context/theme-context';

export function M3ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon?: React.ElementType;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', disabled && 'opacity-50')}>
      {Icon && <Icon className="h-5 w-5 shrink-0 text-m3-on-surface-variant" />}
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-6 text-m3-on-surface">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[13px] leading-tight text-m3-on-surface-variant">
            {description}
          </span>
        )}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

/**
 * Material 3 palette only: the special/legacy themes (First version, Shining
 * gold, Theme Studio) are intentionally not offered in the M3 edition.
 */
export const THEME_SWATCHES: { id: Theme; color: string }[] = [
  { id: 'red', color: '#f44336' },
  { id: 'pink', color: '#e91e63' },
  { id: 'purple', color: '#9c27b0' },
  { id: 'deep_purple', color: '#673ab7' },
  { id: 'indigo', color: '#3f51b5' },
  { id: 'blue', color: '#2196f3' },
  { id: 'light_blue', color: '#03a9f4' },
  { id: 'cyan', color: '#00bcd4' },
  { id: 'teal', color: '#009688' },
  { id: 'green', color: '#4caf50' },
  { id: 'light_green', color: '#8bc34a' },
  { id: 'lime', color: '#cddc39' },
  { id: 'yellow', color: '#ffeb3b' },
  { id: 'amber', color: '#ffc107' },
  { id: 'orange', color: '#ff9800' },
  { id: 'deep_orange', color: '#ff5722' },
  { id: 'brown', color: '#795548' },
  { id: 'gray', color: '#9e9e9e' },
  { id: 'blue_grey', color: '#607d8b' },
];

export function M3ThemeSwatches({
  value,
  onChange,
  labelFor,
}: {
  value: Theme;
  onChange: (theme: Theme) => void;
  labelFor: (id: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-3 px-4 py-3">
      {THEME_SWATCHES.map((swatch) => {
        const active = value === swatch.id;
        return (
          <button
            key={swatch.id}
            type="button"
            onClick={() => onChange(swatch.id)}
            aria-label={labelFor(swatch.id)}
            className="flex w-[68px] flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full transition-transform',
                active ? 'ring-2 ring-m3-primary ring-offset-2 ring-offset-m3-surface' : ''
              )}
              style={{ backgroundColor: swatch.color }}
            >
              {active && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
            </span>
            <span className="w-full truncate text-center text-[11px] leading-tight text-m3-on-surface-variant">
              {labelFor(swatch.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
