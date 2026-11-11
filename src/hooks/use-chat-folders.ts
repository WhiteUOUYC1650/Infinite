'use client';

/**
 * User-defined chat folders.
 *
 * Stored on the user document (`users/{uid}.chatFolders`) so the folders follow
 * the account across devices. The hook keeps an optimistic local copy so the UI
 * reacts instantly, even when offline.
 */

import { useCallback, useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { AuthenticatedUser, ChatFolder } from '@/types';

export function useChatFolders(currentUser: AuthenticatedUser) {
  const db = useFirestore();
  const [folders, setFolders] = useState<ChatFolder[]>(currentUser.chatFolders || []);

  useEffect(() => {
    setFolders(currentUser.chatFolders || []);
  }, [currentUser.chatFolders]);

  const save = useCallback(
    async (next: ChatFolder[]) => {
      setFolders(next);
      if (!db || !currentUser.uid) return;
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { chatFolders: next });
      } catch (e) {
        console.error('Could not save chat folders', e);
      }
    },
    [db, currentUser.uid]
  );

  const addFolder = useCallback(
    (name: string, emoji?: string, chatIds: string[] = []) => {
      const folder: ChatFolder = {
        id: Math.random().toString(36).slice(2, 9),
        name: name.trim(),
        emoji: emoji || '📁',
        chatIds,
      };
      void save([...folders, folder]);
      return folder;
    },
    [folders, save]
  );

  const updateFolder = useCallback(
    (id: string, patch: Partial<Omit<ChatFolder, 'id'>>) => {
      void save(folders.map((folder) => (folder.id === id ? { ...folder, ...patch } : folder)));
    },
    [folders, save]
  );

  const deleteFolder = useCallback(
    (id: string) => {
      void save(folders.filter((folder) => folder.id !== id));
    },
    [folders, save]
  );

  const toggleChatInFolder = useCallback(
    (id: string, chatId: string) => {
      void save(
        folders.map((folder) =>
          folder.id === id
            ? {
                ...folder,
                chatIds: folder.chatIds.includes(chatId)
                  ? folder.chatIds.filter((existing) => existing !== chatId)
                  : [...folder.chatIds, chatId],
              }
            : folder
        )
      );
    },
    [folders, save]
  );

  return { folders, addFolder, updateFolder, deleteFolder, toggleChatInFolder };
}
