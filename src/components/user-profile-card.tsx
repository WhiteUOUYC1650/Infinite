'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { AuthenticatedUser, User, Gift, SharedMusic } from '@/types';
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
import { Cake, Phone, Gift as GiftIcon, Loader2, Coins, Trash2, CheckCircle2, MessageSquareText, Bell, Search, MoreHorizontal, ArrowLeft, X, Music, Play, Pause } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { useFirestore, useCollection } from '@/firebase';
import { doc, updateDoc, deleteDoc, increment, collection, runTransaction, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from './ui/separator';
import { getCachedFile } from '@/lib/cache-utils';
import { formatPhoneNumber } from '@/lib/phone';

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
  const { experimentalDesign, glassEffect } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'gifts' | 'info'>( 'info');
  const [profileMusic, setProfileMusic] = useState<SharedMusic | null>(null);
  const [visiblePhone, setVisiblePhone] = useState<string | null>(null);

  const giftsQuery = useMemo(() => {
    if (!db || !user.uid) return null;
    return collection(db, 'users', user.uid, 'receivedGifts');
  }, [db, user.uid]);
  
  const { data: gifts, loading: giftsLoading } = useCollection<Gift>(giftsQuery);

  useEffect(() => {
    let cancelled = false;
    if (!db || !user.uid) return;
    getDoc(doc(db, 'userPhones', user.uid))
      .then(snap => {
        const data = snap.data();
        if (!cancelled) setVisiblePhone(snap.exists() && data && !data.hidden ? (data.phoneNumber as string) : null);
      })
      .catch(() => { if (!cancelled) setVisiblePhone(null); });
    return () => { cancelled = true; };
  }, [db, user.uid]);

  useEffect(() => {
      if (user.profileMusicId && db) {
          getDoc(doc(db, 'music', user.profileMusicId)).then(snap => {
              if (snap.exists()) setProfileMusic({ id: snap.id, ...snap.data() } as SharedMusic);
          });
      } else {
          setProfileMusic(null);
      }
  }, [user.profileMusicId, db]);

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
            const userRef = doc(db, 'users', user.uid!);
            const giftRef = doc(db, 'users', user.uid!, 'receivedGifts', gift.id);
            tx.update(userRef, { infGoldBalance: increment(gift.price) });
            tx.delete(giftRef);
            if (user.activeGiftEmoji === gift.emoji) tx.update(userRef, { activeGiftEmoji: null });
        });
        toast({ title: t('dm_success'), description: t('gift_exchanged', { amount: gift.price }) });
    } catch (e) { console.error(e); }
    finally { setIsProcessing(false); }
  };

  const handleSetActiveGift = async (gift: Gift) => {
      if (!db || isProcessing || !user.uid) return;
      setIsProcessing(true);
      try {
          await updateDoc(doc(db, 'users', user.uid), { activeGiftEmoji: gift.emoji });
          toast({ title: t('dm_success') });
      } catch (e) { console.error(e); }
      finally { setIsProcessing(false); }
  };

  // Ensure username starts with @ and only one @
  const sanitizedUsername = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : '';

  return (
    <div className={cn("flex flex-col overflow-hidden max-h-[85vh]", experimentalDesign ? "bg-transparent" : "bg-card")}>
      <div className="relative shrink-0">
          <div className="h-32 w-full bg-muted overflow-hidden">
              {user.bannerUrl ? (
                  <img src={user.bannerUrl} className="w-full h-full object-cover" alt="Banner" />
              ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
              )}
          </div>
          <div className="absolute top-4 right-6 flex gap-2">
              <Button variant="ghost" size="icon" onClick={onEditProfile} className="rounded-full h-10 px-4 glass-button border-none bg-black/30 text-white font-black text-[10px] uppercase tracking-widest backdrop-blur-md">Edit</Button>
          </div>
          <div className="absolute -bottom-12 left-6">
                <div className="relative">
                    <UserAvatarWithStatus user={user as any} className={cn("text-4xl shadow-2xl border-4 border-background rounded-full w-24 h-24")} />
                    {user.activeGiftEmoji && (
                        <div className="absolute -bottom-1 -right-1 bg-background rounded-full w-9 h-9 flex items-center justify-center text-lg shadow-lg border-2 border-primary/20">
                            {user.activeGiftEmoji}
                        </div>
                    )}
                </div>
          </div>
      </div>

      <div className="pt-16 pb-6 px-6 shrink-0 text-left">
          <div className="flex items-center gap-2">
            <h2 className={cn("font-bold font-headline truncate text-2xl")}>{user.isDeleted ? t('deleted_account') : user.name}</h2>
            {user.isAdmin && <VerifiedBadge className="w-5 h-5" />}
            {user.subscriptionTier === 'prem' && user.showPremBadge && <PremBadge />}
            {user.isBetaTester && <BetaBadge />}
          </div>
          <p className={cn("uppercase tracking-widest font-black text-[10px] text-muted-foreground/80 mt-1")}>{getStatusText(user)}</p>
      </div>

      <ScrollArea className="flex-1 px-6 pb-6">
        <div className="space-y-6 pb-2">
            {profileMusic && <ProfileVibeCard music={profileMusic} db={db!} />}

            <div className={cn("text-left p-5 rounded-2xl border", "bg-muted/30 border-border/50")}>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">username</p>
                <p className="font-bold text-sm mb-4">{sanitizedUsername}</p>
                <Separator className="opacity-10 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">bio</p>
                <p className="text-sm font-medium leading-relaxed">{user.statusMessage || 'Hey there! I am using Infinite.'}</p>
                {visiblePhone && (
                    <>
                        <Separator className="opacity-10 my-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">{t('phone_number')}</p>
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <Phone className="h-4 w-4" />
                            <span>{formatPhoneNumber(visiblePhone)}</span>
                        </div>
                    </>
                )}
                {birthdayText && (
                    <>
                        <Separator className="opacity-10 my-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">birthday</p>
                        <div className="flex items-center gap-2 text-sm font-bold text-primary">
                            <Cake className="h-4 w-4" />
                            <span>{birthdayText}</span>
                        </div>
                    </>
                )}
            </div>

            <div className="flex items-center justify-center gap-3 py-2 bg-primary/5 rounded-2xl border border-primary/10">
                <InfGoldIcon className="h-6 w-6 experimental-glow" />
                <span className="font-black text-2xl tracking-tighter text-primary">{user.infGoldBalance ?? 0}</span>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('gifts')} ({gifts?.length || 0})</h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {gifts?.map(gift => (
                        <div key={gift.id} className={cn("border p-3 rounded-2xl flex flex-col gap-2 group bg-muted/30 border-border/50")}>
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
                        </div>
                    ))}
                    {gifts?.length === 0 && !giftsLoading && (
                        <div className="text-center py-10 border-2 border-dashed rounded-[2rem] opacity-30">
                            <p className="text-[10px] font-black uppercase tracking-widest">{t('no_gifts')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function ProfileVibeCard({ music, db }: { music: SharedMusic, db: any }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const load = async () => {
            const cached = await getCachedFile(music.id);
            if (cached) { setAudioUrl(cached); return; }
            if (music.musicChunkIds) {
                const chunksData: any[] = [];
                for (const cid of music.musicChunkIds) {
                    const s = await getDoc(doc(db, 'musicChunks', cid));
                    if (s.exists()) chunksData.push(s.data());
                }
                chunksData.sort((a,b) => a.part - b.part);
                const assembled = chunksData.map(c => c.data).join('');
                setAudioUrl(`data:${music.musicMimeType};base64,${assembled}`);
            }
        };
        load();
    }, [music, db]);

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.pause();
        else {
            window.dispatchEvent(new CustomEvent('stop-media', { detail: { id: 'profile' } }));
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <div className="relative p-5 rounded-[2rem] bg-indigo-600 text-white overflow-hidden shadow-xl animate-in zoom-in duration-500">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="flex items-center gap-5 relative z-10">
                <div className={cn("w-14 h-14 rounded-full bg-white/20 flex items-center justify-center relative shadow-inner overflow-hidden", isPlaying && "animate-spin [animation-duration:8s]")}>
                    {music.coverUrl ? <img src={music.coverUrl} className="w-full h-full object-cover" /> : <Music className="w-6 h-6" />}
                    <div className="absolute inset-0 bg-black/20" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/50 mb-1">Current Vibe</p>
                    <h4 className="font-bold text-base truncate leading-tight">{music.title}</h4>
                    <p className="text-xs font-medium text-white/70 truncate">{music.author}</p>
                </div>
                <Button onClick={toggle} size="icon" className="w-12 h-12 rounded-full bg-white text-indigo-600 hover:bg-white/90 shadow-lg shrink-0">
                    {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
                </Button>
            </div>
            {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
        </div>
    );
}
