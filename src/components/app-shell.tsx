'use client';

import { useState, useMemo } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { SidebarContent } from '@/components/sidebar-content';
import { ChatView } from '@/components/chat/chat-view';
import type { PopulatedChat } from '@/types';
import { MessageCircle } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User, AuthenticatedUser } from '@/types';


function ChatUI({ currentUser }: { currentUser: FirebaseUser }) {
  const [selectedItem, setSelectedItem] = useState<PopulatedChat | null>(null);
  const { isMobile } = useSidebar();
  const db = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'users', currentUser.uid);
  }, [db, currentUser.uid]);

  const { data: userData } = useDoc<User>(userDocRef);

  const populatedUser: AuthenticatedUser | null = useMemo(() => {
    if (!userData) return null;
    return { ...currentUser, ...userData };
  }, [currentUser, userData]);


  const handleSelect = (item: PopulatedChat) => {
    setSelectedItem(item);
  };

  return (
    <>
      <Sidebar>
        {populatedUser && <SidebarContent onSelect={handleSelect} selectedId={selectedItem?.id} currentUser={populatedUser} />}
      </Sidebar>
      <SidebarInset>
        {selectedItem && populatedUser ? (
          <ChatView key={selectedItem.id} item={selectedItem} onClose={() => setSelectedItem(null)} currentUser={populatedUser} />
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center bg-background p-4">
            {isMobile && (
              <header className="absolute top-0 left-0 right-0 flex items-center p-4">
                <SidebarTrigger />
              </header>
            )}
            <div className="flex flex-col items-center text-center">
                <MessageCircle className="h-24 w-24 mb-4 text-primary/50" strokeWidth={1} />
                <h2 className="text-2xl font-bold tracking-tight font-headline">
                  {selectedItem ? "Loading chat..." : "Chat not selected"}
                </h2>
            </div>
          </div>
        )}
      </SidebarInset>
    </>
  );
}

export function AppShell({ user }: { user: FirebaseUser }) {
  return (
    <SidebarProvider>
      <ChatUI currentUser={user} />
    </SidebarProvider>
  );
}
