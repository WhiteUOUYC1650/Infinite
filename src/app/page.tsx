'use client';

import { AppShell } from '@/components/app-shell';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { doc, getFirestore, setDoc } from 'firebase/firestore';

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();
  const db = getFirestore();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (user && db) {
        const userRef = doc(db, 'users', user.uid);
        setDoc(userRef, {
            status: 'online'
        }, { merge: true });
    }
  }, [user, loading, router, db]);

  if (loading || !user) {
    // You can show a loading spinner here
    return (
        <div className="flex h-screen items-center justify-center">
            Loading...
        </div>
    );
  }

  return <AppShell user={user} />;
}
