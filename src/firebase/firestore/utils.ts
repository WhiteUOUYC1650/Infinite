import { useMemo } from 'react';
import {
  DocumentReference,
  Query,
  collection,
  doc,
  query,
} from 'firebase/firestore';

// Helper to memoize Firestore references
export function useMemoFirebase<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
