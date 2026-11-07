'use client';

/**
 * Folder manager: create / rename / delete folders and pick the chats of each
 * folder. Opened from Settings → Chat settings (the conversation list only
 * shows the resulting folders as chips).
 */

import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/language-context';
import type { Chat, ChatFolder } from '@/types';

type Editing = { mode: 'create' } | { mode: 'edit'; id: string };

export function FolderManagerDialog({
  open,
  onOpenChange,
  folders,
  chats,
  chatTitle,
  onCreate,
  onUpdate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: ChatFolder[];
  chats: Chat[];
  chatTitle: (chat: Chat) => string;
  onCreate: (name: string, emoji?: string, chatIds?: string[]) => void;
  onUpdate: (id: string, patch: Partial<Omit<ChatFolder, 'id'>>) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState<Editing>({ mode: 'create' });
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const resetForm = () => {
    setEditing({ mode: 'create' });
    setName('');
    setEmoji('📁');
    setSelected([]);
    setQuery('');
  };

  const startEdit = (folder: ChatFolder) => {
    setEditing({ mode: 'edit', id: folder.id });
    setName(folder.name);
    setEmoji(folder.emoji || '📁');
    setSelected(folder.chatIds || []);
    setQuery('');
  };

  const toggleChat = (chatId: string) => {
    setSelected((prev) => (prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]));
  };

  const visibleChats = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return chats;
    return chats.filter((chat) => chatTitle(chat).toLowerCase().includes(needle));
  }, [chats, query, chatTitle]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing.mode === 'create') {
      onCreate(trimmed, emoji.trim() || '📁', selected);
    } else {
      onUpdate(editing.id, { name: trimmed, emoji: emoji.trim() || '📁', chatIds: selected });
    }
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent hideCloseButton className="flex max-h-[88vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <DialogTitle className="text-lg font-semibold">{t('folders_title')}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('folders_settings_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* name + emoji */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {editing.mode === 'create' ? t('new_folder') : t('folders_title')}
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={2}
                aria-label={t('folder_emoji')}
                className="h-10 w-12 shrink-0 text-center"
              />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder={t('folder_name')}
                className="h-10 min-w-0 flex-1"
              />
            </div>
          </div>

          {/* chats of the folder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t('choose_chats')}
              </p>
              <span className="text-[11px] text-muted-foreground">{selected.length}</span>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="h-9"
            />
            <div className="max-h-56 overflow-y-auto rounded-xl border">
              {visibleChats.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t('no_chats_yet')}</p>
              ) : (
                visibleChats.map((chat) => {
                  const active = selected.includes(chat.id);
                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => toggleChat(chat.id)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                        active ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60'
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{chatTitle(chat)}</span>
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                          active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* existing folders */}
          {folders.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t('folders_title')}
              </p>
              <div className="space-y-1">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2',
                      editing.mode === 'edit' && editing.id === folder.id && 'border-primary/60 bg-primary/5'
                    )}
                  >
                    <span className="shrink-0">{folder.emoji || '📁'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{folder.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{folder.chatIds.length}</span>
                    <button
                      type="button"
                      aria-label={t('edit')}
                      onClick={() => startEdit(folder)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('delete')}
                      onClick={() => { onDelete(folder.id); if (editing.mode === 'edit' && editing.id === folder.id) resetForm(); }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {editing.mode === 'edit' && (
            <Button variant="ghost" onClick={resetForm} className="h-11 flex-1 rounded-xl font-semibold">
              {t('cancel')}
            </Button>
          )}
          <Button onClick={save} disabled={!name.trim()} className="h-11 flex-1 rounded-xl font-semibold">
            {editing.mode === 'create' ? <Plus className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
            {editing.mode === 'create' ? t('new_folder') : t('save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
