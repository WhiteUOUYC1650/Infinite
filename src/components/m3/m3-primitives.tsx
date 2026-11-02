'use client';

/**
 * Material 3 primitives (chrome) for the "Material 3" edition of Infinite.
 *
 * Completely separate from the classic Infinite 1.5 interface: the 1.5 build
 * never imports anything from src/components/m3. Styles live in
 * ./m3-theme.css and only apply while [data-material3="true"] is set.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export function M3Screen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col bg-background', className)}>
      {children}
    </div>
  );
}

export function M3TopAppBar({
  title,
  subtitle,
  leading,
  trailing,
  avatar,
  onTitleClick,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  avatar?: React.ReactNode;
  onTitleClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex flex-col gap-2 px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {leading}
        {avatar}
        <button
          type="button"
          onClick={onTitleClick}
          disabled={!onTitleClick}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          {title && (
            <p className="truncate text-[17px] font-medium leading-tight text-foreground">{title}</p>
          )}
          {subtitle && (
            <p className="truncate text-xs font-normal leading-tight text-muted-foreground">
              {subtitle}
            </p>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1">{trailing}</div>
      </div>
      {children}
    </header>
  );
}

export function M3IconButton({
  icon: Icon,
  label,
  onClick,
  className,
  active,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors',
        active ? 'bg-primary/15 text-primary' : 'hover:bg-foreground/5',
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

export function M3FilledButton({
  children,
  onClick,
  icon: Icon,
  className,
  disabled,
  type = 'button',
  variant = 'filled',
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  icon?: React.ElementType;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
}) {
  const variants: Record<string, string> = {
    filled: 'bg-primary text-primary-foreground',
    tonal: 'bg-primary/15 text-primary',
    outlined: 'border border-foreground/15 text-foreground',
    text: 'text-primary',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors disabled:opacity-50',
        variants[variant],
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function M3Fab({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95',
        className
      )}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}

export function M3Chip({
  label,
  icon: Icon,
  onClick,
  active,
  className,
}: {
  label: React.ReactNode;
  icon?: React.ElementType;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground/80 shadow-sm',
        className
      )}
    >
      {Icon && (
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary-foreground' : 'text-primary')} />
      )}
      {label}
    </button>
  );
}
