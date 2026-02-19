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
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { TranslationKey } from '@/lib/translations';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from './ui/verified-badge';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';
import { useTheme } from '@/context/theme-context';
import { MessageSquare, Phone, BellOff, Bell } from 'lucide-react';

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

  const displayName = user.isDeleted ? t('deleted_account') : user.name;
  const displayUsername = user.isDeleted ? '' : user.username;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-sm", experimentalDesign && "rounded-3xl p-0 gap-0 overflow-hidden border-none")}>
        <div className={cn(experimentalDesign && "bg-gradient-to-b from-primary/10 to-transparent pt-10 pb-6 px-6")}>
            <DialogHeader>
                <DialogTitle className="sr-only">{displayName}'s Profile</DialogTitle>
                <div className='relative mx-auto w-32 h-32'>
                    <UserAvatarWithStatus user={user} className="w-32 h-32 text-4xl shadow-xl border-4 border-background" />
                </div>
            </DialogHeader>
            <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2">
                    <h2 className="text-2xl font-bold font-headline">{displayName}</h2>
                    {!user.isDeleted && (user.username === '@Infinite' || user.username === '@InfiniteBot') && <VerifiedBadge />}
                    {!user.isDeleted && user.isBot && user.username !== '@Infinite' && user.username !== '@InfiniteBot' && <Badge variant="secondary">BOT</Badge>}
                </div>
                <p className="text-muted-foreground font-medium">{displayUsername}</p>
                <p className="text-sm text-muted-foreground mt-1">{getStatusText(user)}</p>
            </div>

            {experimentalDesign && !user.isBot && !user.isDeleted && (
                <div className="grid grid-cols-3 gap-3 w-full mt-4">
                    <button 
                        onClick={() => onSendMessage(user)}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-blue-500" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tight">{t('message')}</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-all active:scale-95">
                        <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                            <Phone className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tight text-green-600">{t('audio_call')}</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-all active:scale-95">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Bell className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">MUTE</span>
                    </button>
                </div>
            )}
        </div>

        <div className={cn(experimentalDesign && "px-6 pb-8")}>
            {user.statusMessage && !user.isDeleted && (
                <div className="text-center p-4 bg-muted/50 rounded-2xl mb-6">
                    <p className="text-sm italic">{user.statusMessage}</p>
                </div>
            )}
        
            {!experimentalDesign && (
                <DialogFooter className='!justify-center'>
                    <Button onClick={() => onSendMessage(user)} disabled={user.isBot || !!user.isDeleted}>
                        {t('message')}
                    </Button>
                </DialogFooter>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
