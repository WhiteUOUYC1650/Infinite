'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();

  const handleSignIn = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error) {
      console.error('Error signing in with Google', error);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold font-headline text-primary mb-4">Infinite</h1>
        <p className="text-muted-foreground mb-8">
          A modern chat application.
        </p>
        <Button onClick={handleSignIn} size="lg">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
