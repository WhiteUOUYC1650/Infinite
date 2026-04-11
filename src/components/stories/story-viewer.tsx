'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Story, User, AuthenticatedUser } from '@/types';
import { X, ChevronLeft, ChevronRight, Trash2, Loader2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const currentStory = stories[currentIndex];
  const isOwner = userId === currentUser.uid;

  // Mark story as viewed
  useEffect(() => {
    if (!currentStory || !db) return;
    
    if (!currentStory.viewedBy?.includes(currentUser.uid)) {
      updateDoc(doc(db, 'stories', currentStory.id), {
        viewedBy: arrayUnion(currentUser.uid)
      });
    }
  }, [currentIndex, currentStory, db, currentUser.uid]);

  // Combined pause state: if user is holding or if the menu is open
  const effectivePaused = isPaused || isMenuOpen;

  // Handle the timer interval
  useEffect(() => {
    if (effectivePaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const interval = 50; 
    const totalTime = 5000; 
    const step = (interval / totalTime) * 100;

    timerRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + step;
        return next > 100 ? 100 : next;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, effectivePaused]);

  // Watch for progress completion to move to next story
  useEffect(() => {
    if (progress >= 100) {
      handleNext();
    }
  }, [progress]);

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
    
    const confirmDelete = window.confirm(t('story_delete_confirm'));
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'stories', currentStory.id));
      if (stories.length === 1) {
        onClose();
      } else {
        handleNext();
      }
    } catch (e) {
      console.error("Failed to delete story", e);
    }
  };

  if (!mounted || !currentStory) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300 w-screen h-svh overflow-hidden">
      {/* Media Content */}
      <div 
        className="relative w-full h-full bg-zinc-950 overflow-hidden flex items-center justify-center"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {currentStory.mediaUrl ? (
          <>
            <img 
              src={currentStory.mediaUrl} 
              alt="Story" 
              className="w-full h-full object-cover"
            />
            {currentStory.caption && (
              <div className="absolute bottom-0 left-0 right-0 p-8 pb-[calc(4rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/40 to-transparent text-center z-[215]">
                <p className="text-white text-xl font-medium drop-shadow-lg max-w-lg mx-auto">
                  {currentStory.caption}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#FF8C00] to-[#FF4500] flex items-center justify-center p-10 text-center">
            <p className="text-white text-3xl md:text-5xl font-black font-headline leading-tight drop-shadow-2xl animate-in zoom-in duration-500 max-w-2xl">
              {currentStory.caption}
            </p>
          </div>
        )}

        {/* Top Overlay - Progress and Header */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-[calc(1.5rem+env(safe-area-inset-top))] bg-gradient-to-b from-black/80 via-black/40 to-transparent z-[220]">
          {/* Progress Bars */}
          <div className="flex gap-1.5 mb-6 max-w-4xl mx-auto">
            {stories.map((_, i) => (
              <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-[50ms] ease-linear shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                  style={{ 
                    width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' 
                  }}
                />
              </div>
            ))}
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center justify-between max-w-4xl mx-auto px-2">
            <div className="flex items-center gap-3">
              <Avatar className="w-11 h-11 border-2 border-white/20 shadow-lg">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-zinc-800 text-white">{user?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="text-white drop-shadow-lg">
                <p className="font-bold text-base leading-none">{user?.name}</p>
                <p className="text-[11px] opacity-80 mt-1.5 font-bold uppercase tracking-wider">{t('online')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <DropdownMenu onOpenChange={setIsMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-10 w-10">
                      <MoreVertical className="w-6 h-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl z-[10000]">
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10 font-bold">
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full h-10 w-10">
                <X className="w-7 h-7" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Touch Zones */}
        <div className="absolute inset-0 flex z-[210]">
          <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
          <div className="w-1/3 h-full" onClick={() => setIsPaused(!isPaused)} />
          <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
