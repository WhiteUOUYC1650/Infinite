'use client';

import { useState, useMemo } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
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
import { useLanguage } from '@/context/language-context';


function ChatUI({ currentUser }: { currentUser: FirebaseUser }) {
  const [selectedItem, setSelectedItem] = useState<PopulatedChat | null>(null);
  const { isMobile } = useSidebar();
  const db = useFirestore();
  const { t } = useLanguage();

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

  if (isMobile) {
    if (!populatedUser) {
      // You can add a more sophisticated loading screen here
      return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (selectedItem) {
      return <ChatView key={selectedItem.id} item={selectedItem} onClose={() => setSelectedItem(null)} currentUser={populatedUser} onSelectChat={handleSelect} />;
    }
    
    return <SidebarContent onSelect={handleSelect} selectedId={selectedItem?.id} currentUser={populatedUser} />;
  }

  // Desktop layout
  return (
    <>
      <Sidebar>
        {populatedUser && <SidebarContent onSelect={handleSelect} selectedId={selectedItem?.id} currentUser={populatedUser} />}
      </Sidebar>
      <SidebarInset>
        {selectedItem && populatedUser ? (
          <ChatView key={selectedItem.id} item={selectedItem} onClose={() => setSelectedItem(null)} currentUser={populatedUser} onSelectChat={handleSelect} />
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center bg-background p-4">
            <div className="flex flex-col items-center text-center">
                <MessageCircle className="h-24 w-24 mb-4 text-primary/50" strokeWidth={1} />
                <h2 className="text-2xl font-bold tracking-tight font-headline">
                  {t('chat_not_selected')}
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
