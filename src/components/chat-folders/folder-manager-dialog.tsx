'use client';

/**
 * Folder manager: create / rename / delete folders and pick which chats belong
 * to each of them. Works in every edition (the dialog is styled per edition).
 */

import React, { useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/language-context';
import type { Chat, ChatFolder } from '@/types';

export function FolderManagerDialog({
  open,
  onOpenChange,
  folders,
  chats,
  chatTitle,
  onCreate,
  onRename,
  onDelete,
  onToggleChat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: ChatFolder[];
  chats: Chat[];
  chatTitle: (chat: Chat) => string;
  onCreate: (name: string, emoji?: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggleChat: (id: string, chatId: string) => void;
}) {
  const { t } = useLanguage();
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('📁');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name, newEmoji.trim() || '📁');
    setNewName('');
    setNewEmoji('📁');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">{t('folders_title')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('folders_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value)}
            maxLength={2}
            className="h-10 w-12 shrink-0 text-center"
            aria-label={t('folder_emoji')}
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={t('folder_name')}
            className="h-10 flex-1"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            aria-label={t('create_folder')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="no-scrollbar max-h-[56vh] space-y-2 overflow-y-auto pr-0.5">
          {folders.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('folders_empty')}</p>
          )}

          {folders.map((folder) => {
            const isOpen = expanded === folder.id;
            return (
              <div key={folder.id} className="rounded-[1.25rem] bg-muted/40">
                <div className="flex items-center gap-2 p-2.5">
                  <span className="text-lg leading-none">{folder.emoji || '📁'}</span>

                  {renaming === folder.id ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (renameValue.trim()) onRename(folder.id, renameValue.trim());
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (renameValue.trim()) onRename(folder.id, renameValue.trim());
                          setRenaming(null);
                        }
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      className="h-8 flex-1"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : folder.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="truncate text-sm font-medium">{folder.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {folder.chatIds.length}
                      </span>
                      <ChevronDown
                        className={cn(
                          'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          isOpen && 'rotate-180'
                        )}
                      />
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label={t('rename')}
                    onClick={() => {
                      setRenaming(folder.id);
                      setRenameValue(folder.name);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('delete')}
                    onClick={() => onDelete(folder.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-border/50 p-1.5">
                    {chats.length === 0 ? (
                      <p className="p-2 text-center text-xs text-muted-foreground">{t('no_chats_yet')}</p>
                    ) : (
                      chats.map((chat) => {
                        const active = folder.chatIds.includes(chat.id);
                        return (
                          <button
                            key={chat.id}
                            type="button"
                            onClick={() => onToggleChat(folder.id, chat.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-foreground/5"
                          >
                            <span
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                                active
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border'
                              )}
                            >
                              {active && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <span className="truncate text-[13px]">{chatTitle(chat)}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
