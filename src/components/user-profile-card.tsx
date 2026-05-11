'use client';

import React, { useMemo } from 'react';
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
import { Cake } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

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
    if (user.isDeleted) return '';
    if (user.isBot) return t('bot_status');
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

  const birthdayText = useMemo(() => {
    if (!user.birthday) return null;
    const months = (t('months') || '').split(',');
    return `${user.birthday.day} ${months[user.birthday.month - 1]}${user.birthday.year ? `, ${user.birthday.year}` : ''}`;
  }, [user.birthday, t]);
  
  return (
    <div className={cn("flex flex-col overflow-hidden max-h-[85vh]", experimentalDesign ? "bg-transparent" : "bg-card")}>
      {/* Experimental Header Background */}
      <div className={cn(
        "flex flex-col items-center pt-8 pb-6 px-6 shrink-0",
        experimentalDesign ? "bg-gradient-to-b from-primary/15 to-transparent" : ""
      )}>
        <UserAvatarWithStatus user={user as any} className="w-24 h-24 text-3xl mb-4 border-4 border-background shadow-xl rounded-full experimental-glow" />
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl font-bold font-headline truncate">
              {displayName}
            </h2>
            {user.isAdmin && <VerifiedBadge />}
            {user.subscriptionTier === 'prem' && user.showPremBadge && <PremBadge />}
            {user.isBetaTester && <BetaBadge />}
          </div>
          <p className="text-muted-foreground text-sm font-medium">{displayUsername}</p>
          <p className={cn("text-[10px] uppercase tracking-wider font-black", user.isBot ? "text-primary" : "text-muted-foreground")}>{getStatusText(user)}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6 pb-6">
        <div className="space-y-4 pb-2">
          {!user.isDeleted && !user.isBot && (
            <div className="flex items-center justify-center gap-2 py-2">
              <InfGoldIcon className="h-6 w-6 experimental-glow" />
              <span className="font-bold text-2xl tracking-tighter">{user.infGoldBalance ?? 0}</span>
            </div>
          )}

          {birthdayText && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-primary">
                <Cake className="h-3.5 w-3.5" />
                <span>{birthdayText}</span>
            </div>
          )}

          {user.statusMessage && !user.isDeleted && (
            <div className={cn(
                "text-center p-4 rounded-[1.5rem] border",
                experimentalDesign ? "bg-card/40 backdrop-blur-md border-white/10" : "bg-muted/50 border-border/50"
            )}>
              <p className="text-sm italic text-muted-foreground leading-relaxed">"{user.statusMessage}"</p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button 
              onClick={onEditProfile} 
              disabled={!!user.isDeleted}
              className={cn(
                "w-full h-12 font-bold shadow-lg",
                experimentalDesign ? "rounded-[1.25rem] glass-send" : "rounded-xl"
              )}
            >
              {t('edit_profile')}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
