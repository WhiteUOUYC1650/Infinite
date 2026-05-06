'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { SidebarContent } from '@/components/sidebar-content';
import { ChatView } from '@/components/chat/chat-view';
import { InfVidView } from '@/components/infvid/infvid-view';
import { InfGamesView } from '@/components/infgames/infgames-view';
import { FeedView } from '@/components/feed/feed-view';
import { BotStudioView } from '@/components/bot-studio/bot-studio-view';
import type { PopulatedChat } from '@/types';
import { MessageCircle, Users, Megaphone, Bookmark, Globe, Bot, PhoneOff, Video, Phone, X, Bell, Newspaper } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDoc, onSnapshot, query, collection, where, updateDoc, arrayUnion, addDoc, Timestamp, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import type { User, AuthenticatedUser, Chat, Call, CustomBot, BotBlock } from '@/types';
import { useLanguage } from '@/context/language-context';
import { useNotifications } from '@/context/notification-context';
import { CallDialog } from './chat/call-dialog';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';

const iconMap = {
    Users,
    Megaphone,
    Bookmark,
    Globe,
    Bot,
};

function ChatUI({ currentUser, sessionId }: { currentUser: FirebaseUser, sessionId: string }) {
  const [selectedItem, setSelectedItem] = useState<PopulatedChat | 'infvid' | 'infgames' | 'feed' | 'bot_studio' | null>(null);
  const [infVidInitialVideoId, setInfVidInitialVideoId] = useState<string | null>(null);
  const { isMobile } = useSidebar();
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { setActiveChatId, showCallNotification } = useNotifications();

  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<{ chat: PopulatedChat, otherUser: User | null, isVideo: boolean, isCaller: boolean } | null>(null);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showSubPrompt, setShowSubPrompt] = useState(false);
  const [targetChannelId, setTargetChannelId] = useState<string | null>(null);

  // Bot engine stability refs
  const processedMsgIds = useRef<Set<string>>(new Set());
  const engineStartedAt = useRef<number>(Date.now());
  const botDetectionCache = useRef<Record<string, boolean>>({});

  const userDocRef = useMemoFirebase(() => db ? doc(db, 'users', currentUser.uid) : null, [db, currentUser.uid]);
  const { data: userData } = useDoc<User>(userDocRef);

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
      await updateDoc(chatRef, { members: arrayUnion(currentUser.uid) });
      toast({ title: t('dm_success'), description: t('join_success_channel') });
      setShowSubPrompt(false);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const selectedId = typeof selectedItem === 'string' ? selectedItem : selectedItem?.id;
    if (selectedId) {
      setActiveChatId(selectedId);
    } else {
      setActiveChatId(null);
    }
  }, [selectedItem, setActiveChatId]);

  const handleSelect = useCallback((item: PopulatedChat | 'infvid' | 'infgames' | 'feed' | 'bot_studio') => {
    setSelectedItem(item);
    if (item !== 'infvid') setInfVidInitialVideoId(null);
  }, []);

  // Global System Back Button Support for all items (Robust implementation)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleSystemBack = () => {
      // If we are in a chat or special view, return to sidebar
      if (selectedItem) {
        setSelectedItem(null);
      }
    };

    let backListener: any;
    import('@capacitor/app').then(({ App }) => {
      backListener = App.addListener('backButton', handleSystemBack);
    });

    return () => {
      if (backListener) {
        backListener.then((l: any) => l.remove());
      }
    };
  }, [selectedItem]);

  // Global Custom Bot Engine
  useEffect(() => {
    if (!db || !currentUser || !userData) return;

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('members', 'array-contains', currentUser.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const chatData = change.doc.data() as Chat;
            const lastMsg = chatData.lastMessage;

            if (lastMsg && lastMsg.id && lastMsg.senderId === currentUser.uid) {
                // LEADERSHIP CHECK
                const currentLeader = (userData as any).activeSessionId;
                if (currentLeader && currentLeader !== sessionId) return;

                if (processedMsgIds.current.has(lastMsg.id)) return;
                
                // Fixed ReferenceError: lastMessage -> lastMsg
                const msgTime = lastMsg.timestamp?.toMillis() || 0;
                if (msgTime < engineStartedAt.current - 5000) {
                    processedMsgIds.current.add(lastMsg.id);
                    return;
                }

                processedMsgIds.current.add(lastMsg.id);
                const otherMembers = chatData.members.filter(m => m !== currentUser.uid);
                for (const memberId of otherMembers) {
                    if (botDetectionCache.current[memberId] === false) continue;

                    const memberDoc = await getDoc(doc(db, 'users', memberId));
                    if (memberDoc.exists() && memberDoc.data().isCustomBot) {
                        botDetectionCache.current[memberId] = true;
                        const botLogicSnap = await getDoc(doc(db, 'customBots', memberId));
                        if (botLogicSnap.exists() && botLogicSnap.data().isActive) {
                            executeBotLogic(botLogicSnap.data() as CustomBot, lastMsg, change.doc.id);
                        }
                    } else {
                        botDetectionCache.current[memberId] = false;
                    }
                }
            }
        });
    });

    const resolveVars = (text: string = '', vars: Record<string, string>) => {
        return text.replace(/\{(\w+)\}/g, (match, key) => vars[key] || match);
    };

    const checkCondition = (block: any, message: any, vars: Record<string, string>) => {
        const cond = block.params?.condition || '';
        if (!cond) return true;
        
        const resolvedCond = resolveVars(cond, vars).toLowerCase();
        const msgText = (message.content || '').toLowerCase();
        
        if (resolvedCond.includes('==')) {
            const [left, right] = resolvedCond.split('==').map(s => s.trim());
            return left === right;
        }
        if (resolvedCond.includes('contains')) {
            const [_, val] = resolvedCond.split('contains').map(s => s.trim());
            return msgText.includes(val);
        }
        return msgText.includes(resolvedCond);
    };

    const executeBotLogic = async (bot: CustomBot, message: any, chatId: string) => {
        const stateRef = doc(db, 'customBots', bot.id, 'userStates', currentUser.uid);
        const stateSnap = await getDoc(stateRef);
        const memory = stateSnap.exists() ? stateSnap.data().vars || {} : {};

        const vars: Record<string, string> = {
            ...memory,
            'user_name': userData.name || currentUser.displayName || 'User',
            'msg_text': message.content || '',
            'bot_name': bot.name,
            'time': new Date().toLocaleTimeString()
        };

        const isStartCommand = message.content === '/start';
        const triggerType = isStartCommand ? 'event_start' : 'event_message';

        for (const script of bot.scripts) {
            const blocks = script.blocks;
            if (!blocks || blocks.length === 0 || blocks[0].type !== triggerType) continue;

            let i = 1;
            const ifStack: boolean[] = [];

            while (i < blocks.length) {
                const block = blocks[i];
                if (block.type === 'logic_end_if') { ifStack.pop(); i++; continue; }
                if (block.type === 'logic_else') { if (ifStack.length > 0) { ifStack[ifStack.length - 1] = !ifStack[ifStack.length - 1]; } i++; continue; }
                if (ifStack.some(val => val === false)) { if (block.type === 'logic_if') ifStack.push(false); i++; continue; }

                switch (block.type) {
                    case 'logic_if': ifStack.push(checkCondition(block, message, vars)); break;
                    case 'variable_set': vars[block.params?.name] = resolveVars(block.params?.value, vars); break;
                    case 'action_send':
                    case 'action_reply': 
                    case 'action_send_image':
                    case 'action_send_video':
                    case 'action_send_music':
                    case 'action_send_file':
                        await sendBotMessage(bot, block, chatId, (block.type === 'action_reply' ? message : undefined), vars); break;
                    case 'action_wait': await new Promise(res => setTimeout(res, (block.params?.seconds || 1) * 1000)); break;
                }
                i++;
            }
        }
        const { user_name, msg_text, bot_name, time, ...persistentOnly } = vars;
        await setDoc(stateRef, { vars: persistentOnly, updatedAt: serverTimestamp() }, { merge: true });
    };

    const sendBotMessage = async (bot: CustomBot, block: BotBlock, chatId: string, replyTo?: any, vars?: Record<string, string>) => {
        const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
        const timestamp = Timestamp.now();
        const text = resolveVars(block.params?.text, vars || {});
        const mediaData = block.params?.mediaData;
        const mimeType = block.params?.mimeType;
        const fileName = block.params?.fileName;

        const msgData: any = {
            senderId: bot.id,
            content: text || '',
            timestamp,
            type: 'user' as const,
            readBy: [],
            ...(replyTo && { replyTo: { messageId: replyTo.id, content: replyTo.content, senderName: userData.name || currentUser.displayName || 'User' } }),
        };

        let lastMsgContent = text || 'Message';

        if (block.type === 'action_send_image' && mediaData) {
            msgData.imageUrl = mediaData;
            lastMsgContent = t('image_attachment_placeholder');
        } else if (block.type === 'action_send_video' && mediaData) {
            msgData.videoMimeType = mimeType || 'video/mp4';
            msgData.videoStatus = 'uploading';
            lastMsgContent = t('video_attachment_placeholder');
        } else if (block.type === 'action_send_music' && mediaData) {
            msgData.musicMimeType = mimeType || 'audio/mpeg';
            msgData.musicStatus = 'uploading';
            msgData.fileName = fileName || 'audio.mp3';
            lastMsgContent = t('music_attachment_placeholder');
        } else if (block.type === 'action_send_file' && mediaData) {
            msgData.fileMimeType = mimeType || 'application/octet-stream';
            msgData.fileStatus = 'uploading';
            msgData.fileName = fileName || 'file.bin';
            lastMsgContent = t('file_attachment_placeholder');
        }

        await setDoc(msgRef, msgData);
        await updateDoc(doc(db, 'chats', chatId), {
            lastMessage: { ...msgData, id: msgRef.id, senderName: bot.name, content: lastMsgContent }
        });

        // Handle chunking for non-image media
        if (mediaData && (block.type === 'action_send_video' || block.type === 'action_send_music' || block.type === 'action_send_file')) {
            const base64 = mediaData.split(',')[1];
            const CHUNK_SIZE = 900 * 1024;
            const chunkIds: string[] = [];
            const colName = block.type === 'action_send_video' ? 'videoChunks' : block.type === 'action_send_music' ? 'musicChunks' : 'fileChunks';
            const statusKey = block.type === 'action_send_video' ? 'videoStatus' : block.type === 'action_send_music' ? 'musicStatus' : 'fileStatus';
            const idKey = block.type === 'action_send_video' ? 'videoChunkIds' : block.type === 'action_send_music' ? 'musicChunkIds' : 'fileChunkIds';

            for (let j = 0; j < base64.length; j += CHUNK_SIZE) {
                const chunkRef = doc(collection(db, colName));
                await setDoc(chunkRef, { data: base64.substring(j, j + CHUNK_SIZE), part: j/CHUNK_SIZE, senderId: bot.id });
                chunkIds.push(chunkRef.id);
            }
            await updateDoc(msgRef, { [statusKey]: 'complete', [idKey]: chunkIds });
        }
    };

    return () => unsubscribe();
  }, [db, currentUser, userData, sessionId, t]);

  // Global Call Listener
  useEffect(() => {
    if (!db || !currentUser) return;
    const qCalls = query(collection(db, 'calls'), where('calleeId', '==', currentUser.uid), where('status', '==', 'calling'));
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
      } else if (incomingCall) {
        setIncomingCall(null);
        window.dispatchEvent(new CustomEvent('stop-ringtone'));
      }
    });
    return () => unsubscribe();
  }, [db, currentUser, incomingCall, showCallNotification, t]);

  // Global Events
  useEffect(() => {
    const handleOpenChat = async (event: any) => {
      const chatId = event.detail.chatId;
      if (!chatId || !db) return;
      try {
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (chatDoc.exists()) {
          const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
          const iconName = (chatData.icon === 'Drum' || chatData.name === 'Infinite') ? 'Bot' : chatData.icon as keyof typeof iconMap | undefined;
          handleSelect({ ...chatData, id: chatDoc.id, iconComponent: iconName ? iconMap[iconName] : undefined } as PopulatedChat);
        }
      } catch (e) { console.error(e); }
    };

    const handleAnswerCall = async (event: any) => {
      const chatId = event.detail.chatId;
      if (!chatId || !db) return;
      window.dispatchEvent(new CustomEvent('stop-ringtone'));
      const callDoc = await getDoc(doc(db, 'calls', chatId));
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (callDoc.exists() && chatDoc.exists()) {
        const callData = callDoc.data() as Call;
        const chatData = chatDoc.data() as Chat;
        const otherId = chatData.members.find(m => m !== currentUser.uid) || currentUser.uid;
        const otherUserDoc = await getDoc(doc(db, 'users', otherId));
        const iconName = (chatData.icon === 'Drum' || chatData.name === 'Infinite') ? 'Bot' : chatData.icon as any;
        const populatedChat = { ...chatData, id: chatDoc.id, iconComponent: iconName ? iconMap[iconName as keyof typeof iconMap] : undefined } as PopulatedChat;
        setActiveCall({ chat: populatedChat, otherUser: otherUserDoc.exists() ? { id: otherUserDoc.id, ...otherUserDoc.data() } as User : null, isVideo: !!callData.isVideo, isCaller: false });
        setShowCallDialog(true);
        handleSelect(populatedChat);
      }
    };

    const handleInitiateCallEvent = (event: any) => {
      const { chat, otherUser, isVideo } = event.detail;
      setActiveCall({ chat, otherUser, isVideo, isCaller: true });
      setShowCallDialog(true);
    };

    const handleOpenInfVid = (event: any) => {
        const videoId = event.detail.videoId;
        setInfVidInitialVideoId(videoId);
        handleSelect('infvid');
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

  const populatedUser: AuthenticatedUser | null = useMemo(() => {
    if (!userData) return null;
    return { ...currentUser, ...userData, isAdmin: userData.username === '@Infinite' };
  }, [currentUser, userData]);

  const currentSelectedId = useMemo(() => {
      return typeof selectedItem === 'string' ? selectedItem : selectedItem?.id;
  }, [selectedItem]);

  const handleDeclineCall = () => {
    if (!db || !incomingCall) return;
    updateDoc(doc(db, 'calls', incomingCall.id), { status: 'ended' });
    setIncomingCall(null);
    window.dispatchEvent(new CustomEvent('stop-ringtone'));
  };

  const handleAcceptIncoming = () => {
    if (incomingCall) window.dispatchEvent(new CustomEvent('answer-call', { detail: { chatId: incomingCall.id } }));
  };

  const renderMainView = () => {
    if (!populatedUser) return <div className="flex h-svh items-center justify-center">Loading...</div>;

    if (selectedItem === 'feed') return <FeedView currentUser={populatedUser} onClose={() => handleSelect(null as any)} onSelectChat={handleSelect} />;
    if (selectedItem === 'bot_studio') return <BotStudioView currentUser={populatedUser} onClose={() => handleSelect(null as any)} />;
    if (selectedItem === 'infvid') return <InfVidView currentUser={populatedUser} onClose={() => handleSelect(null as any)} initialVideoId={infVidInitialVideoId || undefined} />;
    if (selectedItem === 'infgames') return <InfGamesView currentUser={populatedUser} onClose={() => handleSelect(null as any)} />;
    if (selectedItem && typeof selectedItem !== 'string') return <ChatView key={selectedItem.id} item={selectedItem} onClose={() => handleSelect(null as any)} currentUser={populatedUser} onSelectChat={handleSelect} />;
    if (isMobile) return <div className="h-svh w-screen flex flex-col bg-sidebar text-sidebar-foreground"><SidebarContent onSelect={handleSelect} selectedId={currentSelectedId} currentUser={populatedUser} /></div>;
    return <div className="relative flex h-full flex-col items-center justify-center bg-background p-4"><div className="flex flex-col items-center text-center"><MessageCircle className="h-24 w-24 mb-4 text-primary/50" strokeWidth={1} /><h2 className="text-2xl font-bold tracking-tight font-headline">{t('chat_not_selected')}</h2></div></div>;
  };

  return (
    <>
      {!isMobile && (
        <Sidebar>
          {populatedUser && <SidebarContent onSelect={handleSelect} selectedId={currentSelectedId} currentUser={populatedUser} />}
        </Sidebar>
      )}
      <SidebarInset className="min-h-0">
        {renderMainView()}
        {incomingCall && (
          <div className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-[100] p-4 flex justify-center animate-in slide-in-from-top duration-500 cursor-pointer" onClick={handleAcceptIncoming}>
              <div className="bg-black/90 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 w-full max-sm border border-white/10 backdrop-blur-md">
                  <div className="w-12 h-12 flex-shrink-0 bg-primary rounded-full flex items-center justify-center text-white font-bold"><Phone className="h-6 w-6" /></div>
                  <div className="flex-1 min-w-0"><p className="font-bold truncate">{t('incoming_call')}</p><p className="text-xs text-white/60">{incomingCall.isVideo ? t('video_call') : t('audio_call')}</p></div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}><Button variant="destructive" size="icon" className="rounded-full h-10 w-10" onClick={handleDeclineCall}><PhoneOff className="h-5 w-5" /></Button><Button className="bg-green-500 hover:bg-green-600 text-white rounded-full h-10 w-10" size="icon" onClick={handleAcceptIncoming}>{incomingCall.isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}</Button></div>
              </div>
          </div>
        )}
        {activeCall && <CallDialog open={showCallDialog} onOpenChange={(open) => { setShowCallDialog(open); if (!open) setActiveCall(null); }} chat={activeCall.chat} otherUser={activeCall.otherUser} currentUser={populatedUser} isCaller={activeCall.isCaller} isVideo={activeCall.isVideo} />}
        <Dialog open={showSubPrompt} onOpenChange={setShowSubPrompt}>
          <DialogContent className="max-w-sm rounded-[2rem] p-8 border-none shadow-2xl"><DialogHeader className="items-center text-center space-y-4"><div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center"><Bell className="h-10 w-10 text-primary animate-bounce" /></div><div className="space-y-2"><DialogTitle className="text-2xl font-bold font-headline">{t('subscribe_prompt_title')}</DialogTitle><DialogDescription className="text-muted-foreground leading-relaxed">{t('subscribe_prompt_desc')}</DialogDescription></div></DialogHeader><DialogFooter className="flex-col gap-2 pt-4"><Button onClick={handleSubscribeToChannel} className="w-full h-12 rounded-xl font-bold">{t('subscribe')}</Button><Button variant="ghost" onClick={() => setShowSubPrompt(false)} className="w-full h-12 rounded-xl font-medium text-muted-foreground">{t('cancel')}</Button></DialogFooter></DialogContent>
        </Dialog>
      </SidebarInset>
    </>
  );
}

export function AppShell({ user, sessionId }: { user: FirebaseUser, sessionId: string }) {
  return (
    <SidebarProvider>
      <ChatUI currentUser={user} sessionId={sessionId} />
    </SidebarProvider>
  );
}
