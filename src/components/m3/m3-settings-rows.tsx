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

export const THEME_SWATCHES: { id: Theme; color: string }[] = [
  { id: 'orange', color: '#f97316' },
  { id: 'first_version', color: '#ffb300' },
  { id: 'purple', color: '#8b5cf6' },
  { id: 'blue', color: '#3b82f6' },
  { id: 'green', color: '#22c55e' },
  { id: 'red', color: '#ef4444' },
  { id: 'yellow', color: '#eab308' },
  { id: 'pink', color: '#ec4899' },
  { id: 'gray', color: '#6b7280' },
  { id: 'shining_gold', color: '#d4af37' },
  { id: 'custom', color: '#a855f7' },
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
