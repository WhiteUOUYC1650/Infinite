'use client';

/**
 * Horizontal chip row with user folders above the chat list.
 * Used by the Material 3 list and the classic sidebar.
 */

import React from 'react';
import { FolderPlus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatFolder } from '@/types';

export function FolderChips({
  folders,
  activeId,
  onSelect,
  onManage,
  allLabel,
  manageLabel,
  className,
}: {
  folders: ChatFolder[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onManage: () => void;
  allLabel: string;
  manageLabel: string;
  className?: string;
}) {
  return (
    <div className={cn('no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto px-2 pb-1.5', className)}>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'h-8 shrink-0 rounded-full px-3.5 text-[12px] font-medium transition-colors',
          activeId === null ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground/75 shadow-sm'
        )}
      >
        {allLabel}
      </button>

      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onSelect(folder.id)}
          title={folder.name}
          className={cn(
            'flex h-8 max-w-[160px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition-colors',
            activeId === folder.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground/75 shadow-sm'
          )}
        >
          <span className="shrink-0">{folder.emoji || '📁'}</span>
          <span className="truncate">{folder.name}</span>
          <span className="shrink-0 opacity-60">{folder.chatIds.length}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={onManage}
        aria-label={manageLabel}
        title={manageLabel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-foreground/70 shadow-sm"
      >
        {folders.length ? <FolderPlus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
    </div>
  );
}
