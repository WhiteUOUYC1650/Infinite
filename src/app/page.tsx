'use client';

import { AppShell } from '@/components/app-shell';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { doc, setDoc, getDoc, collection, addDoc, Timestamp, updateDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User } from '@/types';
import { Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';

export default function Home() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const sessionRegistered = useRef(false);

  useEffect(() => {
    const isDeleting = typeof window !== 'undefined' && sessionStorage.getItem('isDeletingAccount');
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
          lastSeen: serverTimestamp(),
          activeSessionId: sessionId
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
          
          const data = snap.data();
          const current = data?.['current-sessions'] || 0;
          const newVal = Math.max(0, current - 1);
          
          const updateData: any = { 'current-sessions': newVal };
          if (newVal === 0) {
            updateData.status = 'offline';
            updateData.lastSeen = serverTimestamp();
          }
          
          if (data?.activeSessionId === sessionId) {
              updateData.activeSessionId = null;
          }
          
          transaction.update(userRef, updateData);
        });
      } catch (e) {
        console.error("Failed to decrement session:", e);
      }
    };

    const checkSecurity = async () => {
        try {
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                
                // 0.6 Beta: Verify beta-tester status for existing session
                const isBetaTester = data.isBetaTester;
                const isAdmin = data.username === '@Infinite';
                const isBot = data.isBot || data.isCustomBot;

                if (!isBetaTester && !isAdmin && !isBot) {
                  await auth.signOut();
                  toast({
                    variant: 'destructive',
                    title: t('sign_in_failed_toast_title'),
                    description: t('access_denied_beta_only'),
                  });
                  router.push('/login');
                  return;
                }

                const isVerified = localStorage.getItem('isVerified') === 'true';
                
                if (data.loginProtectionEnabled && !isVerified) {
                    router.push('/login');
                    return;
                }
                
                setIsVerifying(false);
                incrementSession();

                const justLoggedIn = localStorage.getItem('justLoggedIn');
                if (justLoggedIn) {
                  localStorage.removeItem('justLoggedIn');

                  try {
                    const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/Infinite'));
                    const botLinkSnap = await getDoc(botLinkRef);

                    if (botLinkSnap.exists()) {
                      const botId = botLinkSnap.data().botId;
                      const botUserSnap = await getDoc(doc(db, 'users', botId));

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

                        const msgRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
                          senderId: botId,
                          type: 'announcement',
                          content: 'Welcome back!',
                          timestamp: serverTimestamp(),
                          senderName: botData.name,
                          senderAvatar: botData.avatar || null,
                        });
                        await updateDoc(chatRef, { 
                          lastMessage: { 
                            id: msgRef.id, 
                            content: 'Welcome back!', 
                            senderId: botId, 
                            senderName: botData.name, 
                            timestamp: Timestamp.now() 
                          } 
                        });
                      }
                    }
                  } catch (e) {
                    console.error('Failed to send bot login message', e);
                  }
                }
            } else {
                setIsVerifying(false);
            }
        } catch (e) {
            console.error("Security check failed:", e);
            setIsVerifying(false);
        }
    };

    checkSecurity();

    let appListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        appListener = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) incrementSession();
          else decrementSession();
        });
      });
    }

    const handleBeforeUnload = () => { decrementSession(); };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Heartbeat for online status (2 minutes)
    // Optimization: only run when tab is visible to save battery
    const interval = setInterval(() => {
      if (auth.currentUser && document.visibilityState === 'visible') {
        setDoc(userRef, { status: 'online', lastSeen: serverTimestamp(), activeSessionId: sessionId }, { merge: true });
      }
    }, 120000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (appListener) appListener.remove();
      decrementSession();
    };
  }, [user, authLoading, router, db, auth, sessionId, t, toast]);

  if (authLoading || isVerifying || !user) {
    return (
        <div className="flex h-svh items-center justify-center bg-background">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
  }

  return <AppShell user={user} sessionId={sessionId} />;
}
