
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { User } from '@/types';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { TranslationKey } from '@/lib/translations';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from './ui/verified-badge';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';
import { useTheme } from '@/context/theme-context';
import { MessageSquare, Phone, Bell, BellOff, X } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

interface UserProfileDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (user: User) => void;
}

const statusTranslations: Record<User['status'], TranslationKey> = {
    online: 'online',
    away: 'away',
    offline: 'offline'
}

export function UserProfileDialog({ user, open, onOpenChange, onSendMessage }: UserProfileDialogProps) {
  const { t } = useLanguage();
  const { experimentalDesign } = useTheme();
  const [isMuted, setIsMuted] = useState(false);
  const [showCompactHeader, setShowCompactHeader] = useState(false);

  useEffect(() => {
    if (open) {
        setShowCompactHeader(false);
    }
  }, [open]);

  const getStatusText = (user: User) => {
    if (user.isBot || user.isDeleted) return '';
    const statusKey = statusTranslations[user.status] || 'offline';
    let statusText = t(statusKey);
    
    if (user.status === 'offline' && user.lastSeen) {
      const lastSeenDate = new Date(user.lastSeen.seconds * 1000);
      statusText = `${t('was_online')} ${format(lastSeenDate, 'dd.MM.yyyy, HH:mm')}`;
    }
    
    return statusText;
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setShowCompactHeader(scrollTop > 100);
  };

  const displayName = user.isDeleted ? t('deleted_account') : user.name;
  const displayUsername = user.isDeleted ? '' : user.username;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-sm p-0 overflow-hidden h-[85vh] max-h-[85vh] flex flex-col", experimentalDesign ? "rounded-[2rem] border-none" : "rounded-lg")}>
        <div className="flex flex-col h-full overflow-hidden relative">
            {/* Compact Sticky Header */}
            <div 
                className={cn(
                    "absolute top-0 left-0 right-0 z-20 h-14 flex items-center px-4 transition-all duration-300 border-b",
                    showCompactHeader ? "bg-background/95 backdrop-blur-md opacity-100" : "bg-transparent opacity-0 pointer-events-none border-transparent"
                )}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <UserAvatarWithStatus user={user} className="h-8 w-8" />
                    <span className="font-bold font-headline truncate">{displayName}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="shrink-0 ml-2">
                    <X className="h-5 w-5" />
                </Button>
            </div>

            <div 
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto"
            >
                <div className={cn(experimentalDesign && "bg-gradient-to-b from-primary/10 to-background pt-6 pb-6 px-6")}>
                    <DialogHeader className="p-0 relative">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onOpenChange(false)} 
                            className={cn("absolute -top-2 -right-2 z-10 rounded-full", (showCompactHeader || !experimentalDesign) && "hidden")}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                        <DialogTitle className="sr-only">{displayName}'s Profile</DialogTitle>
                        <div className='relative mx-auto flex justify-center'>
                            <UserAvatarWithStatus user={user} className="w-28 h-28 text-4xl shadow-xl border-4 border-background rounded-full transition-transform duration-500" />
                        </div>
                    </DialogHeader>
                    <div className="text-center py-4">
                        <div className="flex items-center justify-center gap-2">
                            <h2 className="text-2xl font-bold font-headline truncate max-w-[250px]">{displayName}</h2>
                            {!user.isDeleted && (user.username === '@Infinite' || user.username === '@InfiniteBot' || user.username === '@VeoBot' || user.username === '@GeminiBot') && <VerifiedBadge />}
                            {!user.isDeleted && user.isBot && user.username !== '@Infinite' && user.username !== '@InfiniteBot' && <Badge variant="secondary">BOT</Badge>}
                        </div>
                        <p className="text-muted-foreground font-medium">{displayUsername}</p>
                        <p className="text-sm text-muted-foreground mt-1">{getStatusText(user)}</p>
                    </div>

                    {experimentalDesign && !user.isBot && !user.isDeleted && (
                        <div className="grid grid-cols-3 gap-3 w-full mt-4">
                            <button 
                                onClick={() => onSendMessage(user)}
                                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5 text-blue-500" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-tight">{t('message')}</span>
                            </button>
                            <button 
                                onClick={() => setIsMuted(!isMuted)}
                                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isMuted ? "bg-red-500/15" : "bg-orange-500/15")}>
                                    {isMuted ? <BellOff className="w-5 h-5 text-red-500" /> : <Bell className="w-5 h-5 text-orange-500" />}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-tight text-orange-600">{t('mute')}</span>
                            </button>
                            <button className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95">
                                <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                                    <Phone className="w-5 h-5 text-green-500" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-tight text-green-600">{t('audio_call')}</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className={cn("px-6 pb-8", !experimentalDesign && "pt-6")}>
                    {user.statusMessage && !user.isDeleted && (
                        <div className="text-center p-4 bg-muted/50 rounded-2xl mb-6">
                            <p className="text-sm italic text-muted-foreground leading-relaxed">"{user.statusMessage}"</p>
                        </div>
                    )}
                </div>
            </div>

            {!experimentalDesign && (
                <div className='shrink-0 p-6 border-t flex justify-center bg-background'>
                    <Button onClick={() => onSendMessage(user)} disabled={user.isBot || !!user.isDeleted} className="rounded-xl px-8">
                        {t('message')}
                    </Button>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
