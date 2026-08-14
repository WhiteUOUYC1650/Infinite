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
import type { User, CustomBot, BotMiniApp, Gift } from '@/types';
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
import { MessageSquare, Phone, Bell, BellOff, X, Coins, Loader2, Cake, Video, ArrowLeft, LayoutGrid, Globe, ExternalLink, SeparatorHorizontal, Sparkles, Gift as GiftIcon, MessageSquareText, Search, MoreHorizontal, User as UserIcon } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, doc, runTransaction, increment, getDoc, setDoc, serverTimestamp, query, where, limit, getDocs, orderBy, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { InfGoldIcon } from './ui/inf-gold-icon';
import { ScrollArea } from './ui/scroll-area';
import { Capacitor } from '@capacitor/core';
import { Separator } from './ui/separator';
import { GiftPickerDialog } from './gifts/gift-picker-dialog';

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

  const giftsQuery = useMemo(() => {
    if (!db || !user.id) return null;
    return collection(db, 'users', user.id, 'receivedGifts');
  }, [db, user.id]);
  
  const { data: gifts, loading: giftsLoading } = useCollection<Gift>(giftsQuery);

  useEffect(() => { 
    if (open) { 
        setShowCompactHeader(false); 
        setShowSendGold(false); 
        setShowGiftPicker(false);
        setSendAmount('10'); 
        setActiveMiniApp(null);
        setActiveTab('info');
        if (user.isCustomBot && db) {
            getDoc(doc(db, 'customBots', user.id)).then(snap => {
                if (snap.exists()) setBotData(snap.data() as CustomBot);
            });
        }
    } 
  }, [open, user.id, user.isCustomBot, db]);

  useEffect(() => {
    if (!open) return;
    const handleSystemBack = () => {
      if (activeMiniApp) setActiveMiniApp(null);
      else if (showSendGold) setShowSendGold(false);
      else if (showGiftPicker) setShowGiftPicker(false);
      else onOpenChange(false);
    };
    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        backListener = App.addListener('backButton', handleSystemBack);
      });
    }
    return () => { if (backListener) { backListener.then((l: any) => l.remove()); } };
  }, [open, showSendGold, showGiftPicker, activeMiniApp, onOpenChange]);

  const getStatusText = (user: User) => {
    if (user.isDeleted) return '';
    if (user.isBot) return t('bot_status');
    if (!user.status) return '';
    let statusText = t(statusTranslations[user.status] || 'offline');
    if (user.status === 'offline' && user.lastSeen) {
      const lastSeenDate = new Date(user.lastSeen.seconds * 1000);
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

  const handleButtonClick = (buttonId: string) => {
      if (!buttonId) return;
      window.dispatchEvent(new CustomEvent('bot-button-click', { 
          detail: { botId: user.id, buttonId: buttonId } 
      }));
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
        <DialogTitle className="sr-only">{activeMiniApp ? activeMiniApp.name : displayName}</DialogTitle>
        {activeMiniApp ? (
            <div className="flex flex-col h-full bg-background animate-in slide-in-from-right duration-300">
                <header className="h-14 flex items-center px-4 border-b shrink-0 bg-background/95 backdrop-blur-md pt-[calc(0.5rem+env(safe-area-inset-top))]">
                    <Button variant="ghost" size="icon" onClick={() => setActiveMiniApp(null)} className="shrink-0"><ArrowLeft /></Button>
                    <div className="ml-3 flex-1 min-w-0">
                        <p className="font-bold truncate text-sm">{activeMiniApp.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate uppercase tracking-widest font-black">Native Mini-App</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setActiveMiniApp(null)} className="shrink-0 ml-2"><X /></Button>
                </header>
                <ScrollArea className="flex-1 bg-muted/5">
                    <div className="p-6 space-y-4">
                        {activeMiniApp.blocks?.map((block) => {
                            switch (block.type) {
                                case 'ui_header': return <h3 key={block.id} className="text-xl font-black font-headline text-primary border-b pb-2">{block.params?.text}</h3>;
                                case 'ui_text': return <p key={block.id} className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{block.params?.text}</p>;
                                case 'ui_button': return <Button key={block.id} className="w-full h-12 rounded-2xl font-bold shadow-lg shadow-primary/10 transition-all active:scale-[0.98]" onClick={() => handleButtonClick(block.params?.buttonId)}>{block.params?.text}</Button>;
                                case 'ui_separator': return <Separator key={block.id} className="my-4" />;
                                default: return null;
                            }
                        })}
                    </div>
                </ScrollArea>
            </div>
        ) : (
            <div className="flex flex-col h-full overflow-hidden relative">
                <div className={cn("absolute top-0 left-0 right-0 z-20 h-14 flex items-center px-4 transition-all duration-300 border-b", showCompactHeader ? "bg-background/95 backdrop-blur-md opacity-100" : "bg-transparent opacity-0 pointer-events-none border-transparent")}>
                    <div className="flex items-center gap-3 min-w-0 flex-1"><UserAvatarWithStatus user={user} className="h-8 w-8" /><span className="font-bold font-headline truncate">{displayName}</span></div>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="shrink-0 ml-2"><X className="h-5 w-5" /></Button>
                </div>
                <ScrollArea className="flex-1" onScroll={e => setShowCompactHeader(e.currentTarget.scrollTop > 100)}>
                    <div className={cn(experimentalDesign ? "bg-gradient-to-b from-primary/15 to-transparent pt-10 pb-6 px-6" : "pt-8 pb-4 px-6")}>
                        <DialogHeader className="p-0 relative">
                            <DialogTitle className="sr-only">{displayName}</DialogTitle>
                            {experimentalDesign ? (
                                <div className="absolute top-0 left-0 right-0 flex justify-between items-center -mt-4">
                                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full h-10 w-10 glass-button border-none bg-black/10"><ArrowLeft className="h-5 w-5" /></Button>
                                    <div className="w-10 h-10" /> {/* Placeholder for alignment */}
                                </div>
                            ) : (
                                <>
                                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className={cn("absolute -top-4 left-0 z-10 rounded-full", showCompactHeader && "hidden")}><ArrowLeft className="h-5 w-5" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className={cn("absolute -top-4 -right-2 z-10 rounded-full", showCompactHeader && "hidden")}><X className="h-5 w-5" /></Button>
                                </>
                            )}
                            <div className='relative mx-auto flex justify-center mt-4'>
                                <div className="relative">
                                    <UserAvatarWithStatus user={user} className={cn("text-4xl shadow-2xl border-4 border-background rounded-full", experimentalDesign ? "w-32 h-32 experimental-glow" : "w-28 h-28")} />
                                    {user.activeGiftEmoji && (
                                        <div className="absolute -bottom-1 -right-1 bg-background rounded-full w-10 h-10 flex items-center justify-center text-xl shadow-lg border-2 border-primary/20">
                                            {user.activeGiftEmoji}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="text-center py-6">
                            <div className="flex items-center justify-center gap-2">
                                <h2 className={cn("font-bold font-headline truncate max-w-[250px]", experimentalDesign ? "text-3xl" : "text-2xl")}>{displayName}</h2>
                                {!user.isDeleted && (<>{(user.username === '@Infinite' || user.username === '@InfiniteBot' || user.username === '@VeoBot' || user.username === '@GeminiBot') && <VerifiedBadge />}{user.subscriptionTier === 'prem' && user.showPremBadge && <PremBadge />}{user.isBetaTester && <BetaBadge />}</>)}
                                {!user.isDeleted && user.isBot && user.username !== '@Infinite' && user.username !== '@InfiniteBot' && <Badge variant="secondary">BOT</Badge>}
                            </div>
                            <p className={cn("font-black uppercase tracking-widest mt-1", user.isBot ? "text-primary" : "text-muted-foreground/80", experimentalDesign ? "text-xs" : "text-sm")}>{getStatusText(user)}</p>
                        </div>
                        
                        {!user.isDeleted && experimentalDesign && (
                            <div className="flex justify-center items-center gap-3 w-full px-2 mb-8">
                                <button onClick={handleStartMessage} className="w-12 h-12 rounded-full glass-button flex items-center justify-center border-none shadow-xl"><MessageSquare className="w-5 h-5" /></button>
                                <button onClick={() => { window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: { id: [authUser?.uid, user.id].sort().join('_'), type: 'dm', members: [authUser?.uid, user.id].sort() }, otherUser: user, isVideo: false } })); onOpenChange(false); }} className="w-12 h-12 rounded-full glass-button flex items-center justify-center border-none shadow-xl"><Phone className="w-5 h-5" /></button>
                                <button className="w-12 h-12 rounded-full glass-button flex items-center justify-center border-none shadow-xl"><Bell className="w-5 h-5" /></button>
                                <button className="w-12 h-12 rounded-full glass-button flex items-center justify-center border-none shadow-xl"><Search className="w-5 h-5" /></button>
                                <button className="w-12 h-12 rounded-full glass-button flex items-center justify-center border-none shadow-xl"><MoreHorizontal className="w-5 h-5" /></button>
                            </div>
                        )}

                        <div className="px-2 space-y-6">
                            {experimentalDesign ? (
                                <div className="glass-panel p-6 rounded-[2.5rem] border-none shadow-inner space-y-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">username</p>
                                        <p className="font-bold text-lg">{displayUsername}</p>
                                    </div>
                                    <Separator className="bg-white/10" />
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">bio</p>
                                        <p className="font-medium text-sm leading-relaxed">{user.statusMessage || 'No description provided.'}</p>
                                    </div>
                                    {birthdayText && (
                                        <>
                                            <Separator className="bg-white/10" />
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">birthday</p>
                                                <p className="font-medium text-sm">{birthdayText}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {user.statusMessage && !user.isDeleted && (<div className="text-center p-4 bg-muted/50 rounded-2xl border-none"><p className="text-sm italic text-muted-foreground leading-relaxed">"{user.statusMessage}"</p></div>)}
                                    {!user.isDeleted && !user.isBot && (<div className="flex items-center justify-center gap-2 mb-4"><InfGoldIcon className="h-5 w-5" /><span className="font-bold text-lg">{user.infGoldBalance ?? 0}</span></div>)}
                                    {birthdayText && (<div className="flex items-center justify-center gap-2 mb-4 text-xs font-bold text-primary"><Cake className="h-3.5 w-3.5" /><span>{birthdayText}</span></div>)}
                                </>
                            )}
                            
                            {experimentalDesign && (
                                <div className="flex justify-center pt-2">
                                    <div className="glass-panel p-1 rounded-full flex gap-1 bg-white/5 border-none">
                                        <button onClick={() => setActiveTab('info')} className={cn("px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'info' ? "bg-primary text-white shadow-lg" : "text-muted-foreground")}>Info</button>
                                        <button onClick={() => setActiveTab('gifts')} className={cn("px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'gifts' ? "bg-primary text-white shadow-lg" : "text-muted-foreground")}>Gifts</button>
                                        <button onClick={() => setActiveTab('apps')} className={cn("px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'apps' ? "bg-primary text-white shadow-lg" : "text-muted-foreground")}>Apps</button>
                                    </div>
                                </div>
                            )}

                            {/* Section switching for experimental design or list for standard */}
                            {(!experimentalDesign || activeTab === 'gifts') && !user.isBot && !user.isDeleted && (
                                <div className={cn("space-y-3 animate-in fade-in duration-300", experimentalDesign && "pt-2")}>
                                    {!experimentalDesign && <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('gifts')}</h3>}
                                    <div className="grid grid-cols-1 gap-2">
                                        {gifts?.map(gift => (
                                            <div key={gift.id} className={cn("border p-3 rounded-2xl flex flex-col gap-2", experimentalDesign ? "glass-panel border-none bg-muted/20" : "bg-muted/30 border-border/50")}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl">{gift.emoji}</span>
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">From {gift.senderName}</p>
                                                        </div>
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
                                            <div className="text-center py-6 border-2 border-dashed rounded-2xl opacity-30">
                                                <p className="text-[9px] font-bold uppercase tracking-widest">{t('no_gifts')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {(!experimentalDesign || activeTab === 'apps') && user.isCustomBot && botData?.miniApps && botData.miniApps.length > 0 && (
                                <div className={cn("space-y-3 animate-in fade-in duration-300", experimentalDesign && "pt-2")}>
                                    {!experimentalDesign && <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('mini_apps')}</h3>}
                                    <div className="grid gap-2">
                                        {botData.miniApps.map(app => (
                                            <button key={app.id} onClick={() => setActiveMiniApp(app)} className={cn("w-full p-4 rounded-2xl flex items-center justify-between group transition-all active:scale-[0.98]", experimentalDesign ? "glass-button border-none" : "bg-primary/5 hover:bg-primary/10 border border-primary/10")}>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><LayoutGrid className="h-5 w-5" /></div>
                                                    <div className="text-left"><p className="font-bold text-sm leading-none">{app.name}</p><p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-black">{t('open_mini_app')}</p></div>
                                                </div>
                                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 pb-10">
                                {!experimentalDesign && !user.isDeleted && (
                                    <>
                                        <Button variant="outline" className="w-full rounded-xl h-12 font-bold border-pink-200 text-pink-600 bg-pink-50/50 hover:bg-pink-100" onClick={() => setShowGiftPicker(true)}><GiftIcon className="mr-2 h-5 w-5" />{t('send_gift')}</Button>
                                        {!user.isBot && <Button variant="outline" className="w-full rounded-xl h-12 font-bold border-amber-200 text-amber-600 bg-amber-50/50 hover:bg-amber-100" onClick={() => setShowSendGold(true)}><Coins className="mr-2 h-5 w-5" />{t('send_gold')}</Button>}
                                        <Button variant="outline" className="w-full rounded-xl h-12 font-bold border-green-200 text-green-600 bg-green-50/50 hover:bg-green-100" onClick={() => { window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: { id: [authUser?.uid, user.id].sort().join('_'), type: 'dm', members: [authUser?.uid, user.id].sort() }, otherUser: user, isVideo: false } })); onOpenChange(false); }}><Phone className="mr-2 h-5 w-5" />{t('audio_call')}</Button>
                                    </>
                                )}
                                {experimentalDesign && !user.isBot && activeTab === 'info' && (
                                     <Button variant="outline" className="w-full rounded-[1.5rem] glass-button h-12 font-bold border-none" onClick={() => setShowSendGold(true)}><InfGoldIcon className="mr-2 h-4 w-4" />{t('send_gold')}</Button>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                {!experimentalDesign && (<div className='shrink-0 p-6 border-t flex justify-center bg-background'><Button onClick={handleStartMessage} disabled={!!user.isDeleted} className="rounded-xl px-8 w-full h-12 font-bold">{t('message')}</Button></div>)}
            </div>
        )}
        <Dialog open={showSendGold} onOpenChange={setShowSendGold}>
            <DialogContent hideCloseButton className="max-w-sm rounded-[2rem] p-8 border-none shadow-2xl relative">
                <DialogTitle className="sr-only">{t('send_gold')}</DialogTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowSendGold(false)} className="absolute left-4 top-4 rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setShowSendGold(false)} className="absolute right-4 top-4 rounded-full"><X className="h-5 w-5" /></Button>
                <DialogHeader className="items-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center"><InfGoldIcon className="h-10 w-10 text-amber-600 animate-bounce" /></div>
                    <div className="space-y-2"><DialogTitle className="text-2xl font-bold font-headline">{t('send_gold')}</DialogTitle><DialogDescription>{t('send_gold_desc', { name: user.name })}</DialogDescription></div>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="gold-amount" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{t('amount_label')}</Label>
                        <div className="relative">
                            <Input id="gold-amount" type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} className="text-center text-2xl font-black h-14 rounded-2xl bg-muted/50 border-none focus-visible:ring-amber-500" autoFocus />
                            <Coins className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 h-6 w-6 opacity-50" />
                        </div>
                    </div>
                </div>
                <DialogFooter className="flex-col gap-2 pt-2">
                    <Button onClick={handleSendGold} disabled={isSendingGold} className="w-full h-14 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-600 shadow-xl shadow-amber-500/20">{isSendingGold ? <Loader2 className="animate-spin" /> : t('send_button')}</Button>
                    <Button variant="ghost" onClick={() => setShowSendGold(false)} className="w-full h-12 rounded-xl font-medium text-muted-foreground">{t('cancel')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <GiftPickerDialog open={showGiftPicker} onOpenChange={setShowGiftPicker} recipient={user} currentUser={authUser as any} />
      </DialogContent>
    </Dialog>
  );
}
