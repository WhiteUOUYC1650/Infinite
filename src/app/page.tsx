'use client';

import { AppShell } from '@/components/app-shell';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { doc, setDoc, getDoc, query, where, collection, getDocs, addDoc, Timestamp, updateDoc, increment } from 'firebase/firestore';
import type { User } from '@/types';

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }
    
    if (!db || !auth) return;

    const userRef = doc(db, 'users', user.uid);

    // Set user to online when they connect
    setDoc(userRef, { status: 'online' }, { merge: true });

    // --- Bot Login Message Logic ---
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    if (justLoggedIn) {
      sessionStorage.removeItem('justLoggedIn');

      const sendLoginMessage = async () => {
        if (!db) return;
        try {
          const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/Infinite'));
          const botLinkSnap = await getDoc(botLinkRef);

          if (botLinkSnap.exists()) {
            const botId = botLinkSnap.data().botId;
            const botUserRef = doc(db, 'users', botId);
            const botUserSnap = await getDoc(botUserRef);

            if (botUserSnap.exists()) {
              const botData = botUserSnap.data() as User;
              const members = [user.uid, botId].sort();
              const chatId = members.join('_');
              const chatRef = doc(db, 'chats', chatId);

              const chatSnap = await getDoc(chatRef);
              if (!chatSnap.exists()) {
                await setDoc(chatRef, {
                  type: 'dm',
                  members: members,
                  unreadCounts: { [user.uid]: 1 },
                  icon: 'Bot',
                });
              } else {
                await updateDoc(chatRef, { [`unreadCounts.${user.uid}`]: increment(1) });
              }

              const messagesCollectionRef = collection(db, 'chats', chatId, 'messages');
              const loginMessage = {
                senderId: user.uid, // sender is current user to pass security rules
                type: 'announcement',
                content: 'Welcome back!',
                timestamp: Timestamp.now(),
                senderName: botData.name,
                senderAvatar: botData.avatar || null,
              };
              const msgRef = await addDoc(messagesCollectionRef, loginMessage);
              await updateDoc(chatRef, { lastMessage: { ...loginMessage, id: msgRef.id } });
            }
          }
        } catch (e) {
          console.error('Failed to send bot login message', e);
        }
      };

      sendLoginMessage();
    }
    // --- End Bot Login Message Logic ---


    const handleVisibilityChange = () => {
      if (!auth.currentUser) return;
      const newStatus = document.visibilityState === 'hidden' ? 'away' : 'online';
      setDoc(userRef, { status: newStatus }, { merge: true });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // 'offline' status is handled on explicit logout. If a user just closes the tab,
      // their status will remain 'away' as 'beforeunload' is not reliable for async operations.
    };
  }, [user, loading, router, db, auth]);

  if (loading || !user) {
    return (
        <div className="flex h-screen items-center justify-center">
            Loading...
        </div>
    );
  }

  return <AppShell user={user} />;
}
