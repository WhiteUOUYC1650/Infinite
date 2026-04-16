
'use client';

import type { AuthenticatedUser, User } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { TranslationKey } from '@/lib/translations';
import { Button } from './ui/button';
import { VerifiedBadge } from './ui/verified-badge';
import { PremBadge } from './ui/prem-badge';
import { BetaBadge } from './ui/beta-badge';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';
import { Badge } from './ui/badge';
import { InfGoldIcon } from './ui/inf-gold-icon';
import { useTheme } from '@/context/theme-context';

interface UserProfileCardProps {
  user: AuthenticatedUser;
  onEditProfile: () => void;
}

const statusTranslations: Record<User['status'], TranslationKey> = {
    online: 'online',
    away: 'away',
    offline: 'offline'
}

export function UserProfileCard({ user, onEditProfile }: UserProfileCardProps) {
  const { t } = useLanguage();
  const { experimentalDesign } = useTheme();

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
  
  if (experimentalDesign) {
    return (
      <div className="flex flex-col overflow-hidden max-h-[80vh]">
        {/* Experimental Header Background */}
        <div className="flex flex-col items-center pt-6 pb-4 px-4 bg-gradient-to-b from-primary/10 to-transparent shrink-0">
          <UserAvatarWithStatus user={user as any} className="w-24 h-24 text-3xl mb-4 border-4 border-background shadow-xl rounded-full experimental-glow" />
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold font-headline flex items-center justify-center gap-2">
              {displayName}
              {user.isAdmin && <VerifiedBadge />}
              {user.subscriptionTier === 'prem' && user.showPremBadge && <PremBadge />}
              {user.isBetaTester && <BetaBadge />}
            </h2>
            <p className="text-muted-foreground text-sm font-medium">{displayUsername}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{getStatusText(user)}</p>
          </div>
        </div>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {!user.isDeleted && !user.isBot && (
            <div className="flex items-center justify-center gap-2 py-2">
              <InfGoldIcon className="h-6 w-6 experimental-glow" />
              <span className="font-bold text-2xl tracking-tighter">{user.infGoldBalance ?? 0}</span>
            </div>
          )}

          {user.statusMessage && !user.isDeleted && (
            <div className="text-center p-4 bg-muted/40 rounded-[1.5rem] border border-border/50">
              <p className="text-sm italic text-muted-foreground leading-relaxed">"{user.statusMessage}"</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button 
              onClick={onEditProfile} 
              disabled={!!user.isDeleted}
              className="w-full rounded-[1.25rem] h-12 font-bold shadow-lg shadow-primary/20"
            >
              {t('edit_profile')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-6">
        <div className='relative mx-auto w-24 h-24 mb-4 shrink-0'>
             <UserAvatarWithStatus user={user} className="w-24 h-24 text-3xl" />
        </div>
        <div className="text-center">
            <div className="flex items-center justify-center gap-2">
                <h2 className="text-xl font-bold font-headline">
                    {displayName}
                </h2>
                {user.isAdmin && <VerifiedBadge />}
                {user.subscriptionTier === 'prem' && user.showPremBadge && <PremBadge />}
                {user.isBetaTester && <BetaBadge />}
            </div>

            {user.isBot ? (
                <p className="text-muted-foreground text-sm">/B/Infinite</p>
            ) : (
                <p className="text-muted-foreground text-sm">{displayUsername}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{getStatusText(user)}</p>

            {!user.isDeleted && !user.isBot && (
                 <div className="flex items-center justify-center gap-2 mt-4">
                    <InfGoldIcon className="h-5 w-5" />
                    <span className="font-semibold text-lg">{user.infGoldBalance ?? 0}</span>
                </div>
            )}
        </div>

        {user.statusMessage && !user.isDeleted && (
             <div className="text-center p-3 mt-4 bg-muted/50 rounded-lg max-h-32 overflow-y-auto">
                <p className="text-sm">{user.statusMessage}</p>
            </div>
        )}
       
        <div className='mt-6 flex justify-center'>
            <Button onClick={onEditProfile} disabled={!!user.isDeleted} className="w-full sm:w-auto">
                {t('edit_profile')}
            </Button>
        </div>
    </div>
  );
}
