'use client';

import { useState } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { SidebarContent } from '@/components/sidebar-content';
import { ChatView } from '@/components/chat/chat-view';
import type { ChatItem, PopulatedChat } from '@/types';
import { MessageCircle } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User } from '@/types';


function ChatUI({ currentUser }: { currentUser: FirebaseUser }) {
  const [selectedItem, setSelectedItem] = useState<PopulatedChat | null>(null);
  const { isMobile } = useSidebar();
  const db = useFirestore();

  const { data: userData } = useDoc<User>(db && doc(db, 'users', currentUser.uid));


  const handleSelect = (item: PopulatedChat) => {
    setSelectedItem(item);
  };

  return (
    <>
      <Sidebar>
        {userData && <SidebarContent onSelect={handleSelect} selectedId={selectedItem?.id} currentUser={{...currentUser, ...userData}} />}
      </Sidebar>
      <SidebarInset>
        {selectedItem ? (
          <ChatView item={selectedItem} onClose={() => setSelectedItem(null)} currentUser={currentUser} />
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
                  Chat not selected
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
