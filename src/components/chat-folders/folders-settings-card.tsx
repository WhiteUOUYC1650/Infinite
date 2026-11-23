'use client';

/**
 * Settings entry point for chat folders (Settings → Chat settings).
 * Folder management lives here — the conversation list only shows the chips.
 */

import React, { useMemo, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { FolderPlus } from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { useLanguage } from '@/context/language-context';
import { useChatFolders } from '@/hooks/use-chat-folders';
import { useBatchUsers } from '@/hooks/use-batch-users';
import type { AuthenticatedUser, Chat } from '@/types';
import { FolderManagerDialog } from './folder-manager-dialog';

export function FoldersSettingsCard({ currentUser }: { currentUser: AuthenticatedUser }) {
  const db = useFirestore();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { folders, addFolder, updateFolder, deleteFolder } = useChatFolders(currentUser);

  const chatsQuery = useMemo(() => {
    if (!db || !currentUser.uid) return null;
    return query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid));
  }, [db, currentUser.uid]);
  const { data: chats } = useCollection<Chat>(chatsQuery as any);

  const dmIds = useMemo(
    () =>
      (chats || [])
        .filter((chat) => chat.type === 'dm')
        .map((chat) => chat.members.find((id) => id !== currentUser.uid))
        .filter(Boolean) as string[],
    [chats, currentUser.uid]
  );
  const { users } = useBatchUsers(dmIds);

  const chatTitle = (chat: Chat) => {
    if (chat.type === 'dm') {
      const other = users[chat.members.find((id) => id !== currentUser.uid) || ''];
      return other?.name || other?.username || chat.name || t('saved_messages');
    }
    return chat.name || '…';
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FolderPlus className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{t('folders_title')}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{t('folders_settings_desc')}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{folders.length}</span>
      </button>

      <FolderManagerDialog
        open={open}
        onOpenChange={setOpen}
        folders={folders}
        chats={chats || []}
        chatTitle={chatTitle}
        onCreate={(name, emoji, chatIds) => addFolder(name, emoji, chatIds)}
        onUpdate={(id, patch) => updateFolder(id, patch)}
        onDelete={deleteFolder}
      />
    </>
  );
}
