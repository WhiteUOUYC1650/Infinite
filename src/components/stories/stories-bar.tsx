
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import { Story, User, AuthenticatedUser, Chat } from '@/types';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Archive } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { UploadStoryDialog } from './upload-story-dialog';
import { StoryViewer } from './story-viewer';

export function StoriesBar({ currentUser, filterArchived = false }: { currentUser: AuthenticatedUser, filterArchived?: boolean }) {
  const db = useFirestore();
  const { t } = useLanguage();
  const [stories, setStories] = useState<Story[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedUserForViewer, setSelectedUserForViewer] = useState<string | null>(null);

  const archivedChatIds = useMemo(() => new Set(currentUser.archivedChats || []), [currentUser.archivedChats]);

  // Fetch all active stories
  useEffect(() => {
    if (!db) return;
    const now = Timestamp.now();
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Story)));
    });

    return () => unsubscribe();
  }, [db]);

  // Fetch user's chats to filter stories
  const chatsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid));
  }, [db, currentUser.uid]);
  const { data: chats } = useCollection<Chat>(chatsQuery);

  const { usersWithChats, archivedUsersWithChats } = useMemo(() => {
    const main = new Set<string>();
    const arch = new Set<string>();
    
    chats?.forEach(chat => {
        const isArchived = archivedChatIds.has(chat.id);
        chat.members.forEach(m => {
            if (m !== currentUser.uid) {
                if (isArchived) arch.add(m);
                else main.add(m);
            }
        });
    });
    return { usersWithChats: main, archivedUsersWithChats: arch };
  }, [chats, archivedChatIds, currentUser.uid]);

  const uniqueUserIds = useMemo(() => Array.from(new Set(stories.map(s => s.userId))), [stories]);
  const { users: storySenders } = useBatchUsers(uniqueUserIds);

  const filteredUsersWithStories = useMemo(() => {
    return uniqueUserIds
      .filter(uid => {
          if (uid === currentUser.uid) return !filterArchived; // Self is always main unless we explicitly hide
          const isArchived = archivedUsersWithChats.has(uid);
          return filterArchived ? isArchived : !isArchived && (usersWithChats.has(uid));
      })
      .map(uid => storySenders[uid])
      .filter(Boolean)
      .sort((a, b) => (a.id === currentUser.uid ? -1 : 1));
  }, [uniqueUserIds, storySenders, currentUser.uid, usersWithChats, archivedUsersWithChats, filterArchived]);

  if (filterArchived && filteredUsersWithStories.length === 0) return null;

  return (
    <div className={cn(
        "flex items-center gap-4 px-4 py-3 overflow-x-auto no-scrollbar bg-background/50 backdrop-blur-sm border-b shrink-0 h-28 min-h-28",
        filterArchived && "bg-muted/30 border-none rounded-2xl mx-2 my-2 h-24 min-h-24"
    )}>
      {!filterArchived && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="relative group">
              <button 
                onClick={() => stories.some(s => s.userId === currentUser.uid) ? setSelectedUserForViewer(currentUser.uid) : setIsUploadOpen(true)}
                className={cn(
                  "w-14 h-14 rounded-full p-0.5 transition-transform active:scale-95",
                  stories.some(s => s.userId === currentUser.uid) ? "bg-gradient-to-tr from-orange-500 to-yellow-400 p-[2.5px]" : "bg-muted"
                )}
              >
                <Avatar className="w-full h-full border-2 border-background">
                  <AvatarImage src={currentUser.avatar} />
                  <AvatarFallback>{currentUser.name?.charAt(0)}</AvatarFallback>
                </Avatar>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsUploadOpen(true); }}
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background shadow-sm hover:scale-110 transition-transform z-10"
              >
                <Plus className="w-3 h-3" strokeWidth={3} />
              </button>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground truncate w-14 text-center">
              {t('my_story')}
            </span>
          </div>
      )}

      {filteredUsersWithStories.filter(u => u.id !== currentUser.uid).map(user => (
        <div key={user.id} className="flex flex-col items-center gap-1 shrink-0">
          <button 
            onClick={() => setSelectedUserForViewer(user.id)}
            className={cn(
                "rounded-full bg-gradient-to-tr from-orange-500 to-yellow-400 p-[2.5px] transition-transform active:scale-95",
                filterArchived ? "w-12 h-12" : "w-14 h-14"
            )}
          >
            <Avatar className="w-full h-full border-2 border-background">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </button>
          <span className="text-[10px] font-bold text-muted-foreground truncate w-14 text-center">
            {user.name}
          </span>
        </div>
      ))}

      {filterArchived && (
          <div className="flex-1 min-w-[100px] flex items-center justify-end pr-2">
              <div className="flex items-center gap-2 text-muted-foreground opacity-50">
                  <Archive className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t('archive_stories')}</span>
              </div>
          </div>
      )}

      {!filterArchived && <UploadStoryDialog open={isUploadOpen} onOpenChange={setIsUploadOpen} currentUser={currentUser} />}

      {selectedUserForViewer && (
        <StoryViewer 
          userId={selectedUserForViewer} 
          stories={stories.filter(s => s.userId === selectedUserForViewer)}
          onClose={() => setSelectedUserForViewer(null)}
          currentUser={currentUser}
          user={storySenders[selectedUserForViewer] || (selectedUserForViewer === currentUser.uid ? currentUser : null)}
        />
      )}
    </div>
  );
}
