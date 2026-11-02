'use client';

/**
 * Material 3 surfaces (cards, rows, search, avatars) for the Material 3 edition.
 * Not used by the classic Infinite 1.5 interface.
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
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn('w-full rounded-[1.5rem] bg-card p-4 text-left', className)}
      >
        {children}
      </button>
    );
  }
  return <div className={cn('rounded-[1.5rem] bg-card p-4', className)}>{children}</div>;
}

export function M3SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground',
        className
      )}
    >
      {children}
    </p>
  );
}

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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-[1.5rem] bg-card p-3.5 text-left transition-colors hover:bg-card/70',
        className
      )}
    >
      {Icon && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-tight">{label}</span>
        {description && (
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      {value}
      {right ?? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}

export function M3SearchBar({
  value,
  onChange,
  placeholder,
  onFocus,
  className,
  readOnly,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        readOnly={readOnly}
        placeholder={placeholder}
        className="h-11 w-full rounded-full bg-card pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground"
      />
      {!!value && !readOnly && (
        <button
          type="button"
          aria-label="clear"
          onClick={() => onChange?.('')}
          className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

const AVATAR_COLORS = [
  'from-orange-400 to-rose-400',
  'from-sky-400 to-indigo-400',
  'from-emerald-400 to-teal-400',
  'from-fuchsia-400 to-purple-500',
  'from-amber-400 to-orange-500',
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
  const colorIndex = (name || '').length % AVATAR_COLORS.length;

  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={name || ''}
          className={cn(
            'h-full w-full rounded-full object-cover',
            ring ? 'ring-2 ring-primary/25 ring-offset-2 ring-offset-background' : ''
          )}
        />
      ) : (
        <span
          className={cn(
            'flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br text-sm font-medium text-white',
            AVATAR_COLORS[colorIndex]
          )}
        >
          {initials || '?'}
        </span>
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
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
    <div className={cn('flex h-full flex-col items-center justify-center gap-4 px-8 text-center', className)}>
      <span className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-primary/10 text-primary">
        <Icon className="h-9 w-9" />
      </span>
      <div className="space-y-1">
        <p className="text-lg font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
