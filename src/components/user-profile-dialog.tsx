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

interface UserProfileDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (user: User) => void;
}

const statusColors = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    offline: "bg-gray-400",
};

const statusTranslations: Record<User['status'], TranslationKey> = {
    online: 'online',
    away: 'away',
    offline: 'offline'
}

export function UserProfileDialog({ user, open, onOpenChange, onSendMessage }: UserProfileDialogProps) {
  const { t } = useLanguage();

  const getStatusText = (user: User) => {
    if (user.isBot) return '';
    const statusKey = statusTranslations[user.status] || 'offline';
    let statusText = t(statusKey);
    
    if (user.status === 'offline' && user.lastSeen) {
      const lastSeenDate = new Date(user.lastSeen.seconds * 1000);
      statusText = `${t('was_online')} ${format(lastSeenDate, 'dd.MM.yyyy, HH:mm')}`;
    }
    
    return statusText;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
            <DialogTitle className="sr-only">{user.name}'s Profile</DialogTitle>
            <div className='relative mx-auto w-32 h-32'>
                 <Avatar className="w-32 h-32 text-4xl">
                    {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                {!user.isBot && user.status && (
                    <span
                        className={cn(
                        "absolute bottom-2 right-2 block h-5 w-5 rounded-full ring-4 ring-background",
                        statusColors[user.status]
                        )}
                    />
                )}
            </div>
        </DialogHeader>
        <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-bold font-headline">{user.name}</h2>
                {user.isBot && <Badge variant="secondary">BOT</Badge>}
            </div>
            {user.isBot ? (
                <p className="text-muted-foreground">/B/Infinite</p>
            ) : (
                <p className="text-muted-foreground">{user.username}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{getStatusText(user)}</p>
        </div>

        {user.statusMessage && (
             <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">{user.statusMessage}</p>
            </div>
        )}
       
        <DialogFooter className='!justify-center'>
            <Button onClick={() => onSendMessage(user)} disabled={user.isBot}>
                {t('message')}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
