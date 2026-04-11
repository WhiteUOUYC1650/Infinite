'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Story, User, AuthenticatedUser } from '@/types';
import { X, ChevronLeft, ChevronRight, Trash2, Loader2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StoryViewerProps {
  userId: string;
  stories: Story[];
  onClose: () => void;
  currentUser: AuthenticatedUser;
  user: User | null;
}

export function StoryViewer({ userId, stories, onClose, currentUser, user }: StoryViewerProps) {
  const db = useFirestore();
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const currentStory = stories[currentIndex];
  const isOwner = userId === currentUser.uid;

  useEffect(() => {
    if (!currentStory || !db) return;
    
    // Mark as viewed
    if (!currentStory.viewedBy?.includes(currentUser.uid)) {
      updateDoc(doc(db, 'stories', currentStory.id), {
        viewedBy: arrayUnion(currentUser.uid)
      });
    }
  }, [currentIndex, currentStory, db, currentUser.uid]);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setProgress(0);
    const interval = 50; // Update every 50ms
    const totalTime = 5000; // 5 seconds per story
    const step = (interval / totalTime) * 100;

    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!db || !currentStory || !isOwner) return;
    setIsPaused(true);
    if (confirm(t('story_delete_confirm'))) {
      await deleteDoc(doc(db, 'stories', currentStory.id));
      if (stories.length === 1) onClose();
      else handleNext();
    }
    setIsPaused(false);
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
      {/* Progress Bars */}
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 z-[210] flex gap-1">
        {stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-[50ms] ease-linear"
              style={{ 
                width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' 
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-[calc(2rem+env(safe-area-inset-top))] left-4 right-4 z-[210] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-white/20">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="text-white drop-shadow-md">
            <p className="font-bold text-sm leading-none">{user?.name}</p>
            <p className="text-[10px] opacity-70 mt-1">{t('online')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <DropdownMenu onOpenChange={setIsPaused}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Media Content */}
      <div 
        className="relative w-full h-full max-w-lg aspect-[9/16] bg-zinc-900 overflow-hidden"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <img 
          src={currentStory.mediaUrl} 
          alt="Story" 
          className="w-full h-full object-contain"
        />
        
        {currentStory.caption && (
          <div className="absolute bottom-20 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-center">
            <p className="text-white text-lg font-medium drop-shadow-lg">{currentStory.caption}</p>
          </div>
        )}

        {/* Navigation Overlays */}
        <div className="absolute inset-0 flex">
          <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
          <div className="w-1/3 h-full" onClick={() => setIsPaused(!isPaused)} />
          <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
        </div>
      </div>
    </div>
  );
}
