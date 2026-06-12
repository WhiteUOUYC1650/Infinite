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

import { ArrowLeft, ChevronRight, LogOut, Trash2, Paintbrush, Languages, HelpCircle, Info, User, Star, MessageSquare, Loader2, Bell, Pencil, HardDrive, ShieldCheck, X, Zap, Database, ChevronRight as ChevronRightIcon, Globe, Moon, Sun, Cpu, Gamepad2, Newspaper, Clock, Sparkles, Shield, Lock, Coins, ListTodo, Split, Image as ImageIcon, Video, Music, FileText, RefreshCcw, CheckCircle2, Download } from 'lucide-react';
import type { AuthenticatedUser, Transfer } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, increment, getDoc, collection, query, where, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserProfileCard } from './user-profile-card';
import { EditProfileDialog } from './edit-profile-dialog';
import { InfGoldIcon } from './ui/inf-gold-icon';
import { DailyBonusWheel, PRIZES_WITH_ANGLES } from './daily-bonus-wheel';
import { UserAvatarWithStatus, InfiniteLogo } from './chat/user-avatar-with-status';
import { VerifiedBadge } from './ui/verified-badge';
import { clearCacheDB, calculateCacheSize as getRealCacheSize } from '@/lib/cache-utils';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useUpdatePrompt } from '@/context/update-prompt-context';

type SettingsPage = 'main' | 'appearance' | 'theme' | 'language' | 'account' | 'help' | 'about' | 'chat' | 'infGold' | 'dailyBonus' | 'whatsNew' | 'dataStorage' | 'privacy' | 'transferHistory' | 'botGuide' | 'infinitePrem' | 'checkUpdates';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, isDarkMode, toggleTheme, sendOnEnter, toggleSendOnEnter, smoothScroll, toggleSmoothScroll, minimizeCallOnClose, toggleMinimizeCallOnClose, experimentalDesign, toggleExperimentalDesign, glassEffect, toggleGlassEffect, showFeed, toggleShowFeed, useSystemFont, toggleSystemFont } = useTheme();
  const { isUpdateAvailable, promptUpdate, updateInfo, currentVersion } = useUpdatePrompt();
  
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [currentCacheSize, setCurrentCacheSize] = useState('0 B');
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Update check states
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [hasCheckedUpdates, setHasCheckedUpdates] = useState(false);

  const transfersQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'transfers'), 
        where('senderId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
    );
  }, [db, currentUser.uid]);
  const { data: sentTransfers } = useCollection<Transfer>(transfersQuery);

  const receivedQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'transfers'), 
        where('receiverId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
    );
  }, [db, currentUser.uid]);
  const { data: receivedTransfers } = useCollection<Transfer>(receivedQuery);

  const isBonusAvailable = !currentUser.lastDailyBonusClaimed || (Date.now() - currentUser.lastDailyBonusClaimed.toMillis()) > 24 * 60 * 60 * 1000;

  const isExperimentalDesignRestricted = useMemo(() => {
    if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent;
        const match = ua.match(/Android\s([0-9\.]+)/);
        const version = match ? parseFloat(match[1]) : null;
        return version !== null && version < 9;
    }
    return false;
  }, []);

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

  const handleManualCheckUpdates = () => {
    setIsCheckingUpdates(true);
    setHasCheckedUpdates(false);
    setTimeout(() => {
        setIsCheckingUpdates(false);
        setHasCheckedUpdates(true);
    }, 2000);
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

  const handleClearCache = async () => {
      await clearCacheDB();
      calculateCacheSize();
      toast({ title: t('dm_success'), description: t('cache_cleared_success') });
  };

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

  const handleDeleteAccount = async () => {
    if (!auth || !auth.currentUser || !db || !currentUser.uid) return;
    setIsDeletingAccount(true);
    try {
        const uid = currentUser.uid;
        const username = currentUser.username;
        sessionStorage.setItem('isDeletingAccount', 'true');
        
        await runTransaction(db, async (transaction) => {
            transaction.update(doc(db, 'users', uid), {
                name: 'Deleted Account',
                username: `@deleted_${uid}`,
                avatar: '',
                status: 'offline',
                isDeleted: true,
                infGoldBalance: 0,
                subscriptionTier: 'none'
            });
            if (username) {
                transaction.delete(doc(db, 'usernames', username));
            }
        });

        await auth.currentUser.delete();
        toast({ title: t('delete_account_success') });
        router.push('/goodbye');
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: e.message || t('delete_account_error') });
        sessionStorage.removeItem('isDeletingAccount');
    } finally {
        setIsDeletingAccount(false);
    }
  };

  const faqs = [
    { question: t('faq_markdown_q'), answer: t('faq_markdown_a') },
    { question: t('faq_create_chat_q'), answer: t('faq_create_chat_a') },
    { question: t('faq_invite_q'), answer: t('faq_invite_a') },
    { question: t('faq_edit_profile_q'), answer: t('faq_edit_profile_a') },
    { question: t('faq_calls_q'), answer: t('faq_calls_a') },
    { question: t('faq_media_q'), answer: t('faq_media_a') },
    { question: t('faq_infgold_q'), answer: t('faq_infgold_a') },
    { question: t('faq_prem_q'), answer: t('faq_prem_a') },
    { question: t('faq_infvid_title'), answer: t('faq_infvid_a') },
    { question: t('faq_poll_q'), answer: t('faq_poll_a') },
    { question: t('faq_story_q'), answer: t('faq_story_a') },
    { question: t('faq_security_q'), answer: t('faq_security_a') },
    { question: t('faq_bot_prog_q'), answer: t('faq_bot_prog_a') },
  ];

  const botGuidePageContent = (
      <div className='p-6 space-y-8'>
          <div className='space-y-4'>
              <h2 className='text-3xl font-black font-headline text-primary'>{t('bot_guide_title')}</h2>
              <p className='text-muted-foreground text-sm leading-relaxed font-medium'>{t('bot_guide_intro')}</p>
          </div>
          
          <div className='space-y-8'>
              {/* Trigger Events */}
              <div className='space-y-3'>
                  <h3 className='font-black text-sm uppercase tracking-widest text-primary flex items-center gap-2'>
                    <Zap className='h-4 w-4 fill-primary/20' /> {t('bot_guide_events')}
                  </h3>
                  <div className='grid gap-3'>
                    <div className='p-4 bg-muted/40 rounded-2xl border border-border/50'>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p className='text-xs leading-relaxed'>{children}</p> }}>
                        {t('bot_guide_event_start')}
                      </ReactMarkdown>
                    </div>
                    <div className='p-4 bg-muted/40 rounded-2xl border border-border/50'>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p className='text-xs leading-relaxed'>{children}</p> }}>
                        {t('bot_guide_event_msg')}
                      </ReactMarkdown>
                    </div>
                  </div>
              </div>

              {/* Actions */}
              <div className='space-y-3'>
                  <h3 className='font-black text-sm uppercase tracking-widest text-blue-500 flex items-center gap-2'>
                    <MessageSquare className='h-4 w-4 fill-blue-500/20' /> {t('bot_guide_actions')}
                  </h3>
                  <div className='grid gap-3'>
                    <div className='p-4 bg-muted/40 rounded-2xl border border-border/50'>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p className='text-xs leading-relaxed'>{children}</p> }}>
                        {t('bot_guide_action_send')}
                      </ReactMarkdown>
                    </div>
                    <div className='p-4 bg-muted/40 rounded-2xl border border-border/50'>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p className='text-xs leading-relaxed'>{children}</p> }}>
                        {t('bot_guide_action_reply')}
                      </ReactMarkdown>
                    </div>
                    <div className='p-4 bg-muted/40 rounded-2xl border border-border/50'>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p className='text-xs leading-relaxed'>{children}</p> }}>
                        {t('bot_guide_action_wait')}
                      </ReactMarkdown>
                    </div>
                  </div>
              </div>

              {/* Logic */}
              <div className='space-y-3'>
                  <h3 className='font-black text-sm uppercase tracking-widest text-purple-500 flex items-center gap-2'>
                    <Split className='h-4 w-4' /> {t('bot_guide_logic')}
                  </h3>
                  <div className='p-4 bg-muted/40 rounded-2xl border border-border/50'>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p className='text-xs leading-relaxed'>{children}</p> }}>
                      {t('bot_guide_logic_if')}
                    </ReactMarkdown>
                    <div className='mt-2 p-2 bg-black/5 rounded-lg font-mono text-[10px] opacity-70'>
                      Example: {"{msg_text} == ping"} {'->'} Action: Send "pong"
                    </div>
                  </div>
                  <div className='p-4 bg-muted/40 rounded-2xl border border-border/50'>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p className='text-xs leading-relaxed'>{children}</p> }}>
                      {t('bot_guide_logic_math')}
                    </ReactMarkdown>
                  </div>
              </div>

              {/* Media */}
              <div className='space-y-3'>
                  <h3 className='font-black text-sm uppercase tracking-widest text-emerald-500 flex items-center gap-2'>
                    <ImageIcon className='h-4 w-4' /> {t('bot_guide_media')}
                  </h3>
                  <div className='p-4 bg-muted/40 rounded-2xl border border-border/50'>
                    <p className='text-xs leading-relaxed'>{t('bot_guide_media_desc')}</p>
                    <div className='flex gap-2 mt-4'>
                      <div className='p-2 bg-muted rounded-lg'><ImageIcon className='h-3 w-3' /></div>
                      <div className='p-2 bg-muted rounded-lg'><Video className='h-3 w-3' /></div>
                      <div className='p-2 bg-muted rounded-lg'><Music className='h-3 w-3' /></div>
                      <div className='p-2 bg-muted rounded-lg'><FileText className='h-3 w-3' /></div>
                    </div>
                  </div>
              </div>

              {/* Variables */}
              <div className='space-y-3'>
                  <h3 className='font-black text-sm uppercase tracking-widest text-rose-500 flex items-center gap-2'>
                    <Database className='h-4 w-4 fill-rose-500/20' /> {t('bot_guide_vars')}
                  </h3>
                  <p className='text-[11px] font-bold text-muted-foreground/80 pl-1'>{t('bot_guide_var_intro')}</p>
                  <div className='space-y-1 text-xs font-mono bg-muted/60 p-4 rounded-2xl border border-rose-500/10'>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{t('bot_guide_var_user')}</ReactMarkdown>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{t('bot_guide_var_msg')}</ReactMarkdown>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{t('bot_guide_var_bot')}</ReactMarkdown>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{t('bot_guide_var_time')}</ReactMarkdown>
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
          <SettingsItem icon={Paintbrush} label={t('appearance')} description={t('appearance_desc')} value={t(theme === 'frutiger' ? 'frutiger_aero' : (theme as any))} onClick={() => navigateTo('appearance')} showExpColors={experimentalDesign} iconBg="bg-blue-500/15" iconColor="text-blue-500" />
          <SettingsItem icon={MessageSquare} label={t('chat_settings')} description={t('chat_settings_desc')} onClick={() => navigateTo('chat')} showExpColors={experimentalDesign} iconBg="bg-green-500/15" iconColor="text-green-500" />
          <SettingsItem icon={ShieldCheck} label={t('privacy_security')} description={t('privacy_security_desc')} onClick={() => navigateTo('privacy')} showExpColors={experimentalDesign} iconBg="bg-rose-500/15" iconColor="text-rose-500" />
          <SettingsItem icon={HardDrive} label={t('data_storage')} description={t('data_storage_desc')} onClick={() => navigateTo('dataStorage')} showExpColors={experimentalDesign} iconBg="bg-orange-500/15" iconColor="text-orange-500" />
          <SettingsItem icon={Languages} label={t('language')} description={t('language_desc')} value={language.toUpperCase()} onClick={() => navigateTo('language')} showExpColors={experimentalDesign} iconBg="bg-purple-500/15" iconColor="text-purple-500" />
          <SettingsItem icon={InfGoldIcon} label="InfGold" description={t('infgold_desc')} onClick={() => navigateTo('infGold')} showExpColors={experimentalDesign} iconBg="bg-amber-500/15" iconColor="text-amber-600" isGlow={experimentalDesign} />
          <SettingsItem icon={User} label={t('profile')} description={t('edit_profile_desc')} onClick={() => navigateTo('account')} showExpColors={experimentalDesign} iconBg="bg-teal-500/15" iconColor="text-teal-500" />
          <SettingsItem icon={Star} label={t('whats_new')} description={t('whats_new_desc')} onClick={() => navigateTo('whatsNew')} showExpColors={experimentalDesign} iconBg="bg-yellow-500/15" iconColor="text-yellow-600" />
          <SettingsItem icon={HelpCircle} label={t('help')} description={t('faq_desc')} onClick={() => navigateTo('help')} showExpColors={experimentalDesign} iconBg="bg-pink-500/15" iconColor="text-pink-500" />
          <SettingsItem icon={RefreshCcw} label={t('check_updates')} description={t('check_updates_desc')} onClick={() => navigateTo('checkUpdates')} showExpColors={experimentalDesign} iconBg="bg-indigo-500/15" iconColor="text-indigo-600" />
          <SettingsItem icon={Info} label={t('version')} description={t('about_desc')} value={currentVersion} onClick={() => navigateTo('about')} showExpColors={experimentalDesign} iconBg="bg-gray-500/15" iconColor="text-gray-500" />
          
          {currentUser.isAdmin && (
            <div className='border-t mt-4'>
                <SettingsItem 
                    icon={Shield} 
                    label={t('admin_panel_title')} 
                    description={t('admin_panel_desc')}
                    onClick={() => router.push('/admin')} 
                    showExpColors={experimentalDesign} 
                    iconBg="bg-red-600/20" 
                    iconColor="text-red-600" 
                    isGlow={experimentalDesign}
                />
            </div>
          )}
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

  const handleSetStoryExpiration = async (hours: number) => {
    if (!db) return;
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), { storyExpirationDuration: hours });
        toast({ title: t('dm_success') });
    } catch (e) { console.error(e); }
  };

  const renderPage = () => {
      switch(page) {
          case 'main': return mainPageContent;
          case 'appearance': return (
              <div className='divide-y'>
                <SettingsSwitchItem id="dark-mode" label={t('dark_mode')} checked={isDarkMode} onCheckedChange={toggleTheme} description={t('light_mode')} />
                <SettingsItem icon={Paintbrush} label={t('color_theme')} value={t(theme as any)} onClick={() => navigateTo('theme')} description={t('color_theme')} />
                <SettingsSwitchItem id="sys-font" label={t('use_system_font_label')} checked={useSystemFont} onCheckedChange={toggleSystemFont} description={t('use_system_font_desc')} />
                <SettingsSwitchItem id="exp-design" label={t('experimental_design_label')} checked={experimentalDesign} onCheckedChange={toggleExperimentalDesign} description={isExperimentalDesignRestricted ? t('android_9_plus_only') : t('experimental_design_desc')} disabled={isExperimentalDesignRestricted} />
                <SettingsSwitchItem id="glass" label={t('glass_effect_label')} checked={glassEffect} onCheckedChange={toggleGlassEffect} description={t('glass_effect_desc')} />
                <SettingsSwitchItem id="show-feed" label={t('show_feed_label')} checked={showFeed} onCheckedChange={toggleShowFeed} description={t('show_feed_desc')} />
              </div>
          );
          case 'theme': return (
              <RadioGroup value={theme} onValueChange={v => setTheme(v as any)} className="p-4 space-y-1">
                  {['orange', 'purple', 'blue', 'gray', 'green', 'red', 'yellow', 'pink', 'frutiger', 'shining_gold'].map(tName => {
                      const isPremTheme = tName === 'shining_gold';
                      const isFrutiger = tName === 'frutiger';
                      return (
                        <div key={tName} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors">
                            <div className="flex items-center space-x-3">
                                <RadioGroupItem value={tName} id={tName} disabled={isPremTheme && currentUser.subscriptionTier !== 'prem'} />
                                <Label htmlFor={tName} className='capitalize cursor-pointer font-bold'>
                                    {isFrutiger ? t('frutiger_aero_label') : t(tName as any)}
                                </Label>
                            </div>
                            {isPremTheme && <Badge className="bg-purple-500 text-white text-[9px]">PREM</Badge>}
                        </div>
                      );
                  })}
              </RadioGroup>
          );
          case 'language': return <div className="p-4"><RadioGroup value={language} onValueChange={v => setLanguage(v as any)} className="space-y-1"><div className="flex items-center space-x-2 p-2"><RadioGroupItem value="en" id="en" /><Label htmlFor="en" className="font-bold">English</Label></div><div className="flex items-center space-x-2 p-2"><RadioGroupItem value="ru" id="ru" /><Label htmlFor="ru" className="font-bold">Русский</Label></div></RadioGroup></div>;
          case 'chat': return (
              <div className='divide-y'>
                  <SettingsSwitchItem id="send-enter" label={t('send_on_enter_label')} checked={sendOnEnter} onCheckedChange={toggleSendOnEnter} description={t('send_on_enter_label')} />
                  <SettingsSwitchItem id="smooth-scroll" label={t('smooth_scroll_label')} checked={smoothScroll} onCheckedChange={toggleSmoothScroll} description={t('smooth_scroll_desc')} />
                  <SettingsSwitchItem id="min-call" label={t('minimize_call_on_close_label')} checked={minimizeCallOnClose} onCheckedChange={toggleMinimizeCallOnClose} description={t('minimize_call_on_close_label')} />
              </div>
          );
          case 'privacy': return (
              <div className='divide-y'>
                  <SettingsSwitchItem id="login-prot" label={t('login_protection_label')} checked={!!currentUser.loginProtectionEnabled} onCheckedChange={handleToggleLoginProtection} description={t('login_protection_desc')} />
                  {currentUser.loginProtectionEnabled && (
                      <SettingsItem icon={Lock} label={t('cloud_password_label')} onClick={() => {}} description={t('cloud_password_desc')} />
                  )}
                  <div className="p-4 space-y-3">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{t('story_expiration_label')}</Label>
                      <Select 
                        value={(currentUser.storyExpirationDuration ?? 24).toString()} 
                        onValueChange={(v) => handleSetStoryExpiration(parseInt(v))}
                      >
                          <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-none font-bold">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                              <SelectItem value="12">{t('story_expiration_12 hours')}</SelectItem>
                              <SelectItem value="24">{t('story_expiration_24 hours')}</SelectItem>
                              <SelectItem value="48">{t('story_expiration_48 hours')}</SelectItem>
                              <SelectItem value="72">{t('story_expiration_72 hours')}</SelectItem>
                              <SelectItem value="0">{t('story_expiration_never')}</SelectItem>
                          </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground ml-1 leading-tight">{t('story_expiration_desc')}</p>
                  </div>
              </div>
          );
          case 'dataStorage': return (
              <div className='p-6 space-y-6'>
                  <div className='bg-card border rounded-3xl p-6 space-y-4 shadow-sm'>
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                              <Database className="h-6 w-6 text-orange-500" />
                          </div>
                          <div>
                              <p className='text-xs font-black uppercase tracking-widest text-muted-foreground'>{t('cache_usage')}</p>
                              <p className='text-2xl font-black text-foreground'>{currentCacheSize}</p>
                          </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{t('clear_cache_desc')}</p>
                      <Button variant="outline" className='w-full h-12 rounded-2xl font-bold border-orange-500/20 hover:bg-orange-500/5' onClick={handleClearCache}>
                          <Trash2 className="mr-2 h-4 w-4 text-orange-500" /> {t('clear_cache')}
                      </Button>
                  </div>
              </div>
          );
          case 'infGold': return (
              <div className='p-6 space-y-4'>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-8 text-center space-y-4">
                      <InfGoldIcon className='h-16 w-16 mx-auto experimental-glow text-amber-600' />
                      <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700/60 mb-1">{t('inf_gold_balance')}</p>
                          <h2 className='text-5xl font-black text-amber-600'>{Math.round(currentUser.infGoldBalance || 0)}</h2>
                      </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <SettingsItem icon={Sparkles} label={t('daily_bonus')} onClick={() => navigateTo('dailyBonus')} showExpColors={experimentalDesign} iconBg="bg-amber-500/15" iconColor="text-amber-600" />
                    <SettingsItem icon={Star} label={t('infinite_prem')} onClick={() => navigateTo('infinitePrem')} showExpColors={experimentalDesign} iconBg="bg-purple-500/15" iconColor="text-purple-600" />
                    <SettingsItem icon={Clock} label={t('transfer_history')} onClick={() => navigateTo('transferHistory')} showExpColors={experimentalDesign} iconBg="bg-blue-500/15" iconColor="text-blue-500" />
                    <SettingsSwitchItem id="prem-badge" label={t('show_prem_badge')} checked={!!currentUser.showPremBadge} onCheckedChange={(v) => updateDoc(doc(db!, 'users', currentUser.uid), { showPremBadge: v })} disabled={currentUser.subscriptionTier !== 'prem'} />
                  </div>
              </div>
          );
          case 'infinitePrem': return (
              <div className='p-6 space-y-6'>
                  <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl shadow-purple-500/20 relative overflow-hidden">
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 blur-3xl rounded-full" />
                      <div className="relative z-10 space-y-4">
                          <VerifiedBadge className="w-12 h-12" />
                          <h2 className="text-3xl font-black font-headline leading-none">Infinite Prem</h2>
                          <p className="text-white/80 text-sm leading-relaxed">{t('prem_description')}</p>
                          <ul className="space-y-3 pt-2">
                              {[1, 2, 3].map(i => (
                                  <li key={i} className="flex items-center gap-3 text-sm font-bold">
                                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                          <Check className="w-3 h-3" />
                                      </div>
                                      {t(`prem_benefit_${i}` as any)}
                                  </li>
                              ))}
                          </ul>
                      </div>
                  </div>
                  <div className="space-y-3">
                      <Button className="w-full h-16 rounded-3xl font-black text-lg bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-600/20">
                          {t('subscribe_monthly')}
                      </Button>
                      <Button variant="outline" className="w-full h-16 rounded-3xl font-black text-lg border-purple-200">
                          {t('subscribe_yearly')}
                      </Button>
                      <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('yearly_discount_note')}</p>
                  </div>
              </div>
          );
          case 'transferHistory': return (
              <div className='p-4 space-y-4'>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Последние операции</h3>
                  <div className="space-y-2">
                      {[...(sentTransfers || []), ...(receivedTransfers || [])]
                        .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
                        .map(t => {
                            const isSent = t.senderId === currentUser.uid;
                            return (
                                <div key={t.id} className="bg-card border rounded-2xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isSent ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500")}>
                                            {isSent ? <ArrowLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm leading-tight">{isSent ? t.receiverName : t.senderName}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-medium">{isSent ? 'Sent' : 'Received'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn("font-black text-base", isSent ? "text-red-500" : "text-green-500")}>
                                            {isSent ? '-' : '+'}{t.amount} G
                                        </p>
                                        <p className="text-[9px] text-muted-foreground">{format(t.timestamp.toMillis(), 'dd.MM, HH:mm')}</p>
                                    </div>
                                </div>
                            );
                        })
                      }
                      {(!sentTransfers?.length && !receivedTransfers?.length) && (
                          <div className="text-center py-20 opacity-30">
                              <Coins className="h-12 w-12 mx-auto mb-2" />
                              <p className="text-xs font-bold uppercase">{t('no_transfers')}</p>
                          </div>
                      )}
                  </div>
              </div>
          );
          case 'dailyBonus': return <div className='p-6'><DailyBonusWheel onSpin={handleSpin} isSpinning={isSpinning} setSpinning={setSpinning} canSpin={isBonusAvailable} rotation={wheelRotation} /></div>;
          case 'whatsNew': return (
              <div className='p-6 space-y-8'>
                  <div className="text-center space-y-2">
                    <h2 className='text-3xl font-black font-headline text-primary'>What's New</h2>
                    <p className='text-sm text-muted-foreground font-bold uppercase tracking-widest'>{t('beta_badge')}</p>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-card border rounded-3xl p-6 shadow-sm">
                          <div className="flex flex-col gap-3 text-sm font-bold leading-relaxed">
                            <div className="flex items-start gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" /> <span className='flex-1'>Добавление мини-приложений для ботов</span></div>
                            <div className="flex items-start gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" /> <span className='flex-1'>Оптимизация</span></div>
                            <div className="flex items-start gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" /> <span className='flex-1'>Исправления</span></div>
                          </div>
                      </div>
                  </div>
              </div>
          );
          case 'help': return (
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem value={`f-${i}`} key={i} className="px-4">
                  <AccordionTrigger className="text-left font-bold">{f.question}</AccordionTrigger>
                  <AccordionContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {f.answer.includes('[BOT_GUIDE_BUTTON]') ? (
                        <>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{f.answer.replace('[BOT_GUIDE_BUTTON]', '')}</ReactMarkdown>
                          <Button variant="outline" className="w-full rounded-xl h-12 mt-4 font-bold border-primary/20 hover:bg-primary/5" onClick={() => navigateTo('botGuide')}>
                            <Info className='mr-2 h-4 w-4 text-primary' /> {t('open_full_guide')}
                          </Button>
                        </>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{f.answer}</ReactMarkdown>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          );
          case 'botGuide': return botGuidePageContent;
          case 'checkUpdates': return (
              <div className='p-12 flex flex-col items-center text-center gap-8'>
                  <div className={cn(
                      "w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center shadow-inner transition-transform duration-1000",
                      isCheckingUpdates && "rotate-180"
                  )}>
                      {isCheckingUpdates ? (
                          <Loader2 className="h-10 w-10 text-primary animate-spin" />
                      ) : (
                          <RefreshCcw className="h-10 w-10 text-primary" />
                      )}
                  </div>
                  
                  <div className="space-y-4">
                      <h2 className="text-2xl font-black font-headline">
                          {isCheckingUpdates ? t('checking_updates_progress') : (
                              hasCheckedUpdates 
                                ? (isUpdateAvailable ? t('update_available_title') : t('latest_version_installed')) 
                                : t('check_updates')
                          )}
                      </h2>
                      {hasCheckedUpdates && (
                          <p className="text-sm text-muted-foreground font-medium">
                              {isUpdateAvailable 
                                ? t('update_available_status', { version: updateInfo?.latest })
                                : `${t('version')}: ${currentVersion}`
                              }
                          </p>
                      )}
                  </div>

                  {!isCheckingUpdates && (
                      <div className="w-full max-w-xs pt-4">
                          {isUpdateAvailable && hasCheckedUpdates ? (
                              <Button className="w-full h-14 rounded-2xl font-black text-lg shadow-xl" onClick={promptUpdate}>
                                  <Download className="mr-2 h-5 w-5" /> {t('download')}
                              </Button>
                          ) : (
                              <Button variant="outline" className="w-full h-14 rounded-2xl font-bold text-lg" onClick={handleManualCheckUpdates}>
                                  {t('check_updates')}
                              </Button>
                          )}
                      </div>
                  )}
              </div>
          );
          case 'account': return (
              <div className='p-6 space-y-4'>
                  <Button variant="outline" className='w-full h-14 rounded-2xl font-bold text-lg' onClick={() => { onOpenChange(false); setTimeout(() => setShowEditProfile(true), 150); }}>
                      <Pencil className="mr-3 h-5 w-5 text-primary" /> {t('edit_profile')}
                  </Button>
                  <Button variant="destructive" className='w-full h-14 rounded-2xl font-bold text-lg' onClick={handleLogout}>
                      <LogOut className="mr-3 h-5 w-5" /> {t('logout')}
                  </Button>
                  <div className="pt-8 border-t">
                      <Button variant="ghost" className="w-full h-12 rounded-xl text-destructive hover:bg-destructive/10 font-bold" onClick={() => setShowDeleteConfirm(true)}>
                          <Trash2 className="mr-3 h-4 w-4" /> {t('delete_account')}
                      </Button>
                  </div>
              </div>
          );
          case 'about': return (
              <div className='p-12 flex flex-col items-center text-center gap-6'>
                  <div className="w-32 h-32 rounded-[2.5rem] bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 experimental-glow">
                    <InfiniteLogo className='w-20 h-20 text-white' />
                  </div>
                  <div className="space-y-2">
                    <h2 className='text-4xl font-black font-headline'>Infinite</h2>
                    <Badge className="bg-primary text-white h-6 px-3 rounded-full text-xs font-black">{t('beta_badge')}</Badge>
                  </div>
                  <p className='text-sm text-muted-foreground leading-relaxed max-w-xs font-medium'>{t('version_info_detail')}</p>
              </div>
          );
          default: return null;
      }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setTimeout(() => resetState(), 200); }}>
      <DialogContent hideCloseButton className={cn("max-w-md w-full h-[85svh] h-full-safe flex flex-col p-0 gap-0 overflow-hidden outline-none bg-card", experimentalDesign && "rounded-[2.5rem] border-none shadow-2xl")}>
        <DialogHeader className="relative flex-row items-center justify-center p-4 shrink-0 h-16 z-20 transition-all bg-card border-b">
          <Button variant="ghost" size="icon" onClick={handleBack} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button>
          <DialogTitle className="text-lg font-black font-headline tracking-tight">{t(page as any) || t('settings')}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2"><X /></Button>
        </DialogHeader>
        <ScrollArea ref={scrollAreaRef} className="flex-1"><div key={page} className={cn("animate-in fade-in-0 duration-300", animationDirection === 'forward' ? 'slide-in-from-right-5' : 'slide-in-from-left-5')}>{renderPage()}</div></ScrollArea>
      </DialogContent>
    </Dialog>
    
    <EditProfileDialog user={currentUser} open={showEditProfile} onOpenChange={setShowEditProfile} />
    
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
            <AlertDialogHeader className="items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                    <Trash2 className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-2">
                    <AlertDialogTitle className="text-2xl font-bold font-headline">{t('delete_account_confirm_title')}</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground leading-relaxed">
                        {t('delete_account_confirm_desc')}
                    </AlertDialogDescription>
                </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col gap-2 pt-4 sm:flex-col sm:justify-center">
                <AlertDialogAction 
                    onClick={handleDeleteAccount} 
                    disabled={isDeletingAccount}
                    className={cn(buttonVariants({ variant: 'destructive' }), "w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-destructive/20")}
                >
                    {isDeletingAccount ? <Loader2 className="animate-spin" /> : t('delete_account')}
                </AlertDialogAction>
                <AlertDialogCancel className="w-full h-12 rounded-2xl font-medium border-none hover:bg-muted">{t('cancel')}</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );

  function resetState() {
    setPageHistory(['main']);
    setAnimationDirection('forward');
    setHasCheckedUpdates(false);
  }
}
