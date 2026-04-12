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
import { MessageCircle, Users, Megaphone, Bookmark, Globe, Bot, PhoneOff, Video, Phone, X } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDoc, onSnapshot, query, collection, where, updateDoc } from 'firebase/firestore';
import type { User, AuthenticatedUser, Chat, Call } from '@/types';
import { useLanguage } from '@/context/language-context';
import { useNotifications } from '@/context/notification-context';
import { CallDialog } from './chat/call-dialog';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';
import { Button } from './ui/button';

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
  const { setActiveChatId, showCallNotification } = useNotifications();

  // Call Management State
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<{ chat: PopulatedChat, otherUser: User | null, isVideo: boolean, isCaller: boolean } | null>(null);
  const [showCallDialog, setShowCallDialog] = useState(false);

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

  // Global Call Listener
  useEffect(() => {
    if (!db || !currentUser) return;

    const qCalls = query(
      collection(db, 'calls'),
      where('calleeId', '==', currentUser.uid),
      where('status', '==', 'calling')
    );

    const unsubscribe = onSnapshot(qCalls, async (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0];
        const callData = { id: callDoc.id, ...callDoc.data() } as Call;
        
        if (!incomingCall || incomingCall.id !== callData.id) {
          setIncomingCall(callData);
          
          // Fetch caller name for notification
          const callerDoc = await getDoc(doc(db, 'users', callData.callerId));
          const callerName = callerDoc.exists() ? (callerDoc.data() as User).name : 'Someone';
          showCallNotification(callerName, callData.id, !!callData.isVideo);
        }
      } else {
        if (incomingCall) {
          setIncomingCall(null);
          window.dispatchEvent(new CustomEvent('stop-ringtone'));
        }
      }
    });

    return () => unsubscribe();
  }, [db, currentUser, incomingCall, showCallNotification]);

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

    const handleAnswerCall = async (event: any) => {
      const chatId = event.detail.chatId;
      if (!chatId || !db) return;
      
      // Stop ringtone globally
      window.dispatchEvent(new CustomEvent('stop-ringtone'));

      // Find the call data
      const callDoc = await getDoc(doc(db, 'calls', chatId));
      if (callDoc.exists()) {
        const callData = { id: callDoc.id, ...callDoc.data() } as Call;
        
        // Fetch chat and user to open dialog
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (chatDoc.exists()) {
          const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
          const otherId = chatData.members.find(m => m !== currentUser.uid) || currentUser.uid;
          const otherUserDoc = await getDoc(doc(db, 'users', otherId));
          
          const iconName = chatData.icon as keyof typeof iconMap | undefined;
          const populatedChat: PopulatedChat = {
            ...chatData,
            iconComponent: iconName ? iconMap[iconName] : undefined,
          };

          setActiveCall({
            chat: populatedChat,
            otherUser: otherUserDoc.exists() ? { id: otherUserDoc.id, ...otherUserDoc.data() } as User : null,
            isVideo: !!callData.isVideo,
            isCaller: false
          });
          setShowCallDialog(true);
          handleSelect(populatedChat);
        }
      }
    };

    const handleInitiateCallEvent = (event: any) => {
      const { chat, otherUser, isVideo } = event.detail;
      setActiveCall({ chat, otherUser, isVideo, isCaller: true });
      setShowCallDialog(true);
    };

    const handleOpenInfVid = (event: any) => {
        const videoId = event.detail.videoId;
        if (videoId) {
            setInfVidInitialVideoId(videoId);
            setSelectedItem('infvid');
        }
    };

    window.addEventListener('open-chat', handleOpenChat);
    window.addEventListener('answer-call', handleAnswerCall);
    window.addEventListener('initiate-call', handleInitiateCallEvent);
    window.addEventListener('open-infvid', handleOpenInfVid);
    return () => {
        window.removeEventListener('open-chat', handleOpenChat);
        window.removeEventListener('answer-call', handleAnswerCall);
        window.removeEventListener('initiate-call', handleInitiateCallEvent);
        window.removeEventListener('open-infvid', handleOpenInfVid);
    };
  }, [db, handleSelect, currentUser.uid]);

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

  const handleDeclineCall = () => {
    if (!db || !incomingCall) return;
    const callDocRef = doc(db, 'calls', incomingCall.id);
    updateDoc(callDocRef, { status: 'ended' });
    setIncomingCall(null);
    window.dispatchEvent(new CustomEvent('stop-ringtone'));
  };

  const handleAcceptIncoming = () => {
    if (incomingCall) {
      window.dispatchEvent(new CustomEvent('answer-call', { detail: { chatId: incomingCall.id } }));
    }
  };

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
        
        {/* Global Incoming Call Banner */}
        {incomingCall && (
          <div 
            className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-[100] p-4 flex justify-center animate-in slide-in-from-top duration-500 cursor-pointer"
            onClick={handleAcceptIncoming}
          >
              <div className="bg-black/90 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 w-full max-w-sm border border-white/10 backdrop-blur-md">
                  <div className="w-12 h-12 flex-shrink-0 bg-muted rounded-full overflow-hidden">
                    {/* Simplified avatar for quick loading */}
                    <div className="w-full h-full flex items-center justify-center bg-primary text-white font-bold">?</div>
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{t('incoming_call')}</p>
                      <p className="text-xs text-white/60">{incomingCall.isVideo ? t('video_call') : t('audio_call')}</p>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <Button variant="destructive" size="icon" className="rounded-full h-10 w-10" onClick={handleDeclineCall}>
                          <PhoneOff className="h-5 w-5" />
                      </Button>
                      <Button className="bg-green-500 hover:bg-green-600 text-white rounded-full h-10 w-10" size="icon" onClick={handleAcceptIncoming}>
                          {incomingCall.isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                      </Button>
                  </div>
              </div>
          </div>
        )}

        {/* Global Call Dialog */}
        {activeCall && (
          <CallDialog 
            open={showCallDialog}
            onOpenChange={(open) => {
              setShowCallDialog(open);
              if (!open) setActiveCall(null);
            }}
            chat={activeCall.chat}
            otherUser={activeCall.otherUser}
            currentUser={populatedUser}
            isCaller={activeCall.isCaller}
            isVideo={activeCall.isVideo}
          />
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
