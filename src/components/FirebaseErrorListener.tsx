'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import type { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Quietly log to console instead of showing a toast to the user
      // unless specifically in development mode or needed for debugging.
      console.warn('Firestore Permission Denied:', {
          path: error.context?.path,
          operation: error.context?.operation,
          details: error.context
      });

      // Toasts for permission errors are now disabled by default for a better UX.
      /*
      const description = (
        <div className="w-full">
          <p className="mb-2 text-sm">
            {`The operation '${error.context?.operation || 'unknown'}' on path '${error.context?.path || 'unknown'}' was denied.`}
          </p>
          {error.context && (
            <pre className="mt-2 w-full max-w-full overflow-x-auto rounded-md bg-slate-900 p-2">
              <code className="text-white text-[10px] whitespace-pre-wrap break-all">
                {JSON.stringify(error.context, null, 2)}
              </code>
            </pre>
          )}
        </div>
      );

      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: description,
        duration: 5000,
      });
      */
    };

    const unsubscribe = errorEmitter.on('permission-error', handleError);

    return () => {
      unsubscribe();
    };
  }, [toast]);

  return null; // This component does not render anything
}
