'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: any) => {
      console.error(error); // Also log to console for debugging
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: error.message || 'An unexpected error occurred.',
      });
    };

    const unsubscribe = errorEmitter.on('permission-error', handleError);

    return () => {
      // Clean up the listener when the component unmounts
      // It's important to have a way to remove listeners from your emitter
    };
  }, [toast]);

  return null; // This component does not render anything
}
