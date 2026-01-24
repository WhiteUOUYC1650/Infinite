'use client';

import { AppShell } from '@/components/app-shell';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';

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
