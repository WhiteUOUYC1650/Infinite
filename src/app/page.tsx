'use client';

import { AppShell } from '@/components/app-shell';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, setDoc, getDoc, collection, addDoc, Timestamp, updateDoc, increment } from 'firebase/firestore';
import type { User } from '@/types';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // If an account is being deleted, don't do anything.
    const isDeleting = localStorage.getItem('isDeletingAccount');
    if (isDeleting) return;

    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }
    
    if (!db || !auth) return;

    const checkSecurity = async () => {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            const isVerified = localStorage.getItem('isVerified') === 'true';
            
            if (data.loginProtectionEnabled && !isVerified) {
                router.push('/login');
                return;
            }
            
            // User is valid and verified
            setIsVerifying(false);
            
            // Set user to online
            setDoc(userRef, { status: 'online' }, { merge: true });

            // --- Bot Login Message Logic ---
            const justLoggedIn = localStorage.getItem('justLoggedIn');
            if (justLoggedIn) {
              localStorage.removeItem('justLoggedIn');

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
                      senderId: user.uid,
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
            }
        } else {
            setIsVerifying(false);
        }
    };

    checkSecurity();

    const handleVisibilityChange = () => {
      if (!auth.currentUser) return;
      const newStatus = document.visibilityState === 'hidden' ? 'away' : 'online';
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, { status: newStatus }, { merge: true });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, authLoading, router, db, auth]);

  if (authLoading || isVerifying || !user) {
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
  }

  return <AppShell user={user} />;
}
