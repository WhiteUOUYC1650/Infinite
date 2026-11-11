
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
import { InfMusicView } from '@/components/infmusic/infmusic-view';
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
import { cn } from '@/lib/utils';
import { aiChat } from '@/ai/flows/ai-chat-flow';
import { useTheme } from '@/context/theme-context';
import { ExperimentalSettingsDialog } from '@/components/experimental-settings-dialog';
import { M3Shell } from '@/components/m3/m3-shell';
import type { M3Service } from '@/components/m3/m3-chat-list';

const iconMap = {
    Users,
    Megaphone,
    Bookmark,
    Globe,
    Bot,
};

function ChatUI({ currentUser, sessionId }: { currentUser: FirebaseUser, sessionId: string }) {
  const [selectedItem, setSelectedItem] = useState<PopulatedChat | 'infvid' | 'infmusic' | 'infgames' | 'feed' | 'bot_studio' | null>(null);
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
  const { material3Design } = useTheme();
  const [m3SettingsOpen, setM3SettingsOpen] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState(true);
  const [selectionNonce, setSelectionNonce] = useState(0);
  const [targetChannelId, setTargetChannelId] = useState<string | null>(null);
  const [botGuideRequested, setBotGuideRequested] = useState(false);

  const processedMsgIds = useRef<Set<string>>(new Set());
  const engineStartedAt = useRef<number>(Date.now());
  const botDetectionCache = useRef<Record<string, boolean>>({});

  /*
   * Presence: keep `status` / `lastSeen` fresh while the app is open, so DM
   * headers can show "online", "was online …" instead of stale values.
   */
  useEffect(() => {
    if (!db || !currentUser?.uid) return;
    const userRef = doc(db, 'users', currentUser.uid);
    let stopped = false;
    const mark = (status: 'online' | 'away' | 'offline') => {
      if (stopped) return;
      updateDoc(userRef, { status, lastSeen: serverTimestamp() }).catch(() => {});
    };
    mark('online');
    const heartbeat = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      mark('online');
    }, 45000);
    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      mark(document.visibilityState === 'visible' ? 'online' : 'away');
    };
    const onPageHide = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') mark('offline');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      stopped = true;
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [db, currentUser?.uid]);

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
  }, [currentUser.uid, db]);

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
    setActiveChatId(selectedId || null);
  }, [selectedItem, setActiveChatId]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const sync = () => setIsOnlineState(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const handleSelect = useCallback((item: PopulatedChat | 'infvid' | 'infmusic' | 'infgames' | 'feed' | 'bot_studio' | null) => {
    setSelectedItem(item);
    if (item !== 'infvid') setInfVidInitialVideoId(null);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handleSystemBack = () => { if (selectedItem) setSelectedItem(null); };
    let backListener: any;
    import('@capacitor/app').then(({ App }) => { 
        backListener = App.addListener('backButton', handleSystemBack); 
    });
    return () => { if (backListener) { backListener.then((l: any) => l.remove()); } };
  }, [selectedItem]);

  // Bot Logic Engine
  useEffect(() => {
    if (!db || !currentUser || !userData) return;
    
    const resolveVars = (text: string = '', vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (match, key) => vars[key] || match);

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('members', 'array-contains', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const chatData = change.doc.data() as Chat;
            const lastMsg = chatData.lastMessage;
            if (lastMsg && lastMsg.id && lastMsg.senderId === currentUser.uid) {
                // Only the leader session processes bot logic to prevent multi-tab loops
                const currentLeader = (userData as any).activeSessionId;
                if (currentLeader && currentLeader !== sessionId) return;
                
                if (processedMsgIds.current.has(lastMsg.id)) return;
                const msgTime = lastMsg.timestamp?.toMillis() || 0;
                if (msgTime < engineStartedAt.current - 5000) { processedMsgIds.current.add(lastMsg.id); return; }
                processedMsgIds.current.add(lastMsg.id);
                const otherMembers = chatData.members.filter(m => m !== currentUser.uid);
                for (const memberId of otherMembers) {
                    if (botDetectionCache.current[memberId] === false) continue;
                    const memberDoc = await getDoc(doc(db, 'users', memberId));
                    if (memberDoc.exists() && memberDoc.data().isCustomBot) {
                        botDetectionCache.current[memberId] = true;
                        const botLogicSnap = await getDoc(doc(db, 'customBots', memberId));
                        if (botLogicSnap.exists() && botLogicSnap.data().isActive) { 
                            executeBotLogic(botLogicSnap.data() as CustomBot, { type: 'event_message', message: lastMsg }, change.doc.id); 
                        }
                    } else { botDetectionCache.current[memberId] = false; }
                }
            }
        });
    });

    const handleBotButtonClick = (event: any) => {
        const { botId, buttonId } = event.detail;
        if (!botId || !buttonId) return;
        getDoc(doc(db, 'customBots', botId)).then(async (botLogicSnap) => {
            if (botLogicSnap.exists() && botLogicSnap.data().isActive) {
                const members = [currentUser.uid, botId].sort();
                const chatId = members.join('_');
                executeBotLogic(botLogicSnap.data() as CustomBot, { type: 'event_button_click', buttonId }, chatId);
            }
        });
    };
    window.addEventListener('bot-button-click', handleBotButtonClick);

    const executeBotLogic = async (bot: CustomBot, event: { type: 'event_message' | 'event_button_click', message?: any, buttonId?: string }, chatId: string) => {
        const stateRef = doc(db, 'customBots', bot.id, 'userStates', currentUser.uid);
        const stateSnap = await getDoc(stateRef);
        const memory = stateSnap.exists() ? stateSnap.data().vars || {} : {};
        const vars: Record<string, string> = { 
            ...memory, 
            'user_name': userData.name || currentUser.displayName || 'User', 
            'msg_text': event.message?.content || '', 
            'bot_name': bot.name, 
            'time': new Date().toLocaleTimeString() 
        };

        const isStartCommand = event.message?.content === '/start';
        const triggerType = isStartCommand ? 'event_start' : event.type;

        for (const script of bot.scripts) {
            const blocks = script.blocks; 
            if (!blocks || blocks.length === 0) continue;
            const trigger = blocks[0];
            if (trigger.type !== triggerType) continue;
            if (triggerType === 'event_button_click') {
                const targetId = String(trigger.params?.buttonId || '').trim().toLowerCase();
                const clickedId = String(event.buttonId || '').trim().toLowerCase();
                if (targetId !== clickedId) continue;
            }

            let i = 1; const ifStack: boolean[] = []; let stopped = false;
            while (i < blocks.length && !stopped) {
                const block = blocks[i];
                if (block.type === 'logic_end_if') { ifStack.pop(); i++; continue; }
                if (block.type === 'logic_else') { if (ifStack.length > 0) { ifStack[ifStack.length - 1] = !ifStack[ifStack.length - 1]; } i++; continue; }
                if (ifStack.some(val => val === false)) { if (block.type === 'logic_if') ifStack.push(false); i++; continue; }
                switch (block.type) {
                    case 'logic_if': 
                        const cond = resolveVars(block.params?.condition, vars);
                        if (cond.includes('==')) {
                            const [left, right] = cond.split('==').map(s => s.trim());
                            ifStack.push(left === right);
                        } else if (cond.includes('!=')) {
                            const [left, right] = cond.split('!=').map(s => s.trim());
                            ifStack.push(left !== right);
                        } else { ifStack.push(vars['msg_text'].includes(cond)); }
                        break;
                    case 'variable_set': vars[block.params?.name] = resolveVars(block.params?.value, vars); break;
                    case 'variable_math':
                        const val = parseInt(vars[block.params?.name] || '0');
                        const delta = parseInt(resolveVars(block.params?.value, vars) || '0');
                        if (block.params?.op === 'sub') vars[block.params?.name] = (val - delta).toString();
                        else if (block.params?.op === 'mul') vars[block.params?.name] = (val * delta).toString();
                        else vars[block.params?.name] = (val + delta).toString();
                        break;
                    case 'variable_random':
                        const max = parseInt(resolveVars(block.params?.value, vars) || '100');
                        vars[block.params?.name] = Math.floor(Math.random() * (max + 1)).toString();
                        break;
                    case 'variable_clear': delete vars[block.params?.name]; break;
                    case 'action_stop': stopped = true; break;
                    case 'action_send':
                    case 'action_reply': 
                    case 'action_send_image':
                    case 'action_send_video':
                    case 'action_send_music':
                    case 'action_send_file':
                        await sendBotMessage(bot, block, chatId, (block.type === 'action_reply' ? event.message : undefined), vars); 
                        break;
                    case 'action_ai_prompt':
                        const aiResp = await aiChat(vars['msg_text'], block.params?.prompt || '');
                        await sendBotMessage(bot, { type: 'action_send', params: { text: aiResp.response } } as any, chatId, undefined, vars);
                        break;
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
        const text = resolveVars(block.params?.text, vars || {});
        const msgData: any = { 
            senderId: bot.id, 
            content: text || '', 
            timestamp: serverTimestamp(), 
            type: 'user', 
            readBy: [], 
            ...(replyTo && { replyTo: { messageId: replyTo.id, content: replyTo.content, senderName: userData.name || 'User' } }),
            ...(block.params?.imageUrl && { imageUrl: block.params.imageUrl }),
            ...(block.params?.videoStatus === 'complete' && { videoStatus: 'complete', videoChunkIds: block.params.videoChunkIds, videoMimeType: block.params.videoMimeType }),
            ...(block.params?.musicStatus === 'complete' && { musicStatus: 'complete', musicChunkIds: block.params.musicChunkIds, musicMimeType: block.params.musicMimeType, fileName: block.params.fileName }),
            ...(block.params?.fileStatus === 'complete' && { fileStatus: 'complete', fileChunkIds: block.params.fileChunkIds, fileName: block.params.fileName }),
        };
        await setDoc(msgRef, msgData);
        await updateDoc(doc(db, 'chats', chatId), { lastMessage: { ...msgData, id: msgRef.id, senderName: bot.name, timestamp: Timestamp.now() } });
    };

    return () => {
        unsubscribe();
        window.removeEventListener('bot-button-click', handleBotButtonClick);
    };
  }, [db, currentUser.uid, (userData as any)?.activeSessionId, sessionId]);

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
        setIncomingCall(null); window.dispatchEvent(new CustomEvent('stop-ringtone'));
      }
    });
    return () => unsubscribe();
  }, [db, currentUser.uid, incomingCall, showCallNotification]);

  useEffect(() => {
    const handleOpenChat = async (event: any) => {
      const chatId = event.detail.chatId; if (!chatId || !db) return;
      try {
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (chatDoc.exists()) {
          const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
          const iconName = (chatData.icon === 'Drum' || chatData.name === 'Infinite') ? 'Bot' : chatData.icon as any;
          handleSelect({ ...chatData, id: chatDoc.id, iconComponent: iconName ? iconMap[iconName as keyof typeof iconMap] : undefined } as PopulatedChat);
        }
      } catch (e) { console.error(e); }
    };
    const handleAnswerCall = async (event: any) => {
      const chatId = event.detail.chatId; if (!chatId || !db) return;
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
        setShowCallDialog(true); handleSelect(populatedChat);
      }
    };
    const handleInitiateCallEvent = (event: any) => { const { chat, otherUser, isVideo } = event.detail; setActiveCall({ chat, otherUser, isVideo, isCaller: true }); setShowCallDialog(true); };
    const handleOpenInfVid = (event: any) => { setInfVidInitialVideoId(event.detail.videoId); handleSelect('infvid'); };
    const handleOpenBotGuide = () => { setBotGuideRequested(true); handleSelect('bot_studio'); };
    window.addEventListener('open-chat', handleOpenChat); window.addEventListener('answer-call', handleAnswerCall); window.addEventListener('initiate-call', handleInitiateCallEvent); window.addEventListener('open-infvid', handleOpenInfVid); window.addEventListener('open-bot-guide', handleOpenBotGuide);
    return () => { window.removeEventListener('open-chat', handleOpenChat); window.removeEventListener('answer-call', handleAnswerCall); window.removeEventListener('initiate-call', handleInitiateCallEvent); window.removeEventListener('open-infvid', handleOpenInfVid); window.removeEventListener('open-bot-guide', handleOpenBotGuide); };
  }, [db, handleSelect, currentUser.uid]);

  const populatedUser: AuthenticatedUser | null = useMemo(() => {
    if (!userData) return null;
    return { 
      ...currentUser, 
      ...userData, 
      uid: currentUser.uid,
      id: userData.id || currentUser.uid,
      isAdmin: userData.username === '@Infinite' 
    };
  }, [currentUser, userData]);

  const currentSelectedId = useMemo(() => typeof selectedItem === 'string' ? selectedItem : selectedItem?.id, [selectedItem]);
  const handleDeclineCall = () => { if (!db || !incomingCall) return; updateDoc(doc(db, 'calls', incomingCall.id), { status: 'ended' }); setIncomingCall(null); window.dispatchEvent(new CustomEvent('stop-ringtone')); };
  const handleAcceptIncoming = () => { if (incomingCall) window.dispatchEvent(new CustomEvent('answer-call', { detail: { chatId: incomingCall.id } })); };

  const renderSelectedContent = () => {
    if (!populatedUser) return null;
    if (selectedItem === 'feed') return <FeedView currentUser={populatedUser} onClose={() => handleSelect(null)} onSelectChat={handleSelect} />;
    if (selectedItem === 'bot_studio') return <BotStudioView currentUser={populatedUser} onClose={() => { setBotGuideRequested(false); handleSelect(null); }} initialGuideOpen={botGuideRequested} />;
    if (selectedItem === 'infvid') return <InfVidView currentUser={populatedUser} onClose={() => handleSelect(null)} initialVideoId={infVidInitialVideoId || undefined} />;
    if (selectedItem === 'infmusic') return <InfMusicView currentUser={populatedUser} onClose={() => handleSelect(null)} />;
    if (selectedItem === 'infgames') return <InfGamesView currentUser={populatedUser} onClose={() => handleSelect(null)} />;
    if (selectedItem && typeof selectedItem !== 'string') return <ChatView key={`${selectedItem.id}-${selectionNonce}`} item={selectedItem} onClose={() => handleSelect(null)} currentUser={populatedUser} onSelectChat={handleSelect} />;
    return null;
  };

  /* ---------------------------------------------------------------------
   * Material 3 edition — completely separate UI layer (src/components/m3).
   * The classic 1.5 markup below is never rendered for this edition.
   * ------------------------------------------------------------------- */
  const handleM3SelectChat = useCallback((chat: Chat) => {
    /*
     * Any modal (M3 sheets, dialogs) locks pointer events on <body> while open.
     * Navigating straight from such a sheet can leave that lock behind, which
     * makes the UI ignore taps until the app is restarted - seen with the Saved
     * messages / General chat shortcuts. Clearing it here keeps the app alive.
     */
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = '';
    }
    setSelectionNonce((n) => n + 1);
    const iconName = (chat.icon === 'Drum' || chat.name === 'Infinite') ? 'Bot' : chat.icon as any;
    handleSelect({ ...chat, iconComponent: iconName ? iconMap[iconName as keyof typeof iconMap] : undefined } as PopulatedChat);
  }, [handleSelect]);

  const handleM3SelectService = useCallback((service: M3Service) => handleSelect(service), [handleSelect]);

  /*
   * Saved messages / General chat open immediately and sync in the background.
   * Awaiting Firestore before navigating made these rows feel dead on a slow
   * connection ("the General chat button sometimes does nothing").
   */
  const handleM3SavedMessages = () => {
    if (!currentUser.uid) return;
    const chatId = currentUser.uid;
    handleM3SelectChat({ id: chatId, type: 'dm', members: [currentUser.uid], icon: 'Bookmark' } as Chat);
    if (!db) return;
    setDoc(
      doc(db, 'chats', chatId),
      { type: 'dm', members: [currentUser.uid], icon: 'Bookmark', unreadCounts: { [currentUser.uid]: 0 } },
      { merge: true }
    ).catch((e) => console.error('Saved messages: could not sync chat doc', e));
  };

  const handleM3GeneralChat = () => {
    if (!currentUser.uid) return;
    const chatId = 'GENERAL_CHAT';
    handleM3SelectChat({ id: chatId, type: 'group', name: 'General Chat', members: [currentUser.uid], icon: 'Globe' } as Chat);
    if (!db) return;
    (async () => {
      try {
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) {
          await setDoc(chatRef, { type: 'group', name: 'General Chat', icon: 'Globe', members: [currentUser.uid] }, { merge: true });
          return;
        }
        const members = (chatSnap.data().members as string[] | undefined) || [];
        if (!members.includes(currentUser.uid)) {
          await updateDoc(chatRef, { members: arrayUnion(currentUser.uid) });
        }
      } catch (e) {
        console.error('General chat: could not sync chat doc', e);
      }
    })();
  };

  if (material3Design) {
    return (
      <>
        {populatedUser && (
          <M3Shell
            currentUser={populatedUser}
            selectedId={currentSelectedId}
            hasContent={!!selectedItem}
            isOnline={isOnlineState}
            onSelectChat={handleM3SelectChat}
            onSelectService={handleM3SelectService}
            onSelectSaved={handleM3SavedMessages}
            onSelectGeneral={handleM3GeneralChat}
            onOpenSettings={() => setM3SettingsOpen(true)}
          >
            {selectedItem ? renderSelectedContent() : null}
          </M3Shell>
        )}

        {populatedUser && (
          <ExperimentalSettingsDialog
            open={m3SettingsOpen}
            onOpenChange={setM3SettingsOpen}
            currentUser={populatedUser}
          />
        )}

        {incomingCall && (
          <div className="fixed left-0 right-0 top-[env(safe-area-inset-top)] z-[100] flex cursor-pointer justify-center p-4" onClick={handleAcceptIncoming}>
            <div className="flex w-full max-w-sm items-center gap-3 rounded-[1.5rem] bg-card p-3 shadow-xl">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Phone className="h-6 w-6" /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t('incoming_call')}</p><p className="text-xs text-muted-foreground">{incomingCall.isVideo ? t('video_call') : t('audio_call')}</p></div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="destructive" size="icon" className="h-10 w-10 rounded-full" onClick={handleDeclineCall}><PhoneOff className="h-5 w-5" /></Button>
                <Button className="h-10 w-10 rounded-full bg-emerald-500 text-white hover:bg-emerald-600" size="icon" onClick={handleAcceptIncoming}>{incomingCall.isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}</Button>
              </div>
            </div>
          </div>
        )}

        {activeCall && (
          <CallDialog open={showCallDialog} onOpenChange={(open) => { setShowCallDialog(open); if (!open) setActiveCall(null); }} chat={activeCall.chat} otherUser={activeCall.otherUser} currentUser={populatedUser!} isCaller={activeCall.isCaller} isVideo={activeCall.isVideo} />
        )}

        <Dialog open={showSubPrompt} onOpenChange={setShowSubPrompt}>
          <DialogContent className="max-w-sm p-8">
            <DialogHeader className="items-center space-y-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-primary/10"><Bell className="h-10 w-10 animate-bounce text-primary" /></div>
              <div className="space-y-2"><DialogTitle className="text-xl font-medium">{t('subscribe_prompt_title')}</DialogTitle><DialogDescription className="leading-relaxed text-muted-foreground">{t('subscribe_prompt_desc')}</DialogDescription></div>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 pt-4">
              <Button onClick={handleSubscribeToChannel} className="h-12 w-full">{t('subscribe')}</Button>
              <Button variant="ghost" onClick={() => setShowSubPrompt(false)} className="h-12 w-full text-muted-foreground">{t('cancel')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {!isMobile && populatedUser && <Sidebar><SidebarContent onSelect={handleSelect} selectedId={currentSelectedId} currentUser={populatedUser} /></Sidebar>}
      <SidebarInset className="min-h-0 bg-background relative overflow-hidden">
        {populatedUser && (
          <div className="flex h-full w-full overflow-hidden relative">
            <div className={cn("absolute inset-0 z-10 transition-transform duration-300 ease-in-out", isMobile && selectedItem ? "-translate-x-full" : "translate-x-0")}>
              <div className="h-full w-full bg-sidebar text-sidebar-foreground overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <SidebarContent onSelect={handleSelect} selectedId={currentSelectedId} currentUser={populatedUser} />
              </div>
            </div>
            <div className={cn("absolute inset-0 z-20 transition-transform duration-300 ease-in-out bg-background", isMobile ? (selectedItem ? "translate-x-0" : "translate-x-full") : "relative translate-x-0 flex-1")}>
              {selectedItem ? (
                  <div className="h-full w-full animate-in fade-in slide-in-from-right-4 duration-300">
                    {renderSelectedContent()}
                  </div>
              ) : (!isMobile && (<div className="relative flex h-full flex-col items-center justify-center bg-background p-4 animate-in fade-in duration-500"><div className="flex flex-col items-center text-center"><MessageCircle className="h-24 w-24 mb-4 text-primary/50" strokeWidth={1} /><h2 className="text-2xl font-bold tracking-tight font-headline">{t('chat_not_selected')}</h2></div></div>))}
            </div>
          </div>
        )}
        {incomingCall && (
          <div className="fixed top-[env(safe-area-inset-top))] left-0 right-0 z-[100] p-4 flex justify-center animate-in slide-in-from-top duration-500 cursor-pointer" onClick={handleAcceptIncoming}>
              <div className="bg-black/90 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 w-full max-sm border border-white/10 backdrop-blur-md">
                  <div className="w-12 h-12 flex-shrink-0 bg-primary rounded-full flex items-center justify-center text-white font-bold"><Phone className="h-6 w-6" /></div>
                  <div className="flex-1 min-w-0"><p className="font-bold truncate">{t('incoming_call')}</p><p className="text-xs text-white/60">{incomingCall.isVideo ? t('video_call') : t('audio_call')}</p></div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}><Button variant="destructive" size="icon" className="rounded-full h-10 w-10" onClick={handleDeclineCall}><PhoneOff className="h-5 w-5" /></Button><Button className="bg-green-500 hover:bg-green-600 text-white rounded-full h-10 w-10" size="icon" onClick={handleAcceptIncoming}>{incomingCall.isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}</Button></div>
              </div>
          </div>
        )}
        {activeCall && <CallDialog open={showCallDialog} onOpenChange={(open) => { setShowCallDialog(open); if (!open) setActiveCall(null); }} chat={activeCall.chat} otherUser={activeCall.otherUser} currentUser={populatedUser!} isCaller={activeCall.isCaller} isVideo={activeCall.isVideo} />}
        <Dialog open={showSubPrompt} onOpenChange={setShowSubPrompt}>
          <DialogContent className="max-w-sm rounded-[2rem] p-8 border-none shadow-2xl">
            <DialogHeader className="items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center"><Bell className="h-10 w-10 text-primary animate-bounce" /></div>
              <div className="space-y-2"><DialogTitle className="text-2xl font-bold font-headline">{t('subscribe_prompt_title')}</DialogTitle><DialogDescription className="text-muted-foreground leading-relaxed">{t('subscribe_prompt_desc')}</DialogDescription></div>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 pt-4"><Button onClick={handleSubscribeToChannel} className="w-full h-12 rounded-xl font-bold">{t('subscribe')}</Button><Button variant="ghost" onClick={() => setShowSubPrompt(false)} className="w-full h-12 rounded-xl font-medium text-muted-foreground">{t('cancel')}</Button></DialogFooter>
          </DialogContent>
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
