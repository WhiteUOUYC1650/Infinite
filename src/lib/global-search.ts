/**
 * Global search shared by the classic search dialog and the Material 3 search
 * screen, so both versions behave identically.
 */

import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { Chat, CustomGame, User } from '@/types';

export type GlobalSearchResult =
  | { type: 'user'; data: User }
  | { type: 'chat'; data: Chat }
  | { type: 'game'; data: CustomGame };

/** Runs the query the search dialog/screen uses (handles @user, /C/, /G/, /B/, /IG/). */
export async function runGlobalSearch(db: Firestore, rawQuery: string): Promise<GlobalSearchResult[]> {
  const searchQuery = rawQuery.trim();
  const foundResults: GlobalSearchResult[] = [];

  if (searchQuery.startsWith('@')) {
    const usernameSnap = await getDoc(doc(db, 'usernames', searchQuery));
    if (usernameSnap.exists()) {
      const userSnap = await getDoc(doc(db, 'users', usernameSnap.data().uid));
      if (userSnap.exists()) {
        foundResults.push({ type: 'user', data: { id: userSnap.id, ...userSnap.data() } as User });
      }
    }
    return foundResults;
  }

  if (searchQuery.startsWith('/C/') || searchQuery.startsWith('/G/') || searchQuery.startsWith('/B/')) {
    const linkCollection = searchQuery.startsWith('/B/') ? 'botLinks' : 'chatLinks';
    const linkSnap = await getDoc(doc(db, linkCollection, encodeURIComponent(searchQuery)));
    if (linkSnap.exists()) {
      if (linkCollection === 'botLinks') {
        const botUserSnap = await getDoc(doc(db, 'users', linkSnap.data().botId));
        if (botUserSnap.exists()) {
          foundResults.push({ type: 'user', data: { id: botUserSnap.id, ...botUserSnap.data() } as User });
        }
      } else {
        const chatSnap = await getDoc(doc(db, 'chats', linkSnap.data().chatId));
        if (chatSnap.exists()) {
          foundResults.push({ type: 'chat', data: { id: chatSnap.id, ...chatSnap.data() } as Chat });
        }
      }
    }
    return foundResults;
  }

  if (searchQuery.startsWith('/IG/')) {
    const linkSnap = await getDoc(doc(db, 'gameLinks', encodeURIComponent(searchQuery)));
    if (linkSnap.exists()) {
      const gameSnap = await getDoc(doc(db, 'customGames', linkSnap.data().gameId));
      if (gameSnap.exists()) {
        foundResults.push({ type: 'game', data: { id: gameSnap.id, ...gameSnap.data() } as CustomGame });
      }
    }
    return foundResults;
  }

  const upper = searchQuery + '\uf8ff';
  const [chatSnapshots, userSnapshots, gameSnapshots] = await Promise.all([
    getDocs(
      query(
        collection(db, 'chats'),
        where('type', 'in', ['group', 'channel']),
        where('name', '>=', searchQuery),
        where('name', '<=', upper)
      )
    ),
    getDocs(
      query(collection(db, 'users'), where('name', '>=', searchQuery), where('name', '<=', upper))
    ),
    getDocs(
      query(
        collection(db, 'customGames'),
        where('isActive', '==', true),
        where('name', '>=', searchQuery),
        where('name', '<=', upper)
      )
    ),
  ]);

  chatSnapshots.forEach((snapshot) => {
    foundResults.push({ type: 'chat', data: { id: snapshot.id, ...snapshot.data() } as Chat });
  });
  userSnapshots.forEach((snapshot) => {
    if (!foundResults.some((result) => result.type === 'user' && result.data.id === snapshot.id)) {
      foundResults.push({ type: 'user', data: { id: snapshot.id, ...snapshot.data() } as User });
    }
  });
  gameSnapshots.forEach((snapshot) => {
    foundResults.push({ type: 'game', data: { id: snapshot.id, ...snapshot.data() } as CustomGame });
  });

  return foundResults;
}

/** Returns the DM chat with `targetUserId`, creating the document when needed. */
export async function ensureDmChat(
  db: Firestore,
  currentUserId: string,
  targetUserId: string
): Promise<{ chatId: string; members: string[] }> {
  const members = [currentUserId, targetUserId].sort();
  const chatId = members.join('_');
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) {
    await setDoc(chatRef, {
      type: 'dm',
      members,
      unreadCounts: { [currentUserId]: 0, [targetUserId]: 0 },
    });
  }
  return { chatId, members };
}

/** Joins a group/channel if the user is not a member yet and returns the chat. */
export async function joinChatIfNeeded(db: Firestore, chat: Chat, userId: string): Promise<Chat> {
  if (chat.members?.includes(userId)) return chat;
  await updateDoc(doc(db, 'chats', chat.id), { members: arrayUnion(userId) });
  return { ...chat, members: [...chat.members, userId] };
}
