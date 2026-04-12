
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
import { MessageCircle, Users, Megaphone, Bookmark, Globe, Bot, PhoneOff, Video, Phone, X, Bell } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDoc, onSnapshot, query, collection, where, updateDoc, arrayUnion } from 'firebase/firestore';
import type { User, AuthenticatedUser, Chat, Call } from '@/types';
import { useLanguage } from '@/context/language-context';
import { useNotifications } from '@/context/notification-context';
import { CallDialog } from './chat/call-dialog';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const { setActiveChatId, showCallNotification } = useNotifications();

  // Call Management State
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<{ chat: PopulatedChat, otherUser: User | null, isVideo: boolean, isCaller: boolean } | null>(null);
  const [showCallDialog, setShowCallDialog] = useState(false);

  // Subscription Prompt State
  const [showSubPrompt, setShowSubPrompt] = useState(false);
  const [targetChannelId, setTargetChannelId] = useState<string | null>(null);

  // Visit tracking for subscription prompt
  useEffect(() => {
    if (!currentUser || !db) return;

    const count = parseInt(localStorage.getItem('app_visit_count') || '0') + 1;
    localStorage.setItem('app_visit_count', count.toString());

    if (count % 50 === 0) {
      const checkMembership = async () => {
        const linkRef = doc(db, 'chatLinks', encodeURIComponent('/C/Infinite'));
        const linkSnap = await getDoc(linkRef);
        if (linkSnap.exists()) {
          const cid = linkSnap.data().chatId;
          const chatSnap = await getDoc(doc(db, 'chats', cid));
          if (chatSnap.exists()) {
            const members = (chatSnap.data() as Chat).members || [];
            if (!members.includes(currentUser.uid)) {
              setTargetChannelId(cid);
              setShowSubPrompt(true);
            }
          }
        }
      };
      checkMembership();
    }
  }, [currentUser, db]);

  const handleSubscribeToChannel = async () => {
    if (!db || !targetChannelId || !currentUser) return;
    try {
      const chatRef = doc(db, 'chats', targetChannelId);
      await updateDoc(chatRef, {
        members: arrayUnion(currentUser.uid)
      });
      toast({ title: t('dm_success'), description: t('join_success_channel') });
      setShowSubPrompt(false);
    } catch (e) {
      console.error(e);
    }
  };

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

  // Handle global events
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
      
      window.dispatchEvent(new CustomEvent('stop-ringtone'));

      const callDoc = await getDoc(doc(db, 'calls', chatId));
      if (callDoc.exists()) {
        const callData = { id: callDoc.id, ...callDoc.data() } as Call;
        
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
        
        {incomingCall && (
          <div 
            className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-[100] p-4 flex justify-center animate-in slide-in-from-top duration-500 cursor-pointer"
            onClick={handleAcceptIncoming}
          >
              <div className="bg-black/90 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 w-full max-w-sm border border-white/10 backdrop-blur-md">
                  <div className="w-12 h-12 flex-shrink-0 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                    <Phone className="h-6 w-6" />
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

        <Dialog open={showSubPrompt} onOpenChange={setShowSubPrompt}>
          <DialogContent className="max-w-sm rounded-[2rem] p-8 border-none shadow-2xl">
            <DialogHeader className="items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
                <Bell className="h-10 w-10 text-primary animate-bounce" />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-bold font-headline">{t('subscribe_prompt_title')}</DialogTitle>
                <DialogDescription className="text-muted-foreground leading-relaxed">
                  {t('subscribe_prompt_desc')}
                </DialogDescription>
              </div>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 pt-4">
              <Button onClick={handleSubscribeToChannel} className="w-full h-12 rounded-xl font-bold">
                {t('subscribe')}
              </Button>
              <Button variant="ghost" onClick={() => setShowSubPrompt(false)} className="w-full h-12 rounded-xl font-medium text-muted-foreground">
                {t('cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
