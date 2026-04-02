'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { SidebarContent } from '@/components/sidebar-content';
import { ChatView } from '@/components/chat/chat-view';
import { InfVidView } from '@/components/infvid/infvid-view';
import type { PopulatedChat } from '@/types';
import { MessageCircle } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User, AuthenticatedUser } from '@/types';
import { useLanguage } from '@/context/language-context';
import { useNotifications } from '@/context/notification-context';


function ChatUI({ currentUser }: { currentUser: FirebaseUser }) {
  const [selectedItem, setSelectedItem] = useState<PopulatedChat | 'infvid' | null>(null);
  const { isMobile } = useSidebar();
  const db = useFirestore();
  const { t } = useLanguage();
  const { setActiveChatId } = useNotifications();

  // Inform NotificationProvider about the currently open chat
  useEffect(() => {
    if (selectedItem && typeof selectedItem !== 'string') {
      setActiveChatId(selectedItem.id);
    } else {
      setActiveChatId(null);
    }
  }, [selectedItem, setActiveChatId]);

  const userDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'users', currentUser.uid);
  }, [db, currentUser.uid]);

  const { data: userData } = useDoc<User>(userDocRef);

  const populatedUser: AuthenticatedUser | null = useMemo(() => {
    if (!userData) return null;
    const isAdmin = userData.username === '@Infinite';
    return { ...currentUser, ...userData, isAdmin };
  }, [currentUser, userData]);


  const handleSelect = (item: PopulatedChat | 'infvid') => {
    setSelectedItem(item);
  };

  const renderMainView = () => {
    if (!populatedUser) return <div className="flex h-svh items-center justify-center">Loading...</div>;

    if (selectedItem === 'infvid') {
        return <InfVidView currentUser={populatedUser} onClose={() => setSelectedItem(null)} />;
    }

    if (selectedItem && typeof selectedItem !== 'string') {
        return <ChatView key={selectedItem.id} item={selectedItem} onClose={() => setSelectedItem(null)} currentUser={populatedUser} onSelectChat={handleSelect} />;
    }

    if (isMobile) {
        // On mobile, the sidebar content takes the full screen.
        return (
            <div className="h-svh w-screen flex flex-col bg-sidebar text-sidebar-foreground">
                <SidebarContent onSelect={handleSelect} selectedId={typeof selectedItem === 'string' ? selectedItem : selectedItem?.id} currentUser={populatedUser} />
            </div>
        );
    }

    return (
        <div className="relative flex h-full flex-col items-center justify-center bg-background p-4">
            <div className="flex flex-col items-center text-center">
                <MessageCircle className="h-24 w-24 mb-4 text-primary/50" strokeWidth={1} />
                <h2 className="text-2xl font-bold tracking-tight font-headline">
                  {t('chat_not_selected')}
                </h2>
            </div>
        </div>
    );
  };

  return (
    <>
      {!isMobile && (
        <Sidebar>
          {populatedUser && <SidebarContent onSelect={handleSelect} selectedId={typeof selectedItem === 'string' ? selectedItem : selectedItem?.id} currentUser={populatedUser} />}
        </Sidebar>
      )}
      <SidebarInset>
        {renderMainView()}
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
