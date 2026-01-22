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
  where?: [string, '==', any]; // Simple where clause for demonstration
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
      return;
    }

    let finalQuery: Query<T> = q;
    const constraints: QueryConstraint[] = [];
    if (options?.orderBy) constraints.push(orderBy(options.orderBy));
    if (options?.where) constraints.push(where(...options.where));
    if (options?.startAt) constraints.push(startAt(options.startAt));
    if (options?.startAfter) constraints.push(startAfter(options.startAfter));
    if (options?.endAt) constraints.push(endAt(options.endAt));
    if (options?.endBefore) constraints.push(endBefore(options.endBefore));
    if (options?.limit) constraints.push(limit(options.limit));

    if (constraints.length > 0) {
      finalQuery = query(q, ...constraints);
    }

    const unsubscribe = onSnapshot(
      finalQuery,
      (querySnapshot) => {
        const result: Array<T & { id: string }> = [];
        querySnapshot.forEach((doc) => {
          result.push({ id: doc.id, ...doc.data() });
        });
        setData(result);
        setLoading(false);
      },
      (err) => {
        const permissionError = new FirestorePermissionError({
          path: (q as any)._query.path.segments.join('/'),
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [q, options]);

  return { data, loading, error };
}
