'use client';

import type { AuthenticatedUser, User } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { TranslationKey } from '@/lib/translations';
import { Button } from './ui/button';

interface UserProfileCardProps {
  user: AuthenticatedUser;
  onEditProfile: () => void;
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

export function UserProfileCard({ user, onEditProfile }: UserProfileCardProps) {
  const { t } = useLanguage();

  const getStatusText = (user: AuthenticatedUser) => {
    if (!user.status) return '';
    const statusKey = statusTranslations[user.status] || 'offline';
    let statusText = t(statusKey);
    
    if (user.status === 'offline' && user.lastSeen) {
      const lastSeenDate = new Date(user.lastSeen.seconds * 1000);
      statusText = `${t('was_online')} ${format(lastSeenDate, 'dd.MM.yyyy, HH:mm')}`;
    }
    
    return statusText;
  }

  return (
    <div className="flex flex-col">
        <div className='relative mx-auto w-24 h-24 mb-4'>
             <Avatar className="w-24 h-24 text-3xl">
                {user.avatar ? <AvatarImage src={user.avatar} alt={user.name || ''} /> : null}
                <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            {user.status && (
                <span
                    className={cn(
                    "absolute bottom-1 right-1 block h-4 w-4 rounded-full ring-2 ring-background",
                    statusColors[user.status]
                    )}
                />
            )}
        </div>
        <div className="text-center">
            <h2 className="text-xl font-bold font-headline">{user.name}</h2>
            <p className="text-muted-foreground text-sm">{user.username}</p>
            <p className="text-xs text-muted-foreground mt-1">{getStatusText(user)}</p>
        </div>

        {user.statusMessage && (
             <div className="text-center p-3 mt-4 bg-muted/50 rounded-lg">
                <p className="text-sm">{user.statusMessage}</p>
            </div>
        )}
       
        <div className='mt-4 flex justify-center'>
            <Button onClick={onEditProfile}>
                {t('edit_profile')}
            </Button>
        </div>
    </div>
  );
}
