
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { User, CustomBot, BotMiniApp, Gift, SharedMusic } from '@/types';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { TranslationKey } from '@/lib/translations';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from './ui/verified-badge';
import { PremBadge } from './ui/prem-badge';
import { BetaBadge } from './ui/beta-badge';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';
import { useTheme } from '@/context/theme-context';
import { MessageSquare, Phone, Bell, BellOff, X, Coins, Loader2, Cake, Video, ArrowLeft, LayoutGrid, Globe, ExternalLink, SeparatorHorizontal, Sparkles, Gift as GiftIcon, MessageSquareText, Search, MoreHorizontal, User as UserIcon, Music, Play, Pause } from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, doc, runTransaction, increment, getDoc, setDoc, serverTimestamp, query, where, limit, getDocs, orderBy, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { InfGoldIcon } from './ui/inf-gold-icon';
import { ScrollArea } from './ui/scroll-area';
import { Capacitor } from '@capacitor/core';
import { Separator } from './ui/separator';
import { GiftPickerDialog } from './gifts/gift-picker-dialog';
import { getCachedFile } from '@/lib/cache-utils';

interface UserProfileDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (user: User) => void;
}

const statusTranslations: Record<User['status'], TranslationKey> = { online: 'online', away: 'away', offline: 'offline' }

export function UserProfileDialog({ user, open, onOpenChange, onSendMessage }: UserProfileDialogProps) {
  const { t } = useLanguage();
  const { user: authUser } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { experimentalDesign, glassEffect } = useTheme();
  const [isMuted, setIsMuted] = useState(false);
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const [showSendGold, setShowSendGold] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [sendAmount, setSendAmount] = useState('10');
  const [isSendingGold, setIsSendingGold] = useState(false);
  const [botData, setBotData] = useState<CustomBot | null>(null);
  const [activeMiniApp, setActiveMiniApp] = useState<BotMiniApp | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'gifts' | 'apps'>('info');
  const [profileMusic, setProfileMusic] = useState<SharedMusic | null>(null);

  const giftsQuery = useMemo(() => {
    if (!db || !user.id) return null;
    return collection(db, 'users', user.id, 'receivedGifts');
  }, [db, user.id]);
  
  const { data: gifts, loading: giftsLoading } = useCollection<Gift>(giftsQuery);

  useEffect(() => {
      if (user.profileMusicId && db) {
          getDoc(doc(db, 'music', user.profileMusicId)).then(snap => {
              if (snap.exists()) setProfileMusic({ id: snap.id, ...snap.data() } as SharedMusic);
          });
      } else {
          setProfileMusic(null);
      }
  }, [user.profileMusicId, db]);

  useEffect(() => { 
    if (open) { 
        setShowCompactHeader(false); setShowSendGold(false); setShowGiftPicker(false);
        setSendAmount('10'); setActiveMiniApp(null); setActiveTab('info');
        if (user.isCustomBot && db) { getDoc(doc(db, 'customBots', user.id)).then(snap => { if (snap.exists()) setBotData(snap.data() as CustomBot); }); }
    } 
  }, [open, user.id, user.isCustomBot, db]);

  const getStatusText = (u: User) => {
    if (u.isDeleted) return '';
    if (u.isBot) return t('bot_status');
    if (!u.status) return '';
    const statusKey = statusTranslations[u.status] || 'offline';
    let statusText = t(statusKey);
    if (u.status === 'offline' && u.lastSeen) {
      const lastSeenDate = new Date(u.lastSeen.seconds * 1000);
      statusText = `${t('was_online')} ${format(lastSeenDate, 'dd.MM.yyyy, HH:mm')}`;
    }
    return statusText;
  }

  const handleStartMessage = async () => {
    if (!db || !authUser) return;
    const mem = [authUser.uid, user.id].sort(); const cid = mem.join('_');
    const snap = await getDoc(doc(db, 'chats', cid));
    if (!snap.exists()) { await setDoc(doc(db, 'chats', cid), { type: 'dm', members: mem, unreadCounts: { [authUser.uid]: 0, [user.id]: 0 }, }); }
    onSendMessage(user); onOpenChange(false);
  };

  const handleSendGold = async () => {
    if (!db || !authUser || !user.id || isSendingGold) return;
    const amount = parseInt(sendAmount);
    if (isNaN(amount) || amount <= 0) { toast({ variant: 'destructive', title: 'Error', description: t('invalid_amount') }); return; }
    setIsSendingGold(true);
    try {
        await runTransaction(db, async (tx) => {
            const senderSnap = await tx.get(doc(db, 'users', authUser.uid));
            if (!senderSnap.exists()) throw new Error("Sender not found");
            const senderData = senderSnap.data();
            if ((senderData.infGoldBalance || 0) < amount) throw new Error(t('not_enough_gold_transfer'));
            tx.update(doc(db, 'users', authUser.uid), { infGoldBalance: increment(-amount) });
            tx.update(doc(db, 'users', user.id), { infGoldBalance: increment(amount) });
            tx.set(doc(collection(db, 'transfers')), { senderId: authUser.uid, receiverId: user.id, amount: amount, timestamp: serverTimestamp(), senderName: senderData.name || senderData.username || 'User', receiverName: user.name || user.username || 'Recipient' });
        });
        toast({ title: t('dm_success'), description: t('transfer_success', { amount, name: user.name }) });
        setShowSendGold(false);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message || t('transfer_error') }); }
    finally { setIsSendingGold(false); }
  };

  const displayName = user.isDeleted ? t('deleted_account') : user.name;
  const displayUsername = user.isDeleted ? '' : user.username;
  const birthdayText = useMemo(() => {
    if (!user.birthday) return null; const months = (t('months') || '').split(',');
    return `${user.birthday.day} ${months[user.birthday.month - 1]}${user.birthday.year ? `, ${user.birthday.year}` : ''}`;
  }, [user.birthday, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className={cn("max-w-sm p-0 overflow-hidden h-[85vh] max-h-[85vh] flex flex-col", experimentalDesign ? "rounded-[2.5rem] border-none shadow-2xl bg-card" : "rounded-lg")}>
        <DialogTitle className="sr-only">{displayName}</DialogTitle>
        <div className="flex flex-col h-full overflow-hidden relative">
            <div className={cn("absolute top-0 left-0 right-0 z-20 h-14 flex items-center px-4 transition-all duration-300 border-b", showCompactHeader ? "bg-background/95 backdrop-blur-md opacity-100" : "bg-transparent opacity-0 pointer-events-none border-transparent")}>
                <div className="flex items-center gap-3 min-w-0 flex-1"><UserAvatarWithStatus user={user} className="h-8 w-8" /><span className="font-bold font-headline truncate">{displayName}</span></div>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="shrink-0 ml-2"><X className="h-5 w-5" /></Button>
            </div>
            <ScrollArea className="flex-1" onScroll={e => setShowCompactHeader(e.currentTarget.scrollTop > 100)}>
                <div className="relative shrink-0">
                    <div className="h-40 w-full bg-muted overflow-hidden">
                        {user.bannerUrl ? <img src={user.bannerUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />}
                    </div>
                    <div className="absolute top-4 left-4 z-10 flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full h-10 w-10 bg-black/30 text-white backdrop-blur-md"><ArrowLeft className="h-5 w-5" /></Button>
                    </div>
                    <div className="absolute -bottom-10 left-6">
                        <div className="relative">
                            <UserAvatarWithStatus user={user} className={cn("text-4xl shadow-2xl border-4 border-background rounded-full w-24 h-24")} />
                            {user.activeGiftEmoji && (
                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full w-8 h-8 flex items-center justify-center text-base shadow-lg border border-primary/20">
                                    {user.activeGiftEmoji}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-14 pb-4 px-6">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold font-headline text-2xl truncate max-w-[250px]">{displayName}</h2>
                        {!user.isDeleted && (<>{(user.username === '@Infinite' || user.username === '@InfiniteBot') && <VerifiedBadge />}{user.subscriptionTier === 'prem' && user.showPremBadge && <PremBadge />}</>)}
                    </div>
                    <p className={cn("font-black uppercase tracking-widest mt-1 text-[10px]", user.isBot ? "text-primary" : "text-muted-foreground/80")}>{getStatusText(user)}</p>
                </div>

                <div className="px-6 space-y-6">
                    {profileMusic && <ProfileVibeCard music={profileMusic} db={db!} />}

                    <div className="bg-muted/30 p-5 rounded-2xl border border-border/50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">username</p>
                        <p className="font-bold text-sm mb-4">{displayUsername}</p>
                        <Separator className="opacity-10 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">bio</p>
                        <p className="text-sm font-medium leading-relaxed">{user.statusMessage || 'Hey there! I am using Infinite.'}</p>
                        {birthdayText && (
                            <>
                                <Separator className="opacity-10 my-4" />
                                <div className="flex items-center gap-2 text-xs font-bold text-primary"><Cake className="h-4 w-4" /><span>{birthdayText}</span></div>
                            </>
                        )}
                    </div>

                    {!user.isBot && !user.isDeleted && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('gifts')} ({gifts?.length || 0})</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {gifts?.map(gift => (
                                    <div key={gift.id} className="border p-3 rounded-2xl flex flex-col gap-2 bg-muted/20 border-border/50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{gift.emoji}</span>
                                            <div className="min-w-0"><p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">From {gift.senderName}</p></div>
                                        </div>
                                        {gift.message && <p className="text-[11px] leading-tight text-foreground/80 italic pl-11">{gift.message}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 pb-10">
                        <Button variant="outline" className="w-full rounded-xl h-12 font-bold border-pink-200 text-pink-600 bg-pink-50/50" onClick={() => setShowGiftPicker(true)}><GiftIcon className="mr-2 h-5 w-5" />{t('send_gift')}</Button>
                        {!user.isBot && <Button variant="outline" className="w-full rounded-xl h-12 font-bold border-amber-200 text-amber-600 bg-amber-50/50" onClick={() => setShowSendGold(true)}><Coins className="mr-2 h-5 w-5" />{t('send_gold')}</Button>}
                        <Button className="w-full h-12 rounded-xl font-bold shadow-lg" onClick={handleStartMessage}>{t('message')}</Button>
                    </div>
                </div>
            </ScrollArea>
        </div>
      </DialogContent>
      <GiftPickerDialog open={showGiftPicker} onOpenChange={setShowGiftPicker} recipient={user} currentUser={authUser as any} />
    </Dialog>
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
        <div className="relative p-5 rounded-2xl bg-indigo-600 text-white overflow-hidden shadow-lg border border-white/10">
            <div className="flex items-center gap-4 relative z-10">
                <div className={cn("w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0 overflow-hidden", isPlaying && "animate-spin [animation-duration:5s]")}>
                    {music.coverUrl ? <img src={music.coverUrl} className="w-full h-full object-cover" /> : <Music className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm truncate">{music.title}</h4>
                    <p className="text-[10px] opacity-70 truncate">{music.author}</p>
                </div>
                <Button onClick={toggle} size="icon" className="w-10 h-10 rounded-full bg-white text-indigo-600 hover:bg-white/90">
                    {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                </Button>
            </div>
            {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
        </div>
    );
}
