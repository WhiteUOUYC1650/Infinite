'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { MessageCircle, Users, Megaphone, Bookmark, Globe, Bot } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { User, AuthenticatedUser, Chat } from '@/types';
import { useLanguage } from '@/context/language-context';
import { useNotifications } from '@/context/notification-context';

const iconMap = {
    Users,
    Megaphone,
    Bookmark,
    Globe,
    Bot,
};

function ChatUI({ currentUser }: { currentUser: FirebaseUser }) {
  const [selectedItem, setSelectedItem] = useState<PopulatedChat | 'infvid' | null>(null);
  const [infVidInitialVideoId, setInfVidInitialVideoId] = useState<string | null>(null);
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

  const handleSelect = useCallback((item: PopulatedChat | 'infvid') => {
    setSelectedItem(item);
    if (item !== 'infvid') {
        setInfVidInitialVideoId(null);
    }
  }, []);

  // Handle global "open-chat" events (e.g. from notifications)
  useEffect(() => {
    const handleOpenChat = async (event: any) => {
      const chatId = event.detail.chatId;
      if (!chatId || !db) return;

      try {
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (chatDoc.exists()) {
          const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
          const iconName = chatData.icon as keyof typeof iconMap | undefined;
          const populatedChat: PopulatedChat = {
            ...chatData,
            iconComponent: iconName ? iconMap[iconName] : undefined,
          };
          handleSelect(populatedChat);
        }
      } catch (e) {
        console.error("Failed to handle notification click navigation:", e);
      }
    };

    const handleOpenInfVid = (event: any) => {
        const videoId = event.detail.videoId;
        if (videoId) {
            setInfVidInitialVideoId(videoId);
            setSelectedItem('infvid');
        }
    };

    window.addEventListener('open-chat', handleOpenChat);
    window.addEventListener('open-infvid', handleOpenInfVid);
    return () => {
        window.removeEventListener('open-chat', handleOpenChat);
        window.removeEventListener('open-infvid', handleOpenInfVid);
    };
  }, [db, handleSelect]);

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


  const renderMainView = () => {
    if (!populatedUser) return <div className="flex h-svh items-center justify-center">Loading...</div>;

    if (selectedItem === 'infvid') {
        return (
            <InfVidView 
                currentUser={populatedUser} 
                onClose={() => handleSelect(null)} 
                initialVideoId={infVidInitialVideoId || undefined} 
            />
        );
    }

    if (selectedItem && typeof selectedItem !== 'string') {
        return <ChatView key={selectedItem.id} item={selectedItem} onClose={() => handleSelect(null)} currentUser={populatedUser} onSelectChat={handleSelect} />;
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
