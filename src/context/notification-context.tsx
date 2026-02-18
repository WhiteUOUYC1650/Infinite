'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import type { Chat, Message } from '@/types';
import { useLanguage } from './language-context';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

interface NotificationContextType {
  setActiveChatId: (id: string | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const db = useFirestore();
  const { t } = useLanguage();
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const notifiedMessageIds = useRef<Set<string>>(new Set());
  const appLoadedAt = useRef<number>(Date.now());

  useEffect(() => {
    // Request permissions on mount
    const requestPermission = async () => {
      if (Capacitor.isNativePlatform()) {
        const status = await LocalNotifications.checkPermissions();
        if (status.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } else if ('Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      }
    };
    requestPermission();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('members', 'array-contains', user.uid));

    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const chat = { id: change.doc.id, ...change.doc.data() } as Chat;
        const lastMessage = chat.lastMessage;

        if (lastMessage && lastMessage.id) {
          // 1. Don't notify if it's our own message
          if (lastMessage.senderId === user.uid) return;

          // 2. Don't notify if this is the chat currently open
          if (chat.id === activeChatId) return;

          // 3. Don't notify if we've already seen this message ID in this session
          if (notifiedMessageIds.current.has(lastMessage.id)) return;

          // 4. Only notify for messages sent AFTER the app was loaded
          const messageTime = lastMessage.timestamp?.toMillis() || 0;
          if (messageTime < appLoadedAt.current) return;

          // Record this message as notified
          notifiedMessageIds.current.add(lastMessage.id);

          // Trigger notification
          showNotification(chat, lastMessage);
        }
      });
    });

    return () => unsubscribe();
  }, [user, db, activeChatId, t]);

  const showNotification = async (chat: Chat, message: any) => {
    const title = chat.type === 'dm' 
      ? t('new_message_from', { name: message.senderName || 'User' })
      : `${chat.name}`;
    
    const body = chat.type === 'dm' 
      ? message.content 
      : `${message.senderName}: ${message.content}`;

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body: body.substring(0, 100),
              id: Math.floor(Math.random() * 1000000),
              schedule: { at: new Date(Date.now() + 100) },
              sound: undefined,
              attachments: [],
              actionTypeId: "",
              extra: null
            }
          ]
        });
      } catch (e) {
        console.error("Failed to show local notification", e);
      }
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body.substring(0, 100),
        icon: '/favicon.ico', // Fallback icon
      });
    }
  };

  return (
    <NotificationContext.Provider value={{ setActiveChatId }}>
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
