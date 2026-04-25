
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import type { AuthenticatedUser, Message, Chat, PopulatedChat, User } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Newspaper, ArrowLeft, Loader2, Megaphone, Users, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import { VerifiedBadge } from '../ui/verified-badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '../ui/badge';
import { useTheme } from '@/context/theme-context';
import { cacheFile, getCachedFile, fetchAndCacheImage } from '@/lib/cache-utils';

const iconMap = {
    Users,
    Megaphone,
};

export function FeedView({ currentUser, onClose, onSelectChat }: { currentUser: AuthenticatedUser, onClose: () => void, onSelectChat: (chat: PopulatedChat) => void }) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { theme: colorTheme } = useTheme();
  
  const [messages, setMessages] = useState<(Message & { channelId: string, channelInfo: Chat })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db || !currentUser) return;

    const fetchFeed = async () => {
      setIsLoading(true);
      try {
        const chatsRef = collection(db, 'chats');
        const channelsQuery = query(
          chatsRef, 
          where('members', 'array-contains', currentUser.uid),
          where('type', '==', 'channel')
        );
        const channelsSnap = await getDocs(channelsQuery);
        const channels = channelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Chat));

        if (channels.length === 0) {
          setMessages([]);
          setIsLoading(false);
          return;
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startTimestamp = Timestamp.fromDate(startOfToday);

        const allMessages: (Message & { channelId: string, channelInfo: Chat })[] = [];

        await Promise.all(channels.map(async (channel) => {
          const msgsRef = collection(db, 'chats', channel.id, 'messages');
          const q = query(
            msgsRef,
            where('timestamp', '>=', startTimestamp),
            orderBy('timestamp', 'desc')
          );
          const msgsSnap = await getDocs(q);
          msgsSnap.forEach(doc => {
            allMessages.push({ 
              id: doc.id, 
              ...doc.data() as Message, 
              channelId: channel.id,
              channelInfo: channel 
            });
          });
        }));

        allMessages.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
        setMessages(allMessages);
      } catch (e) {
        console.error("Feed error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeed();
  }, [db, currentUser]);

  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    messages.forEach(m => ids.add(m.senderId));
    return Array.from(ids);
  }, [messages]);

  const { users: memberDetails } = useBatchUsers(allUserIds);

  const handleOpenChannel = useCallback((channel: Chat) => {
    const iconName = channel.icon as keyof typeof iconMap | undefined;
    onSelectChat({
      ...channel,
      id: channel.id,
      iconComponent: iconName ? iconMap[iconName] : undefined
    } as PopulatedChat);
  }, [onSelectChat]);

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      <header className={cn(
          "flex-shrink-0 flex items-center p-4 border-b z-20 pt-[calc(1rem+env(safe-area-inset-top))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]",
          colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background/95 backdrop-blur-md'
      )}>
        <Button variant="ghost" size="icon" onClick={onClose} className="mr-4 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 overflow-hidden">
          <Newspaper className="h-6 w-6 text-primary shrink-0" />
          <h1 className="text-xl font-bold font-headline truncate">{t('feed_title')}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <div className="text-center py-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
              {format(new Date(), 'dd MMMM yyyy')}
            </p>
            <h2 className="text-lg font-medium text-muted-foreground mt-1">
              {t('feed_description')}
            </h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : messages.length > 0 ? (
            <div className="space-y-8">
              {messages.map((message) => (
                <FeedItem 
                  key={message.id}
                  message={message}
                  channel={message.channelInfo}
                  sender={memberDetails[message.senderId]}
                  onOpenChannel={() => handleOpenChannel(message.channelInfo)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 opacity-50">
              <Newspaper className="h-16 w-16 mx-auto mb-4" strokeWidth={1} />
              <p className="text-xl font-semibold">{t('no_feed_messages')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FeedItem({ message, channel, sender, onOpenChannel }: { message: Message, channel: Chat, sender?: User, onOpenChannel: () => void }) {
  const { t } = useLanguage();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
        const cached = await getCachedFile(message.id);
        if (cached) {
            setMediaUrl(cached);
            return;
        }

        if (message.imageUrl) {
            const cachedUrl = await fetchAndCacheImage(message.id, message.imageUrl);
            setMediaUrl(cachedUrl || message.imageUrl);
        } else if (message.videoStatus === 'complete' || message.musicStatus === 'complete' || message.voiceStatus === 'complete') {
            const url = await getCachedFile(message.id);
            setMediaUrl(url);
        }
    };
    load();
  }, [message]);

  const timestamp = format(new Date(message.timestamp.toMillis()), 'HH:mm');

  return (
    <div className="bg-card border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      <div className="p-4 flex items-center justify-between border-b bg-muted/20">
        <button onClick={onOpenChannel} className="flex items-center gap-3 text-left group">
          <Avatar className="h-10 w-10 border group-hover:scale-105 transition-transform">
            {channel.avatar ? <AvatarImage src={channel.avatar} /> : <AvatarFallback><Megaphone className="h-5 w-5" /></AvatarFallback>}
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="font-bold font-headline truncate group-hover:text-primary transition-colors">{channel.name}</p>
              {(channel.link === '/C/Infinite' || channel.link === '/G/Infinite') && <VerifiedBadge className="w-3 h-3" />}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{timestamp}</p>
          </div>
        </button>
        <Button variant="ghost" size="sm" onClick={onOpenChannel} className="rounded-full text-xs font-bold px-4">
          {t('open')}
        </Button>
      </div>

      {mediaUrl && message.imageUrl && (
        <div className="aspect-video relative overflow-hidden bg-zinc-900 border-b">
          <img src={mediaUrl} alt="Attachment" className="w-full h-full object-cover" />
        </div>
      )}

      {message.content && (
        <div className="p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({children}) => <p className="mb-0 leading-relaxed text-base">{children}</p>,
                a: ({href, children}) => <span className="text-primary font-bold">{children}</span>
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      <div className="px-6 pb-6 pt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
            {message.reactions && Object.keys(message.reactions).length > 0 && (
                <div className="flex -space-x-1">
                    {Object.keys(message.reactions).slice(0, 3).map(emoji => (
                        <div key={emoji} className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs">
                            {emoji}
                        </div>
                    ))}
                </div>
            )}
        </div>
        <button onClick={onOpenChannel} className="text-[10px] font-bold text-muted-foreground uppercase hover:text-primary transition-colors">
            {t('publish_placeholder')} • {channel.link}
        </button>
      </div>
    </div>
  );
}
