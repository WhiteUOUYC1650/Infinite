'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { AuthenticatedUser, User, Gift } from '@/types';
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
import { Cake, Gift as GiftIcon, Loader2, Coins, Trash2, CheckCircle2, MessageSquareText } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { useFirestore, useCollection } from '@/firebase';
import { doc, updateDoc, deleteDoc, increment, collection, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

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
  const db = useFirestore();
  const { toast } = useToast();
  const { experimentalDesign } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);

  const giftsQuery = useMemo(() => {
    if (!db || !user.uid) return null;
    return collection(db, 'users', user.uid, 'receivedGifts');
  }, [db, user.uid]);
  
  const { data: gifts, loading: giftsLoading } = useCollection<Gift>(giftsQuery);

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
  
  const birthdayText = useMemo(() => {
    if (!user.birthday) return null;
    const months = (t('months') || '').split(',');
    return `${user.birthday.day} ${months[user.birthday.month - 1]}${user.birthday.year ? `, ${user.birthday.year}` : ''}`;
  }, [user.birthday, t]);

  const handleExchangeGift = async (gift: Gift) => {
    if (!db || isProcessing) return;
    setIsProcessing(true);
    try {
        await runTransaction(db, async (tx) => {
            const userRef = doc(db, 'users', user.uid);
            const giftRef = doc(db, 'users', user.uid, 'receivedGifts', gift.id);
            tx.update(userRef, { infGoldBalance: increment(gift.price) });
            tx.delete(giftRef);
            if (user.activeGiftEmoji === gift.emoji) {
                tx.update(userRef, { activeGiftEmoji: null });
            }
        });
        toast({ title: t('dm_success'), description: t('gift_exchanged', { amount: gift.price }) });
    } catch (e) { console.error(e); }
    finally { setIsProcessing(false); }
  };

  const handleSetActiveGift = async (gift: Gift) => {
      if (!db || isProcessing) return;
      setIsProcessing(true);
      try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { activeGiftEmoji: gift.emoji });
          toast({ title: t('dm_success') });
      } catch (e) { console.error(e); }
      finally { setIsProcessing(false); }
  };

  const handleRemoveActiveGift = async () => {
      if (!db || isProcessing) return;
      setIsProcessing(true);
      try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { activeGiftEmoji: null });
          toast({ title: t('dm_success') });
      } catch (e) { console.error(e); }
      finally { setIsProcessing(false); }
  };
  
  return (
    <div className={cn("flex flex-col overflow-hidden max-h-[85vh]", experimentalDesign ? "bg-transparent" : "bg-card")}>
      <div className={cn(
        "flex flex-col items-center pt-8 pb-6 px-6 shrink-0",
        experimentalDesign ? "bg-gradient-to-b from-primary/15 to-transparent" : ""
      )}>
        <div className="relative mb-4">
            <UserAvatarWithStatus user={user as any} className="w-24 h-24 text-3xl border-4 border-background shadow-xl rounded-full experimental-glow" />
            {user.activeGiftEmoji && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full w-8 h-8 flex items-center justify-center text-lg shadow-lg border-2 border-primary/20">
                    {user.activeGiftEmoji}
                </div>
            )}
        </div>
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl font-bold font-headline truncate">{user.isDeleted ? t('deleted_account') : user.name}</h2>
            {user.isAdmin && <VerifiedBadge />}
            {user.subscriptionTier === 'prem' && user.showPremBadge && <PremBadge />}
            {user.isBetaTester && <BetaBadge />}
          </div>
          <p className="text-muted-foreground text-sm font-medium">{user.username}</p>
          <p className={cn("text-[10px] uppercase tracking-wider font-black", user.isBot ? "text-primary" : "text-muted-foreground")}>{getStatusText(user)}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6 pb-6">
        <div className="space-y-6 pb-2">
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
            <div className={cn("text-center p-4 rounded-[1.5rem] border", experimentalDesign ? "bg-card/40 backdrop-blur-md border-white/10" : "bg-muted/50 border-border/50")}>
              <p className="text-sm italic text-muted-foreground leading-relaxed">"{user.statusMessage}"</p>
            </div>
          )}

          {/* Gifts Management */}
          {!user.isBot && (
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('gifts')}</h3>
                    {user.activeGiftEmoji && (
                        <Button variant="ghost" size="sm" onClick={handleRemoveActiveGift} className="h-6 text-[9px] font-bold uppercase rounded-full">
                            {t('remove_from_profile')}
                        </Button>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {gifts?.map(gift => (
                        <div key={gift.id} className="bg-muted/30 border border-border/50 p-3 rounded-2xl flex flex-col gap-2 group">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{gift.emoji}</span>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">From {gift.senderName}</p>
                                        <p className="text-xs font-black text-primary">{gift.price} G</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleSetActiveGift(gift)} className={cn("h-8 w-8 rounded-xl", user.activeGiftEmoji === gift.emoji && "text-primary bg-primary/10")}>
                                        <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleExchangeGift(gift)} className="h-8 w-8 rounded-xl text-amber-600 hover:bg-amber-50">
                                        <Coins className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            {gift.message && (
                                <div className="flex items-start gap-2 bg-background/40 p-2 rounded-xl border border-border/20">
                                    <MessageSquareText className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                    <p className="text-[11px] leading-tight text-foreground/80 italic">{gift.message}</p>
                                </div>
                            )}
                        </div>
                    ))}
                    {gifts?.length === 0 && !giftsLoading && (
                        <div className="text-center py-6 border-2 border-dashed rounded-2xl opacity-40">
                            <GiftIcon className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-[9px] font-bold uppercase tracking-widest">{t('no_gifts')}</p>
                        </div>
                    )}
                </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={onEditProfile} disabled={!!user.isDeleted} className={cn("w-full h-12 font-bold shadow-lg", experimentalDesign ? "rounded-[1.25rem] glass-send" : "rounded-xl")}>
              {t('edit_profile')}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
