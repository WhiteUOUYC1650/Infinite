'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { User } from '@/types';

// --- New Optimized Hook for fetching users in batches ---
export function useBatchUsers(userIds: string[]) {
    const db = useFirestore();
    const [users, setUsers] = useState<Record<string, User>>({});
    const [loading, setLoading] = useState(true);

    const stringifiedUserIds = JSON.stringify(userIds.sort());

    useEffect(() => {
        const uniqueUserIds = JSON.parse(stringifiedUserIds);
        if (!db || uniqueUserIds.length === 0) {
            setUsers({});
            setLoading(false);
            return;
        }

        const fetchUsers = async () => {
            setLoading(true);
            const usersCollection = collection(db, 'users');
            const fetchedUsers: Record<string, User> = {};
            
            // Firestore 'in' queries support a maximum of 30 elements in the array.
            const chunks: string[][] = [];
            for (let i = 0; i < uniqueUserIds.length; i += 30) {
                chunks.push(uniqueUserIds.slice(i, i + 30));
            }

            try {
                const querySnapshots = await Promise.all(chunks.map(chunk => {
                    const q = query(usersCollection, where('__name__', 'in', chunk));
                    return getDocs(q);
                }));

                querySnapshots.forEach(snapshot => {
                    snapshot.forEach(doc => {
                        fetchedUsers[doc.id] = { id: doc.id, ...doc.data() } as User;
                    });
                });
                setUsers(fetchedUsers);
            } catch (error) {
                console.error("Error fetching users in batch:", error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, stringifiedUserIds]);

    return { users, loading };
}
