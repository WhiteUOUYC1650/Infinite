'use client';

import { AppShell } from '@/components/app-shell';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { doc, setDoc, getDoc, collection, addDoc, Timestamp, updateDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User } from '@/types';
import { Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export default function Home() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const sessionRegistered = useRef(false);

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

    const userRef = doc(db, 'users', user.uid);

    const incrementSession = async () => {
      if (sessionRegistered.current) return;
      sessionRegistered.current = true;
      try {
        await updateDoc(userRef, { 
          'current-sessions': increment(1),
          status: 'online',
          lastSeen: serverTimestamp()
        });
      } catch (e) {
        console.error("Failed to increment session:", e);
      }
    };

    const decrementSession = async () => {
      if (!sessionRegistered.current) return;
      sessionRegistered.current = false;
      
      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(userRef);
          if (!snap.exists()) return;
          
          const current = snap.data()?.['current-sessions'] || 0;
          const newVal = Math.max(0, current - 1);
          
          const updateData: any = { 'current-sessions': newVal };
          if (newVal === 0) {
            updateData.status = 'offline';
            updateData.lastSeen = serverTimestamp();
          }
          
          transaction.update(userRef, updateData);
        });
      } catch (e) {
        console.error("Failed to decrement session:", e);
      }
    };

    const checkSecurity = async () => {
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
            
            // Register session
            incrementSession();

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

    // App state management (Capacitor)
    let appListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        appListener = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) incrementSession();
          else decrementSession();
        });
      });
    }

    // Web fallback
    const handleBeforeUnload = () => {
      decrementSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Heartbeat to keep online status while window is active
    const interval = setInterval(() => {
      if (auth.currentUser) {
        setDoc(userRef, { status: 'online', lastSeen: serverTimestamp() }, { merge: true });
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (appListener) appListener.remove();
      decrementSession();
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
