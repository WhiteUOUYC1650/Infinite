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
import type { User, CustomBot, BotMiniApp } from '@/types';
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
import { MessageSquare, Phone, Bell, BellOff, X, Coins, Loader2, Cake, Video, ArrowLeft, LayoutGrid, Globe, ExternalLink, SeparatorHorizontal, Sparkles } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, runTransaction, increment, getDoc, setDoc, serverTimestamp, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { InfGoldIcon } from './ui/inf-gold-icon';
import { ScrollArea } from './ui/scroll-area';
import { Capacitor } from '@capacitor/core';
import { Separator } from './ui/separator';
import { generateUserReport } from '@/ai/flows/generate-user-report-flow';

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
  const { experimentalDesign } = useTheme();
  const [isMuted, setIsMuted] = useState(false);
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const [showSendGold, setShowSendGold] = useState(false);
  const [sendAmount, setSendAmount] = useState('10');
  const [isSendingGold, setIsSendingGold] = useState(false);
  const [botData, setBotData] = useState<CustomBot | null>(null);
  const [activeMiniApp, setActiveMiniApp] = useState<BotMiniApp | null>(null);

  // AI Report State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => { 
    if (open) { 
        setShowCompactHeader(false); 
        setShowSendGold(false); 
        setSendAmount('10'); 
        setActiveMiniApp(null);
        setAiReport(null);
        if (user.isCustomBot && db) {
            getDoc(doc(db, 'customBots', user.id)).then(snap => {
                if (snap.exists()) setBotData(snap.data() as CustomBot);
            });
        }
    } 
  }, [open, user.id, user.isCustomBot, db]);

  // --- System Back Button Support ---
  useEffect(() => {
    if (!open) return;

    const handleSystemBack = () => {
      if (activeMiniApp) {
          setActiveMiniApp(null);
      } else if (showSendGold) {
        setShowSendGold(false);
      } else {
        onOpenChange(false);
      }
    };

    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        backListener = App.addListener('backButton', handleSystemBack);
      });
    }

    return () => {
      if (backListener) {
        backListener.then((l: any) => l.remove());
      }
    };
  }, [open, showSendGold, activeMiniApp, onOpenChange]);

  const getStatusText = (user: User) => {
    if (user.isDeleted) return '';
    if (user.isBot) return t('bot_status');
    if (!user.status) return '';
    let statusText = t(statusTranslations[user.status] || 'offline');
    if (user.status === 'offline' && user.lastSeen) {
      statusText = `${t('was_online')} ${format(new Date(user.lastSeen.seconds * 1000), 'dd.MM.yyyy, HH:mm')}`;
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

  const handleGenerateReport = async () => {
    if (!db) return;
    setIsGeneratingReport(true);
    try {
        // Gathering contextual data for Deep Analysis
        const messages: string[] = [];
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('members', 'array-contains', user.id), limit(5));
        const chatsSnap = await getDocs(q);
        
        for (const chatDoc of chatsSnap.docs) {
            const msgsRef = collection(db, 'chats', chatDoc.id, 'messages');
            const mq = query(msgsRef, where('senderId', '==', user.id), orderBy('timestamp', 'desc'), limit(3));
            const msgsSnap = await getDocs(mq);
            msgsSnap.forEach(m => {
                const data = m.data();
                if (data.content) messages.push(data.content);
            });
        }

        const { report } = await generateUserReport({
            name: user.name,
            username: user.username,
            statusMessage: user.statusMessage,
            infGold: user.infGoldBalance,
            tier: user.subscriptionTier,
            recentMessages: messages
        });
        setAiReport(report);
    } catch (e) {
        toast({ variant: 'destructive', title: 'AI Error', description: 'Failed to generate report. Make sure Genkit is initialized.' });
    } finally {
        setIsGeneratingReport(false);
    }
  };

  const handleButtonClick = (buttonId: string) => {
      if (!buttonId) return;
      window.dispatchEvent(new CustomEvent('bot-button-click', { 
          detail: { 
              botId: user.id, 
              buttonId: buttonId 
          } 
      }));
  };

  const displayName = user.isDeleted ? t('deleted_account') : user.name;
  const displayUsername = user.isDeleted ? '' : user.username;
  const birthdayText = useMemo(() => {
    if (!user.birthday) return null; const months = (t('months') || '').split(',');
    return `${user.birthday.day} ${months[user.birthday.month - 1]}${user.birthday.year ? `, ${user.birthday.year}` : ''}`;
  }, [user.birthday, t]);

  const isAdmin = authUser?.username === '@Infinite';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className={cn("max-w-sm p-0 overflow-hidden h-[85vh] max-h-[85vh] flex flex-col", experimentalDesign ? "rounded-[2rem] border-none shadow-2xl" : "rounded-lg")}>
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
                                case 'ui_header':
                                    return <h3 key={block.id} className="text-xl font-black font-headline text-primary border-b pb-2">{block.params?.text}</h3>;
                                case 'ui_text':
                                    return <p key={block.id} className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{block.params?.text}</p>;
                                case 'ui_button':
                                    return (
                                        <Button 
                                            key={block.id} 
                                            className="w-full h-12 rounded-2xl font-bold shadow-lg shadow-primary/10 transition-all active:scale-[0.98]" 
                                            onClick={() => handleButtonClick(block.params?.buttonId)}
                                        >
                                            {block.params?.text}
                                        </Button>
                                    );
                                case 'ui_separator':
                                    return <Separator key={block.id} className="my-4" />;
                                default:
                                    return null;
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
                    <div className={cn(experimentalDesign ? "bg-gradient-to-b from-primary/10 to-background pt-8 pb-6 px-6" : "pt-8 pb-4 px-6")}>
                        <DialogHeader className="p-0 relative">
                            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className={cn("absolute -top-4 left-0 z-10 rounded-full", showCompactHeader && "hidden")}><ArrowLeft className="h-5 w-5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className={cn("absolute -top-4 -right-2 z-10 rounded-full", showCompactHeader && "hidden")}><X className="h-5 w-5" /></Button>
                            <div className='relative mx-auto flex justify-center'><UserAvatarWithStatus user={user} className="w-28 h-28 text-4xl shadow-xl border-4 border-background rounded-full" /></div>
                        </DialogHeader>
                        <div className="text-center py-4">
                            <div className="flex items-center justify-center gap-2"><h2 className="text-2xl font-bold font-headline truncate max-w-[250px]">{displayName}</h2>{!user.isDeleted && (<>{(user.username === '@Infinite' || user.username === '@InfiniteBot' || user.username === '@VeoBot' || user.username === '@GeminiBot') && <VerifiedBadge />}{user.subscriptionTier === 'prem' && user.showPremBadge && <PremBadge />}{user.isBetaTester && <BetaBadge />}</>)}{!user.isDeleted && user.isBot && user.username !== '@Infinite' && user.username !== '@InfiniteBot' && <Badge variant="secondary">BOT</Badge>}</div>
                            <p className="text-muted-foreground font-medium">{displayUsername}</p>
                            <p className={cn("text-sm mt-1 font-black uppercase tracking-widest", user.isBot ? "text-primary" : "text-muted-foreground")}>{getStatusText(user)}</p>
                        </div>
                        {!user.isDeleted && !user.isBot && (<div className="flex items-center justify-center gap-2 mb-4"><InfGoldIcon className="h-5 w-5" /><span className="font-bold text-lg">{user.infGoldBalance ?? 0}</span></div>)}
                        {birthdayText && (<div className="flex items-center justify-center gap-2 mb-4 text-xs font-bold text-primary"><Cake className="h-3.5 w-3.5" /><span>{birthdayText}</span></div>)}
                        
                        {!user.isBot && !user.isDeleted && experimentalDesign && (
                            <div className="grid grid-cols-2 gap-3 w-full mt-4 px-2">
                                <button onClick={handleStartMessage} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"><div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center"><MessageSquare className="w-5 h-5 text-blue-500" /></div><span className="text-[10px] font-bold uppercase tracking-tight">{t('message')}</span></button>
                                <button onClick={() => setShowSendGold(true)} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"><div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center"><Coins className="w-5 h-5 text-amber-600" /></div><span className="text-[10px] font-bold uppercase tracking-tight text-amber-600">{t('send_gold')}</span></button>
                                <button onClick={() => setIsMuted(!isMuted)} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"><div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isMuted ? "bg-red-500/15" : "bg-orange-500/15")}>{isMuted ? <BellOff className="w-5 h-5 text-red-500" /> : <Bell className="h-5 w-5 text-orange-500" />}</div><span className="text-[10px] font-bold uppercase tracking-tight text-orange-600">{t('mute')}</span></button>
                                <button onClick={() => { window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: { id: [authUser?.uid, user.id].sort().join('_'), type: 'dm', members: [authUser?.uid, user.id].sort() }, otherUser: user, isVideo: false } })); onOpenChange(false); }} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-all active:scale-95"><div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center"><Phone className="w-5 h-5 text-green-500" /></div><span className="text-[10px] font-bold uppercase tracking-tight text-green-600">{t('audio_call')}</span></button>
                            </div>
                        )}

                        <div className="px-2 pt-6 pb-4 space-y-6">
                            {user.statusMessage && !user.isDeleted && (<div className="text-center p-4 bg-muted/50 rounded-2xl border-none"><p className="text-sm italic text-muted-foreground leading-relaxed">"{user.statusMessage}"</p></div>)}

                            {aiReport && (
                                <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 space-y-2 animate-in slide-in-from-top-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Sparkles className="h-3 w-3" /> ИИ-Донос</p>
                                    <p className="text-xs italic leading-relaxed">"{aiReport}"</p>
                                </div>
                            )}
                            
                            {user.isCustomBot && botData?.miniApps && botData.miniApps.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('mini_apps')}</h3>
                                    <div className="grid gap-2">
                                        {botData.miniApps.map(app => (
                                            <button 
                                                key={app.id} 
                                                onClick={() => setActiveMiniApp(app)}
                                                className="w-full p-4 rounded-2xl bg-primary/5 hover:bg-primary/10 border border-primary/10 flex items-center justify-between group transition-all active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                        <LayoutGrid className="h-5 w-5" />
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-bold text-sm leading-none">{app.name}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-black">{t('open_mini_app')}</p>
                                                    </div>
                                                </div>
                                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                {isAdmin && !user.isBot && !user.isDeleted && (
                                    <Button 
                                        variant="outline" 
                                        className="w-full rounded-xl h-12 font-bold border-primary/20 text-primary hover:bg-primary/5" 
                                        onClick={handleGenerateReport}
                                        disabled={isGeneratingReport}
                                    >
                                        {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        Сгенерировать ИИ-донос
                                    </Button>
                                )}

                                {!experimentalDesign && !user.isBot && !user.isDeleted && (
                                    <>
                                        <Button variant="outline" className="w-full rounded-xl h-12 font-bold border-amber-200 text-amber-600 bg-amber-50/50 hover:bg-amber-100" onClick={() => setShowSendGold(true)}><Coins className="mr-2 h-5 w-5" />{t('send_gold')}</Button>
                                        <Button variant="outline" className="w-full rounded-xl h-12 font-bold border-green-200 text-green-600 bg-green-50/50 hover:bg-green-100" onClick={() => { window.dispatchEvent(new CustomEvent('initiate-call', { detail: { chat: { id: [authUser?.uid, user.id].sort().join('_'), type: 'dm', members: [authUser?.uid, user.id].sort() }, otherUser: user, isVideo: false } })); onOpenChange(false); }}><Phone className="mr-2 h-5 w-5" />{t('audio_call')}</Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                {!experimentalDesign && (<div className='shrink-0 p-6 border-t flex justify-center bg-background'><Button onClick={handleStartMessage} disabled={user.isBot || !!user.isDeleted} className="rounded-xl px-8 w-full h-12 font-bold">{t('message')}</Button></div>)}
            </div>
        )}
        <Dialog open={showSendGold} onOpenChange={setShowSendGold}>
            <DialogContent hideCloseButton className="max-w-sm rounded-[2rem] p-8 border-none shadow-2xl relative">
                <DialogTitle className="sr-only">{t('send_gold')}</DialogTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowSendGold(false)} className="absolute left-4 top-4 rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setShowSendGold(false)} className="absolute right-4 top-4 rounded-full"><X className="h-5 w-5" /></Button>
                <DialogHeader className="items-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center"><InfGoldIcon className="h-10 w-10 text-amber-600 animate-bounce" /></div>
                    <div className="space-y-2">
                        <DialogTitle className="text-2xl font-bold font-headline">{t('send_gold')}</DialogTitle>
                        <DialogDescription>{t('send_gold_desc', { name: user.name })}</DialogDescription>
                    </div>
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
                    <Button onClick={handleSendGold} disabled={isSendingGold} className="w-full h-14 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-600 shadow-xl shadow-amber-500/20">
                        {isSendingGold ? <Loader2 className="animate-spin" /> : t('send_button')}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowSendGold(false)} className="w-full h-12 rounded-xl font-medium text-muted-foreground">{t('cancel')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
