'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Story, User, AuthenticatedUser } from '@/types';
import { X, Trash2, Copy, Download, MoreVertical, Clock, Eye } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StoryViewerProps {
  userId: string;
  stories: Story[];
  onClose: () => void;
  currentUser: AuthenticatedUser;
  user: User | null;
}

const getSafeDate = (ts: any): Date => {
  if (ts && typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000);
  }
  return new Date();
};

const STANDARD_COLORS: Record<string, string> = {
  '0': '#000000',
  '1': '#0000AA',
  '2': '#00AA00',
  '3': '#00AAAA',
  '4': '#AA0000',
  '5': '#AA00AA',
  '6': '#FFAA00',
  '7': '#AAAAAA',
  '8': '#555555',
  '9': '#5555FF',
  'a': '#55FF55',
  'b': '#55FFFF',
  'c': '#FF5555',
  'd': '#FF55FF',
  'e': '#FFFF55',
  'f': '#FFFFFF',
};

const ColoredText = ({ text }: { text: string }) => {
  const regex = /(§[0-9a-fA-F]|§\[[0-9a-fA-F]{3,6}\])/g;
  const parts = text.split(regex);
  
  if (parts.length === 1) return <>{text}</>;

  let currentColor: string | undefined = undefined;

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        
        if (part.startsWith('§')) {
          if (part.startsWith('§[')) {
            const hex = part.slice(2, -1);
            currentColor = `#${hex}`;
          } else {
            const code = part[1].toLowerCase();
            currentColor = STANDARD_COLORS[code];
          }
          return null; 
        }
        
        return (
          <span key={i} style={{ color: currentColor }}>
            {part}
          </span>
        );
      })}
    </>
  );
};

const processMarkdownChildren = (children: any): any => {
    return React.Children.map(children, child => {
        if (typeof child === 'string') {
            return <ColoredText text={child} />;
        }
        if (React.isValidElement(child) && child.props.children) {
            return React.cloneElement(child, {
                children: processMarkdownChildren(child.props.children)
            } as any);
        }
        return child;
    });
};

export function StoryViewer({ userId, stories, onClose, currentUser, user }: StoryViewerProps) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const currentStory = stories[currentIndex];
  const isOwner = userId === currentUser.uid;

  useEffect(() => {
    if (!currentStory || !db) return;
    
    if (!currentStory.viewedBy?.includes(currentUser.uid)) {
      updateDoc(doc(db, 'stories', currentStory.id), {
        viewedBy: arrayUnion(currentUser.uid)
      });
    }
  }, [currentIndex, currentStory, db, currentUser.uid]);

  const effectivePaused = isPaused || isMenuOpen || showDeleteConfirm;

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
    try {
      await deleteDoc(doc(db, 'stories', currentStory.id));
      toast({ title: t('dm_success') });
      if (stories.length === 1) {
          onClose();
      } else {
          setProgress(0);
          if (currentIndex >= stories.length - 1) {
              setCurrentIndex(Math.max(0, stories.length - 2));
          }
      }
    } catch (e) {
      console.error("Failed to delete story", e);
    } finally {
        setShowDeleteConfirm(false);
    }
  };

  if (!mounted || !currentStory) return null;

  const storyDate = getSafeDate(currentStory.timestamp);
  const formattedDate = format(storyDate, 'dd.MM.yyyy, HH:mm');

  const content = (
    <>
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300 w-screen h-svh overflow-hidden">
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
              className="w-full h-full object-contain"
            />
            {currentStory.caption && (
              <div className="absolute bottom-0 left-0 right-0 p-8 pb-[calc(4rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/40 to-transparent text-center z-[215]">
                <div className="text-white text-xl font-medium drop-shadow-lg max-w-lg mx-auto prose prose-invert">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                        p: ({children}) => <p>{processMarkdownChildren(children)}</p>,
                        a: ({children}) => <span>{children}</span>
                    }}
                  >
                    {currentStory.caption}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-10 text-center relative" style={{ background: 'hsl(var(--primary))' }}>
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
            <div className="relative z-10 text-white text-3xl md:text-5xl font-black font-headline leading-tight drop-shadow-2xl animate-in zoom-in duration-500 max-w-2xl prose prose-invert">
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                        p: ({children}) => <p>{processMarkdownChildren(children)}</p>,
                        a: ({children}) => <span>{children}</span>
                    }}
                >
                    {currentStory.caption || ''}
                </ReactMarkdown>
            </div>
          </div>
        )}

        <div className="absolute top-0 left-0 right-0 p-4 pt-[calc(1.5rem+env(safe-area-inset-top))] bg-gradient-to-b from-black/80 via-black/40 to-transparent z-[220]">
          <div className="flex gap-1.5 mb-6 max-w-4xl mx-auto">
            {stories.map((_, i) => (
              <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                  style={{ 
                    width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                    transitionDuration: '50ms',
                    transitionTimingFunction: 'linear'
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between max-w-4xl mx-auto px-2">
            <div className="flex items-center gap-3">
              <Avatar className="w-11 h-11 border-2 border-white/20 shadow-lg">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-zinc-800 text-white">{user?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="text-white drop-shadow-lg">
                <p className="font-bold text-base leading-none">{user?.name}</p>
                <div className="flex items-center gap-1.5 text-[10px] opacity-80 mt-1.5 font-bold uppercase tracking-wider">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{formattedDate}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-10 w-10">
                    <MoreVertical className="w-6 h-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl z-[10000] w-48">
                  {isOwner && (
                    <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10 font-bold">
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('delete')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full h-10 w-10">
                <X className="w-7 h-7" />
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-8 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 z-[230]">
          <Eye className="w-4 h-4 text-white" />
          <span className="text-white text-xs font-bold">
            {currentStory.viewedBy?.length || 0}
          </span>
        </div>

        <div className="absolute inset-0 flex z-[210]">
          <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
          <div className="w-1/3 h-full" onClick={() => setIsPaused(!isPaused)} />
          <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
        </div>
      </div>
    </div>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
            <AlertDialogHeader className="items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                    <Trash2 className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-2">
                    <AlertDialogTitle className="text-2xl font-bold font-headline">{t('are_you_sure')}</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                        {t('story_delete_confirm')}
                    </AlertDialogDescription>
                </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center gap-2 pt-2">
                <AlertDialogCancel className="rounded-xl px-8 h-12 font-bold min-w-[120px]">{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className={cn(buttonVariants({ variant: 'destructive' }), "rounded-xl px-8 h-12 font-bold min-w-[120px]")}>
                    {t('delete')}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );

  return createPortal(content, document.body);
}
