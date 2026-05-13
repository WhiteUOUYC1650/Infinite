'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import type { Chat } from '@/types';
import { useLanguage } from './language-context';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

interface NotificationContextType {
  setActiveChatId: (id: string | null) => void;
  showCallNotification: (callerName: string, chatId: string, isVideo: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const db = useFirestore();
  const { t } = useLanguage();
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const notifiedMessageIds = useRef<Set<string>>(new Set());
  const appLoadedAt = useRef<number>(Date.now());
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload ringtone for web
    ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1351/1351-preview.mp3');
    ringtoneRef.current.loop = true;
  }, []);

  const requestPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await LocalNotifications.checkPermissions();
        if (status.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.permission.then((permission) => {
             if (permission !== 'granted') {
                window.Notification.requestPermission();
             }
          });
        }
      }
    } catch (e) {
      console.warn("Notification permissions request failed", e);
    }
  };

  useEffect(() => {
    requestPermission();

    if (Capacitor.isNativePlatform()) {
      const listener = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const chatId = action.notification.extra?.chatId;
        const isCall = action.notification.extra?.isCall;
        if (chatId) {
          if (isCall) {
            window.dispatchEvent(new CustomEvent('answer-call', { detail: { chatId } }));
          } else {
            window.dispatchEvent(new CustomEvent('open-chat', { detail: { chatId } }));
          }
        }
      });
      return () => {
        listener.then(l => l.remove());
      };
    }
  }, []);

  useEffect(() => {
    if (user) {
      requestPermission();
    }
  }, [user]);

  useEffect(() => {
    if (!user || !db) return;

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('members', 'array-contains', user.uid));

    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const chat = { id: change.doc.id, ...change.doc.data() } as Chat;
        const lastMessage = chat.lastMessage;

        if (lastMessage && lastMessage.id) {
          if (lastMessage.senderId === user.uid) return;
          if (chat.id === activeChatId) return;
          if (notifiedMessageIds.current.has(lastMessage.id)) return;
          const messageTime = lastMessage.timestamp?.toMillis() || 0;
          if (messageTime < (appLoadedAt.current - 15000)) return;

          notifiedMessageIds.current.add(lastMessage.id);
          showNotification(chat, lastMessage);
        }
      });
    });

    return () => unsubscribe();
  }, [user, db, activeChatId, t]);

  const showNotification = async (chat: Chat, message: any) => {
    const senderName = message.senderName || 'User';
    
    // Group/Channel title is chat name, DM title is sender nickname
    const title = chat.type === 'dm' 
      ? senderName
      : (chat.name || 'Chat');
    
    let body = chat.type === 'dm' 
      ? (message.content || t('image_attachment_placeholder'))
      : `${senderName}: ${message.content || t('image_attachment_placeholder')}`;
    
    if (body.length > 150) body = body.substring(0, 147) + '...';

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: title || "New Message",
              body: body || "",
              id: Math.floor(Math.random() * 1000000),
              schedule: { at: new Date(Date.now() + 100) },
              extra: { chatId: chat.id },
              smallIcon: "ic_stat_notification",
              color: "#FF8C00",
            }
          ]
        });
      } catch (e) {
        console.error("Failed to show local notification", e);
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new window.Notification(title || "New Message", {
          body: body || "",
          icon: '/notification-icon.png',
        });
        n.onclick = () => {
          window.focus();
          window.dispatchEvent(new CustomEvent('open-chat', { detail: { chatId: chat.id } }));
        };
      } catch (e) {
        console.warn("Browser notification construction failed:", e);
      }
    }
  };

  const showCallNotification = async (callerName: string, chatId: string, isVideo: boolean) => {
    const title = isVideo ? t('video_call') : t('audio_call');
    const body = t('is_calling_you', { name: callerName });

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: title || "Incoming Call",
              body: body || "",
              id: 999, // Unique ID for calls
              schedule: { at: new Date(Date.now() + 100) },
              extra: { chatId, isCall: true },
              ongoing: true,
              smallIcon: "ic_stat_notification",
              color: "#FF8C00",
            }
          ]
        });
      } catch (e) {
        console.error("Call notification failed", e);
      }
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.play().catch(() => {});
      }
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new window.Notification(title || "Incoming Call", { 
            body, 
            icon: '/notification-icon.png',
            tag: 'incoming-call' 
          });
          n.onclick = () => {
            window.focus();
            window.dispatchEvent(new CustomEvent('answer-call', { detail: { chatId } }));
            if (ringtoneRef.current) ringtoneRef.current.pause();
          };
        } catch (e) {
          console.warn("Call notification construction failed:", e);
        }
      }
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.cancel({ notifications: [{ id: 999 }] });
    }
  };

  // Listen for call end to stop ringtone
  useEffect(() => {
    const handleStopRingtone = () => stopRingtone();
    window.addEventListener('stop-ringtone', handleStopRingtone);
    return () => window.removeEventListener('stop-ringtone', handleStopRingtone);
  }, []);

  return (
    <NotificationContext.Provider value={{ setActiveChatId, showCallNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}