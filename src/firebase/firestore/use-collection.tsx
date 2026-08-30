'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  query,
  orderBy,
  limit,
  startAt,
  startAfter,
  endAt,
  endBefore,
  where,
  type Query,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

interface UseCollectionOptions {
  orderBy?: string;
  limit?: number;
  startAt?: any;
  startAfter?: any;
  endAt?: any;
  endBefore?: any;
  where?: [string, '==', any]; 
}

export function useCollection<T extends DocumentData>(
  q: Query<T> | null,
  options?: UseCollectionOptions
) {
  const [data, setData] = useState<Array<T & { id: string }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!q) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const result: Array<T & { id: string }> = [];
        querySnapshot.forEach((doc) => {
          result.push({ id: doc.id, ...doc.data() } as T & { id: string });
        });
        setData(result);
        setLoading(false);
      },
      (err) => {
        console.warn("Firestore collection onSnapshot error:", err);
        const permissionError = new FirestorePermissionError({
          path: (q as any)._query?.path?.segments?.join('/') || 'unknown',
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => {
        try {
            unsubscribe();
        } catch (e) {}
    };
  }, [q]); // Listener is stable based on the query object

  return { data, loading, error };
}
