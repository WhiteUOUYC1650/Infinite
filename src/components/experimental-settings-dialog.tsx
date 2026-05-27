'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

import { ArrowLeft, ChevronRight, LogOut, Trash2, Paintbrush, Languages, HelpCircle, Info, User, Star, MessageSquare, Loader2, Bell, Pencil, HardDrive, ShieldCheck, X, Zap, Database, ChevronRight as ChevronRightIcon, Globe, Moon, Sun, Cpu, Gamepad2, Newspaper, Clock, Sparkles, Shield, Lock } from 'lucide-react';
import type { AuthenticatedUser, Transfer } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, increment, getDoc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { UserProfileCard } from './user-profile-card';
import { EditProfileDialog } from './edit-profile-dialog';
import { InfGoldIcon } from './ui/inf-gold-icon';
import { DailyBonusWheel, PRIZES_WITH_ANGLES } from './daily-bonus-wheel';
import { UserAvatarWithStatus, InfiniteLogo } from './chat/user-avatar-with-status';
import { VerifiedBadge } from './ui/verified-badge';
import { clearCacheDB, calculateCacheSize as getRealCacheSize } from '@/lib/cache-utils';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

type SettingsPage = 'main' | 'appearance' | 'theme' | 'language' | 'account' | 'help' | 'about' | 'chat' | 'infGold' | 'dailyBonus' | 'whatsNew' | 'dataStorage' | 'privacy' | 'transferHistory' | 'botGuide';

const SettingsItem = ({ icon: Icon, label, value, onClick, disabled = false, description, iconBg = "bg-primary/10", iconColor = "text-primary", showExpColors = false, isGlow = false }: { icon: React.ElementType, label: string, value?: string, onClick: () => void, disabled?: boolean, description?: string, iconBg?: string, iconColor?: string, showExpColors?: boolean, isGlow?: boolean }) => (
    <button onClick={onClick} className="flex items-center w-full p-4 text-left rounded-lg hover:bg-muted disabled:opacity-50 disabled:pointer-events-none group" disabled={disabled}>
        <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-4 transition-colors",
            showExpColors ? iconBg : "bg-primary/10 group-hover:bg-primary/20",
            isGlow && "experimental-glow"
        )}>
            <Icon className={cn("h-5 w-5", showExpColors ? iconColor : "text-primary")} />
        </div>
        <div className="flex-1 flex flex-col justify-center min-w-0 mr-2">
            <span className="font-medium whitespace-normal leading-tight">{label}</span>
            {description && <span className="text-xs text-muted-foreground whitespace-normal leading-tight mt-0.5">{description}</span>}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
            {value && <span className='capitalize text-sm max-w-[80px] truncate'>{value}</span>}
            <ChevronRightIcon className="h-5 w-5 shrink-0" />
        </div>
  </button>
);

const SettingsSwitchItem = ({ label, checked, onCheckedChange, id, description, disabled = false }: { label: string, checked: boolean, onCheckedChange: (checked: boolean) => void, id: string, description?: string, disabled?: boolean }) => (
    <div className="flex items-start justify-between w-full p-4">
        <div className="flex flex-col flex-1 mr-4 min-w-0">
            <Label htmlFor={id} className={cn("font-medium cursor-pointer whitespace-normal leading-tight mb-1", disabled && "opacity-50")}>{label}</Label>
            {description && <span className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{description}</span>}
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="shrink-0 mt-1" disabled={disabled} />
    </div>
);

export function ExperimentalSettingsDialog({ open, onOpenChange, currentUser }: { open: boolean, onOpenChange: (open: boolean) => void, currentUser: AuthenticatedUser }) {
  const [pageHistory, setPageHistory] = useState<SettingsPage[]>(['main']);
  const [animationDirection, setAnimationDirection] = useState<'forward' | 'backward'>('forward');
  const page = pageHistory[pageHistory.length - 1];
  
  const [showEditProfile, setShowEditProfile] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, isDarkMode, toggleTheme, sendOnEnter, toggleSendOnEnter, smoothScroll, toggleSmoothScroll, minimizeCallOnClose, toggleMinimizeCallOnClose, experimentalDesign, glassEffect, toggleGlassEffect, showFeed, toggleShowFeed, useSystemFont, toggleSystemFont } = useTheme();
  
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [currentCacheSize, setCurrentCacheSize] = useState('0 B');
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

  const isBonusAvailable = !currentUser.lastDailyBonusClaimed || (Date.now() - currentUser.lastDailyBonusClaimed.toMillis()) > 24 * 60 * 60 * 1000;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateCacheSize = async () => {
    const dbSize = await getRealCacheSize();
    setCurrentCacheSize(formatSize(dbSize));
  };

  const handleClearCache = async () => {
      await clearCacheDB();
      calculateCacheSize();
      toast({ title: t('dm_success'), description: t('cache_cleared_success') });
  };

  useEffect(() => {
    if (open) calculateCacheSize();
  }, [open, page]);

  useEffect(() => {
    if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0;
  }, [page]);

  const navigateTo = (newPage: SettingsPage) => {
    setAnimationDirection('forward');
    setPageHistory(prev => [...prev, newPage]);
  };

  const handleBack = () => {
    if (pageHistory.length > 1) {
        setAnimationDirection('backward');
        setPageHistory(prev => prev.slice(0, -1));
    } else {
        onOpenChange(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleSystemBack = () => {
      if (pageHistory.length > 1) {
        setAnimationDirection('backward');
        setPageHistory(prev => prev.slice(0, -1));
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
    return () => { if (backListener) { backListener.then((l: any) => l.remove()); } };
  }, [open, pageHistory, onOpenChange]);

  const resetState = () => {
    setPageHistory(['main']);
    setAnimationDirection('forward');
  }
  
  const handleLogout = async () => {
    if (auth && db && currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      try {
        await updateDoc(userRef, { status: 'offline', lastSeen: serverTimestamp() });
      } catch (error) { console.error(error); }
      auth.signOut();
    } else if (auth) {
        auth.signOut();
    }
  };

  const handleToggleLoginProtection = async (enabled: boolean) => {
    if (!db || !currentUser.uid) return;
    setIsUpdatingPrivacy(true);
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), { loginProtectionEnabled: enabled });
        toast({ title: t('dm_success') });
    } finally { setIsUpdatingPrivacy(false); }
  };

  const faqs = [
    { question: t('faq_markdown_q'), answer: t('faq_markdown_a') },
    { question: t('faq_create_chat_q'), answer: t('faq_create_chat_a') },
    { question: t('faq_bot_prog_q'), answer: '[BOT_GUIDE_BUTTON]' },
    { question: t('faq_security_q'), answer: t('faq_security_a') },
  ];

  const botGuidePageContent = (
      <div className='p-6 space-y-6'>
          <div className='space-y-4'>
              <h2 className='text-2xl font-bold font-headline'>{t('bot_guide_title')}</h2>
              <p className='text-muted-foreground text-sm leading-relaxed'>{t('bot_guide_intro')}</p>
          </div>
          <div className='space-y-6'>
              <div className='space-y-2'>
                  <h3 className='font-bold text-primary flex items-center gap-2'><Zap className='h-4 w-4' /> {t('bot_guide_events')}</h3>
                  <div className='space-y-2 text-xs text-muted-foreground leading-relaxed'>
                      <ReactMarkdown>{t('bot_guide_event_start')}</ReactMarkdown>
                      <ReactMarkdown>{t('bot_guide_event_msg')}</ReactMarkdown>
                  </div>
              </div>
              <div className='space-y-2'>
                  <h3 className='font-bold text-primary flex items-center gap-2'><MessageSquare className='h-4 w-4' /> {t('bot_guide_actions')}</h3>
                  <div className='space-y-2 text-xs text-muted-foreground leading-relaxed'>
                      <ReactMarkdown>{t('bot_guide_action_send')}</ReactMarkdown>
                      <ReactMarkdown>{t('bot_guide_action_reply')}</ReactMarkdown>
                  </div>
              </div>
              <div className='space-y-2'>
                  <h3 className='font-bold text-primary flex items-center gap-2'><Database className='h-4 w-4' /> {t('bot_guide_vars')}</h3>
                  <p className='text-[11px] font-bold text-muted-foreground/80'>{t('bot_guide_var_intro')}</p>
                  <div className='space-y-1 text-xs font-mono bg-muted/50 p-3 rounded-xl border'>
                      <ReactMarkdown>{t('bot_guide_var_user')}</ReactMarkdown>
                      <ReactMarkdown>{t('bot_guide_var_msg')}</ReactMarkdown>
                      <ReactMarkdown>{t('bot_guide_var_bot')}</ReactMarkdown>
                      <ReactMarkdown>{t('bot_guide_var_time')}</ReactMarkdown>
                  </div>
              </div>
          </div>
      </div>
  );

  const mainPageContent = (
      <>
        {experimentalDesign ? (
            <div className="flex flex-col items-center pt-6 pb-8 px-6 bg-gradient-to-b from-primary/15 to-transparent">
                <UserAvatarWithStatus user={currentUser as any} className="w-28 h-28 text-4xl mb-6 border-4 border-background shadow-2xl rounded-full experimental-glow" />
                <div className="text-center space-y-1.5">
                    <h2 className="text-3xl font-bold font-headline flex items-center justify-center gap-2">{currentUser.name}{currentUser.isAdmin && <VerifiedBadge />}</h2>
                    <p className="text-muted-foreground font-medium">{currentUser.username}</p>
                </div>
            </div>
        ) : (
            <div className="p-0 overflow-hidden"><UserProfileCard user={currentUser} onEditProfile={() => { onOpenChange(false); setTimeout(() => setShowEditProfile(true), 150); }} /></div>
        )}
        <div className={cn("border-t", experimentalDesign && "mt-2")}>
          {currentUser.isAdmin && (
            <SettingsItem 
              icon={Shield} 
              label={t('admin_panel_title')} 
              onClick={() => router.push('/admin')} 
              showExpColors={experimentalDesign} 
              iconBg="bg-red-600/20" 
              iconColor="text-red-600" 
              isGlow={experimentalDesign}
            />
          )}
          <SettingsItem icon={Paintbrush} label={t('appearance')} value={t(theme === 'frutiger' ? 'frutiger_aero' : (theme as any))} onClick={() => navigateTo('appearance')} showExpColors={experimentalDesign} iconBg="bg-blue-500/15" iconColor="text-blue-500" />
          <SettingsItem icon={MessageSquare} label={t('chat_settings')} onClick={() => navigateTo('chat')} showExpColors={experimentalDesign} iconBg="bg-green-500/15" iconColor="text-green-500" />
          <SettingsItem icon={ShieldCheck} label={t('privacy_security')} onClick={() => navigateTo('privacy')} showExpColors={experimentalDesign} iconBg="bg-rose-500/15" iconColor="text-rose-500" />
          <SettingsItem icon={HardDrive} label={t('data_storage')} onClick={() => navigateTo('dataStorage')} showExpColors={experimentalDesign} iconBg="bg-orange-500/15" iconColor="text-orange-500" />
          <SettingsItem icon={Languages} label={t('language')} value={language.toUpperCase()} onClick={() => navigateTo('language')} showExpColors={experimentalDesign} iconBg="bg-purple-500/15" iconColor="text-purple-500" />
          <SettingsItem icon={InfGoldIcon} label="InfGold" onClick={() => navigateTo('infGold')} showExpColors={experimentalDesign} iconBg="bg-amber-500/15" iconColor="text-amber-600" isGlow={experimentalDesign} />
          <SettingsItem icon={User} label={t('profile')} onClick={() => navigateTo('account')} showExpColors={experimentalDesign} iconBg="bg-teal-500/15" iconColor="text-teal-500" />
          <SettingsItem icon={Star} label={t('whats_new')} onClick={() => navigateTo('whatsNew')} showExpColors={experimentalDesign} iconBg="bg-yellow-500/15" iconColor="text-yellow-600" />
          <SettingsItem icon={HelpCircle} label={t('help')} onClick={() => navigateTo('help')} showExpColors={experimentalDesign} iconBg="bg-pink-500/15" iconColor="text-pink-500" />
          <SettingsItem icon={Info} label={t('version')} value={t('beta_badge')} onClick={() => navigateTo('about')} showExpColors={experimentalDesign} iconBg="bg-gray-500/15" iconColor="text-gray-500" />
        </div>
      </>
  );

  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setSpinning] = useState(false);

  const handleSpin = async (): Promise<void> => {
    const totalWeight = PRIZES_WITH_ANGLES.reduce((sum, p) => sum + p.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    const winningPrize = PRIZES_WITH_ANGLES.find(p => { randomWeight -= p.weight; return randomWeight <= 0; })!;
    const baseRotation = 360 * 5; 
    const prizeAngle = winningPrize.startAngle + winningPrize.angle / 2;
    const randomOffset = (Math.random() - 0.5) * (winningPrize.angle * 0.8);
    setWheelRotation(prev => (prev - (prev % 360)) + baseRotation - prizeAngle - randomOffset);
    setTimeout(async () => {
        toast({ title: t('you_won'), description: `${winningPrize.value} InfGold!` });
        setSpinning(false);
        try {
            await updateDoc(doc(db!, 'users', currentUser.uid), { infGoldBalance: increment(winningPrize.value), lastDailyBonusClaimed: serverTimestamp(), });
        } catch (e) { console.error(e); }
    }, 5000);
  };

  const renderPage = () => {
      switch(page) {
          case 'main': return mainPageContent;
          case 'appearance': return <div className='divide-y'><SettingsSwitchItem id="dark-mode" label={t('dark_mode')} checked={isDarkMode} onCheckedChange={toggleTheme} /><SettingsItem icon={Paintbrush} label={t('color_theme')} value={t(theme as any)} onClick={() => navigateTo('theme')} /><SettingsSwitchItem id="sys-font" label={t('use_system_font_label')} checked={useSystemFont} onCheckedChange={toggleSystemFont} /><SettingsSwitchItem id="glass" label={t('glass_effect_label')} checked={glassEffect} onCheckedChange={toggleGlassEffect} /></div>;
          case 'theme': return <RadioGroup value={theme} onValueChange={v => setTheme(v as any)} className="p-4 space-y-1">{['orange', 'purple', 'blue', 'gray', 'green', 'red', 'yellow', 'pink', 'frutiger'].map(tName => (<div key={tName} className="flex items-center space-x-2"><RadioGroupItem value={tName} id={tName} /><Label htmlFor={tName} className='capitalize cursor-pointer'>{t(tName as any)}</Label></div>))}</RadioGroup>;
          case 'language': return <div className="p-4"><RadioGroup value={language} onValueChange={v => setLanguage(v as any)} className="space-y-1"><div className="flex items-center space-x-2"><RadioGroupItem value="en" id="en" /><Label htmlFor="en">English</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="ru" id="ru" /><Label htmlFor="ru">Русский</Label></div></RadioGroup></div>;
          case 'privacy': return <div className='divide-y'><SettingsSwitchItem id="login-prot" label={t('login_protection_label')} checked={!!currentUser.loginProtectionEnabled} onCheckedChange={handleToggleLoginProtection} /></div>;
          case 'dataStorage': return <div className='p-4 space-y-2'><div className='flex justify-between'><span className='font-medium'>{t('cache_usage')}</span><span>{currentCacheSize}</span></div><Button variant="outline" className='w-full' onClick={handleClearCache}>{t('clear_cache')}</Button></div>;
          case 'infGold': return <div className='p-8 flex flex-col items-center text-center gap-4'><InfGoldIcon className='h-12 w-12 text-amber-600' /><h2 className='text-3xl font-black'>{Math.round(currentUser.infGoldBalance || 0)}</h2><Button className='w-full' onClick={() => navigateTo('dailyBonus')}>{t('daily_bonus')}</Button></div>;
          case 'dailyBonus': return <div className='p-6'><DailyBonusWheel onSpin={handleSpin} isSpinning={isSpinning} setSpinning={setSpinning} canSpin={isBonusAvailable} rotation={wheelRotation} /></div>;
          case 'whatsNew': return <div className='p-6 space-y-4'><h2 className='text-xl font-bold'>{t('whats_new')}</h2><p className='text-sm text-muted-foreground'>• {t('whats_new_legacy_title')}<br/>• {t('whats_new_ui_title')}<br/>• {t('whats_new_optimization_title')}<br/>• {t('whats_new_font_title')}</p></div>;
          case 'help': return <Accordion type="single" collapsible className="w-full">{faqs.map((f, i) => (<AccordionItem value={`f-${i}`} key={i} className="px-4"><AccordionTrigger>{f.question}</AccordionTrigger><AccordionContent>{f.answer === '[BOT_GUIDE_BUTTON]' ? <Button variant="outline" onClick={() => navigateTo('botGuide')}>{t('open_full_guide')}</Button> : <ReactMarkdown>{f.answer}</ReactMarkdown>}</AccordionContent></AccordionItem>))}</Accordion>;
          case 'botGuide': return botGuidePageContent;
          case 'account': return <div className='p-4 space-y-2'><Button variant="outline" className='w-full' onClick={() => { onOpenChange(false); setTimeout(() => setShowEditProfile(true), 150); }}>{t('edit_profile')}</Button><Button variant="destructive" className='w-full' onClick={handleLogout}>{t('logout')}</Button></div>;
          case 'about': return <div className='p-8 flex flex-col items-center text-center gap-4'><InfiniteLogo className='w-20 h-20 text-primary' /><h2 className='text-2xl font-bold'>Infinite</h2><Badge>{t('beta_badge')}</Badge><p className='text-sm opacity-70'>{t('version_info_detail')}</p></div>;
          default: return null;
      }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setTimeout(() => resetState(), 200); }}>
      <DialogContent hideCloseButton className={cn("max-w-md w-full h-[85svh] h-full-safe flex flex-col p-0 gap-0 overflow-hidden outline-none bg-card", experimentalDesign && "rounded-[2.5rem] border-none shadow-2xl")}>
        <DialogHeader className="relative flex-row items-center justify-center p-4 shrink-0 h-16 z-20 transition-all bg-card border-b">
          <Button variant="ghost" size="icon" onClick={handleBack} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button>
          <DialogTitle className="text-lg">{t(page as any) || t('settings')}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2"><X /></Button>
        </DialogHeader>
        <ScrollArea ref={scrollAreaRef} className="flex-1"><div key={page} className={cn("animate-in fade-in-0 duration-300", animationDirection === 'forward' ? 'slide-in-from-right-5' : 'slide-in-from-left-5')}>{renderPage()}</div></ScrollArea>
      </DialogContent>
    </Dialog>
    <EditProfileDialog user={currentUser} open={showEditProfile} onOpenChange={setShowEditProfile} />
    </>
  );
}