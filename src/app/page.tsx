
'use client';

import { AppShell } from '@/components/app-shell';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { doc, setDoc, getDoc, collection, addDoc, Timestamp, updateDoc, increment, runTransaction, serverTimestamp, onSnapshot, deleteDoc } from 'firebase/firestore';
import type { User } from '@/types';
import { Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { BypassOverlay } from '@/components/proxy/bypass-overlay';
import { PinLockOverlay } from '@/components/security/pin-lock-overlay';

export default function Home() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLockedByPin, setIsLockedByPin] = useState(false);
  const [bypassActive, setBypassActive] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const connectivityTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const localPin = localStorage.getItem('app-local-pin');
    if (localPin) {
        setIsLockedByPin(true);
    }
  }, []);

  useEffect(() => {
    connectivityTimeout.current = setTimeout(() => {
        if (isVerifying && !isBlocked && !bypassActive) {
            setIsBlocked(true);
        }
    }, 8000); 

    const handleTriggerBypass = () => {
        setIsBlocked(true);
    };
    window.addEventListener('trigger-bypass', handleTriggerBypass);

    return () => { 
        if (connectivityTimeout.current) clearTimeout(connectivityTimeout.current); 
        window.removeEventListener('trigger-bypass', handleTriggerBypass);
    };
  }, [isVerifying, isBlocked, bypassActive]);

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
    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);

    // Multi-device Presence Logic
    const updateSessionPresence = async (active: boolean) => {
        try {
            await setDoc(sessionRef, {
                active,
                lastSeen: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (e) {
            // Silent catch for background errors
        }
    };

    // Global presence reconciliation
    const reconciliationUnsubscribe = onSnapshot(collection(db, 'users', user.uid, 'sessions'), (snapshot) => {
        const anyActive = snapshot.docs.some(d => d.data().active === true);
        const newStatus = anyActive ? 'online' : 'offline';
        
        // Update global status only if changed
        getDoc(userRef).then(snap => {
            if (snap.exists() && snap.data().status !== newStatus) {
                updateDoc(userRef, { 
                    status: newStatus, 
                    lastSeen: serverTimestamp(),
                    activeSessionId: anyActive ? sessionId : null 
                }).catch(() => {});
            }
        }).catch(() => {});
    });

    updateSessionPresence(true);

    const checkSecurity = async () => {
        try {
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                const isVerified = localStorage.getItem('isVerified') === 'true';
                
                if (data.loginProtectionEnabled && !isVerified) {
                    router.push('/login');
                    return;
                }
                
                setIsVerifying(false);
                if (connectivityTimeout.current) clearTimeout(connectivityTimeout.current);

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
                if (connectivityTimeout.current) clearTimeout(connectivityTimeout.current);
            }
        } catch (e) {
            console.error("Security check failed:", e);
        }
    };

    checkSecurity();

    let appListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        appListener = App.addListener('appStateChange', ({ isActive }) => {
          updateSessionPresence(isActive);
        });
      });
    }

    const handleVisibilityChange = () => {
        updateSessionPresence(document.visibilityState === 'visible');
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    const handleBeforeUnload = () => { 
        deleteDoc(sessionRef).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      if (appListener) appListener.remove();
      reconciliationUnsubscribe();
      deleteDoc(sessionRef).catch(() => {});
    };
  }, [user?.uid, authLoading, router, db, auth, sessionId]);

  if (isLockedByPin) {
      return <PinLockOverlay onUnlock={() => setIsLockedByPin(false)} />;
  }

  if (isBlocked && !bypassActive) {
      return <BypassOverlay onRetry={() => window.location.reload()} onBypassSuccess={() => { setBypassActive(true); setIsBlocked(false); setIsVerifying(false); }} />;
  }

  if (authLoading || isVerifying || !user) {
    return (
        <div className="flex h-svh items-center justify-center bg-background">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
  }

  return <AppShell user={user} sessionId={sessionId} />;
}
