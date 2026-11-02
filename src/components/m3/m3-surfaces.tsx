'use client';

/**
 * Material 3 surfaces (cards, list rows, search field, avatars) for the
 * Material 3 edition. Not used by the classic Infinite 1.5 interface.
 *
 * Material 3 communicates hierarchy with tonal surfaces (surface-container-*)
 * and 1dp outlines rather than with drop shadows, so the cards below are flat.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Search, X } from 'lucide-react';

export function M3Card({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const classes = 'w-full rounded-2xl bg-m3-surface-container-low p-4 text-left';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, className)}>
        {children}
      </button>
    );
  }
  return <div className={cn(classes, className)}>{children}</div>;
}

export function M3SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn('m3-section-label', className)}>{children}</p>;
}

/** M3 list item: 72dp, 12dp corners, optional tonal leading icon. */
export function M3RowItem({
  icon: Icon,
  label,
  description,
  value,
  onClick,
  className,
  right,
}: {
  icon?: React.ElementType;
  label: React.ReactNode;
  description?: React.ReactNode;
  value?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={cn('m3-list-item', className)}>
      {Icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-m3-secondary-container text-m3-on-secondary-container">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-normal leading-6 text-m3-on-surface">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-[13px] leading-tight text-m3-on-surface-variant">
            {description}
          </span>
        )}
      </span>
      {value}
      {right ?? (
        <ChevronRight className="h-5 w-5 shrink-0 text-m3-on-surface-variant" />
      )}
    </button>
  );
}

/** M3 search bar: 56dp, fully rounded, surface-container-high. */
export function M3SearchBar({
  value,
  onChange,
  placeholder,
  onFocus,
  className,
  readOnly,
  onClick,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  className?: string;
  readOnly?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className={cn('m3-search-field', className)} onClick={onClick}>
      <Search className="m3-search-icon" />
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        readOnly={readOnly}
        placeholder={placeholder}
      />
      {!!value && !readOnly && (
        <button
          type="button"
          aria-label="clear"
          onClick={() => onChange?.('')}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-m3-on-surface-variant"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Tonal avatar colours: Material 3 containers, picked deterministically per name. */
const AVATAR_ROLES = [
  'bg-m3-primary-container text-m3-on-primary-container',
  'bg-m3-secondary-container text-m3-on-secondary-container',
  'bg-m3-tertiary-container text-m3-on-tertiary-container',
  'bg-m3-surface-container-highest text-m3-on-surface',
];

export function M3Avatar({
  name,
  src,
  size = 48,
  online,
  className,
  ring,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  online?: boolean;
  className?: string;
  ring?: boolean;
}) {
  const initials = (name || '?')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const colorIndex = (name || '').length % AVATAR_ROLES.length;

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={name || ''}
          className={cn(
            'h-full w-full rounded-full object-cover',
            ring ? 'ring-2 ring-m3-primary/40 ring-offset-2 ring-offset-m3-surface' : ''
          )}
        />
      ) : (
        <span
          className={cn(
            'flex h-full w-full items-center justify-center rounded-full font-medium',
            AVATAR_ROLES[colorIndex]
          )}
          style={{ fontSize: Math.max(12, Math.round(size * 0.34)) }}
        >
          {initials || '?'}
        </span>
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-m3-surface bg-emerald-500" />
      )}
    </span>
  );
}

export function M3EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-4 bg-m3-surface px-8 text-center',
        className
      )}
    >
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-m3-surface-container-high text-m3-on-surface-variant">
        <Icon className="h-9 w-9" />
      </span>
      <div className="space-y-1">
        <p className="text-xl font-normal text-m3-on-surface">{title}</p>
        {description && (
          <p className="text-sm text-m3-on-surface-variant">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
