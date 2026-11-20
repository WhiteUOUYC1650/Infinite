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
    <div className={cn('flex h-full min-h-0 w-full flex-col bg-m3-surface', className)}>
      {children}
    </div>
  );
}

/**
 * M3 top app bar — small (56dp) or large (title on its own row, as on the
 * Material 3 home screen). Flush with the surface, no elevation.
 */
export function M3TopAppBar({
  title,
  subtitle,
  leading,
  trailing,
  avatar,
  large,
  onTitleClick,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  avatar?: React.ReactNode;
  /** Large top app bar: title below the icon row. */
  large?: boolean;
  onTitleClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const titleNode = (
    <>
      {title && <span className="m3-app-bar-title block truncate">{title}</span>}
      {subtitle && !large && (
        <span className="m3-app-bar-subtitle block truncate">{subtitle}</span>
      )}
    </>
  );

  return (
    <header className={cn('m3-app-bar sticky top-0 z-30', className)}>
      <div className="m3-app-bar-row">
        {leading}
        {avatar}
        {large ? (
          <span className="flex-1" />
        ) : (
          <button
            type="button"
            onClick={onTitleClick}
            disabled={!onTitleClick}
            className="min-w-0 flex-1 text-left disabled:cursor-default"
          >
            {titleNode}
          </button>
        )}
        <div className="flex shrink-0 items-center">{trailing}</div>
      </div>
      {large && (
        <div className="px-2 pb-2 pt-1">
          {onTitleClick ? (
            <button type="button" onClick={onTitleClick} className="block w-full text-left">
              {titleNode}
            </button>
          ) : (
            titleNode
          )}
        </div>
      )}
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
  filled,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  active?: boolean;
  disabled?: boolean;
  /** Filled icon button (primary container) — M3 "filled" emphasis. */
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      data-active={active ? 'true' : undefined}
      className={cn(
        'm3-icon-button',
        filled && 'bg-m3-primary-container text-m3-on-primary-container',
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

/** M3 button: filled / tonal / outlined / text. 40dp tall, pill shaped. */
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
    filled: 'bg-m3-primary text-m3-on-primary',
    tonal: 'bg-m3-secondary-container text-m3-on-secondary-container',
    outlined: 'border border-m3-outline text-m3-primary bg-transparent',
    text: 'text-m3-primary bg-transparent',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors disabled:opacity-40',
        variants[variant],
        className
      )}
    >
      {Icon && <Icon className="h-[18px] w-[18px]" />}
      {children}
    </button>
  );
}

/** M3 FAB — 56dp, 16dp corners, primary container, elevation 3. */
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
      title={label}
      onClick={onClick}
      className={cn('m3-fab', className)}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}

/** M3 filter chip — 32dp, 8dp corners, outlined / selected tonal. */
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
      aria-pressed={active ? 'true' : 'false'}
      className={cn('m3-chip', className)}
    >
      {Icon && <Icon className="m3-chip-glyph h-[18px] w-[18px]" />}
      {label}
    </button>
  );
}

/** M3 navigation bar destination (icon in a pill indicator + label). */
export function M3NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="m3-nav-item"
    >
      <span className="m3-nav-item-indicator relative">
        <Icon className="h-6 w-6" />
        {!!badge && badge > 0 && (
          <span className="m3-badge absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="m3-nav-item-label">{label}</span>
    </button>
  );
}

/** M3 navigation bar — 80dp, surface-container, pill indicators. */
export function M3NavigationBar({ children }: { children: React.ReactNode }) {
  return <nav className="m3-nav-bar shrink-0">{children}</nav>;
}
