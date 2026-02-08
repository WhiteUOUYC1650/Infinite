'use client';

import type { AuthenticatedUser, User } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { TranslationKey } from '@/lib/translations';
import { Button } from './ui/button';
import { VerifiedBadge } from './ui/verified-badge';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';

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
    if (user.isBot || user.isDeleted) return '';
    if (!user.status) return '';
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
    <div className="flex flex-col">
        <div className='relative mx-auto w-24 h-24 mb-4'>
             <UserAvatarWithStatus user={user} className="w-24 h-24 text-3xl" />
        </div>
        <div className="text-center">
            <h2 className="text-xl font-bold font-headline flex items-center justify-center gap-2">
                {displayName}
                {user.isAdmin && <VerifiedBadge />}
            </h2>
            {user.isBot ? (
                <p className="text-muted-foreground text-sm">/B/Infinite</p>
            ) : (
                <p className="text-muted-foreground text-sm">{displayUsername}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{getStatusText(user)}</p>
        </div>

        {user.statusMessage && !user.isDeleted && (
             <div className="text-center p-3 mt-4 bg-muted/50 rounded-lg">
                <p className="text-sm">{user.statusMessage}</p>
            </div>
        )}
       
        <div className='mt-4 flex justify-center'>
            <Button onClick={onEditProfile} disabled={!!user.isDeleted}>
                {t('edit_profile')}
            </Button>
        </div>
    </div>
  );
}
