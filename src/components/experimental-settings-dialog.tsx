
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

import { ArrowLeft, ChevronRight, LogOut, Trash2, Paintbrush, Languages, HelpCircle, Info, User, Star, MessageSquare, Loader2, Bell, Pencil, HardDrive, ShieldCheck, X, Zap, Database, Globe, Moon, Sun, Cpu, Gamepad2, Newspaper, Clock, Sparkles, Shield, Lock, Coins, ListTodo, Split, Image as ImageIcon, Video, Music, FileText, RefreshCcw, RefreshCw, CheckCircle2, Download, Settings, Check, LayoutGrid, Gift, Scale, Archive, FileSearch, Smartphone, KeyRound, ShoppingBag, Code2 } from 'lucide-react';
import type { AuthenticatedUser, Transfer } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, increment, getDoc, collection, query, where, orderBy, limit, deleteDoc, runTransaction } from 'firebase/firestore';
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
import { GiftPickerDialog } from './gifts/gift-picker-dialog';
import { LegalDialog } from './legal-dialog';
import { Input } from './ui/input';
import React from 'react';

type SettingsPage = 'main' | 'appearance' | 'theme' | 'language' | 'account' | 'help' | 'about' | 'chat' | 'infGold' | 'dailyBonus' | 'whatsNew' | 'dataStorage' | 'privacy' | 'transferHistory' | 'botGuide' | 'infinitePrem' | 'checkUpdates';

const STANDARD_COLORS: Record<string, string> = {
  '0': '#000000',
  '1': '#0000AA',
  '2': '#00AA00',
  '3': '#00AAAA',
  '4': '#AA0000',
  '5': '#AA00AA',
  '6': '#FFAA00',
  '7': '#AAAAAA',
  '8': '#555555',
  '9': '#5555FF',
  'a': '#55FF55',
  'b': '#55FFFF',
  'c': '#FF5555',
  'd': '#FF55FF',
  'e': '#FFFF55',
  'f': '#FFFFFF',
};

const ColoredText = ({ text }: { text: string }) => {
  const regex = /(§[0-9a-fA-F]|§\[[0-9a-fA-F]{3,6}\])/g;
  const parts = text.split(regex);
  if (parts.length === 1) return <>{text}</>;
  let currentColor: string | undefined = undefined;
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('§')) {
          if (part.startsWith('§[')) {
            const hex = part.slice(2, -1);
            currentColor = `#${hex}`;
          } else {
            const code = part[1].toLowerCase();
            currentColor = STANDARD_COLORS[code];
          }
          return null; 
        }
        return <span key={i} style={{ color: currentColor }}>{part}</span>;
      })}
    </>
  );
};

const processMarkdownChildren = (children: any): any => {
    return React.Children.map(children, child => {
        if (typeof child === 'string') return <ColoredText text={child} />;
        if (React.isValidElement(child) && child.props.children) {
            return React.cloneElement(child, { children: processMarkdownChildren(child.props.children) } as any);
        }
        return child;
    });
};

const SettingsItem = ({ icon: Icon, label, value, onClick, disabled = false, description, iconBg = "bg-primary/10", iconColor = "text-primary", showExpColors = false, isGlow = false, glassEffect = false }: { icon: React.ElementType, label: string, value?: string, onClick: () => void, disabled?: boolean, description?: string, iconBg?: string, iconColor?: string, showExpColors?: boolean, isGlow?: boolean, glassEffect?: boolean }) => (
    <button onClick={onClick} className={cn("flex items-center w-full p-4 text-left rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none group", glassEffect ? "glass-button mb-1 border-none shadow-none" : "hover:bg-muted")} disabled={disabled}>
        <div className={cn("flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-4 transition-colors", showExpColors ? iconBg : "bg-primary/10 group-hover:bg-primary/20", isGlow && "experimental-glow")}><Icon className={cn("h-5 w-5", showExpColors ? iconColor : "text-primary")} /></div>
        <div className="flex-1 flex flex-col justify-center min-w-0 mr-2"><span className="font-bold whitespace-normal leading-tight">{label}</span>{description && <span className="text-[10px] text-muted-foreground whitespace-normal leading-tight mt-0.5">{description}</span>}</div>
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">{value && <span className='capitalize text-xs max-w-[80px] truncate font-bold'>{value}</span>}<ChevronRight className="h-4 w-4 shrink-0" /></div>
  </button>
);

const SettingsSwitchItem = ({ label, checked, onCheckedChange, id, description, disabled = false, glassEffect = false }: { label: string, checked: boolean, onCheckedChange: (checked: boolean) => void, id: string, description?: string, disabled?: boolean, glassEffect?: boolean }) => (
    <div className={cn("flex items-start justify-between w-full p-4 rounded-xl", glassEffect && "glass-panel mb-1 border-none shadow-none bg-muted/20")}>
        <div className="flex flex-col flex-1 mr-4 min-w-0"><Label htmlFor={id} className={cn("font-bold cursor-pointer whitespace-normal leading-tight mb-1", disabled && "opacity-50")}>{label}</Label>{description && <span className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{description}</span>}</div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className={cn("shrink-0 mt-1", glassEffect && "glass-switch")} disabled={disabled} />
    </div>
);

export function ExperimentalSettingsDialog({ open, onOpenChange, currentUser }: { open: boolean, onOpenChange: (open: boolean) => void, currentUser: AuthenticatedUser }) {
  const [pageHistory, setPageHistory] = useState<SettingsPage[]>(['main']); const [animationDirection, setAnimationDirection] = useState<'forward' | 'backward'>('forward'); const page = pageHistory[pageHistory.length - 1];
  const [showEditProfile, setShowEditProfile] = useState(false); const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); const scrollAreaRef = useRef<HTMLDivElement>(null); const router = useRouter();
  const { t, language, setLanguage } = useLanguage(); const { theme, setTheme, isDarkMode, toggleTheme, sendOnEnter, toggleSendOnEnter, smoothScroll, toggleSmoothScroll, minimizeCallOnClose, toggleMinimizeCallOnClose, experimentalDesign, toggleExperimentalDesign, glassEffect, toggleGlassEffect, showFeed, toggleShowFeed, useSystemFont, toggleSystemFont, showSnowflakes, toggleSnowflakes } = useTheme(); const { isUpdateAvailable, promptUpdate, updateInfo, currentVersion } = useUpdatePrompt();
  const auth = useAuth(); const db = useFirestore(); const { toast } = useToast(); const [currentCacheSize, setCurrentCacheSize] = useState('0 B'); const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false); const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false); const [hasCheckedUpdates, setHasCheckedUpdates] = useState(false); const [isBuyingPrem, setIsBuyingPrem] = useState(false);
  const [showSelfGiftPicker, setShowSelfGiftPicker] = useState(false);
  const [showLegalType, setShowLegalType] = useState<'tos' | 'privacy' | null>(null);

  // PIN State
  const [pinLockEnabled, setPinLockEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinStep, setPinSetupStep] = useState<'current' | 'new'>('new');

  useEffect(() => {
    const saved = localStorage.getItem('app-local-pin');
    setPinLockEnabled(!!saved);
  }, []);

  const handleTogglePin = (enabled: boolean) => {
    if (enabled) {
        setPinSetupStep('new');
        setPinInput('');
        setShowPinSetup(true);
    } else {
        setPinSetupStep('current');
        setPinInput('');
        setShowPinSetup(true);
    }
  };

  const handlePinSubmit = () => {
    if (pinStep === 'new') {
        if (pinInput.length < 4) { toast({ variant: 'destructive', title: 'Error', description: t('pin_too_short') }); return; }
        if (pinInput.length > 16) { toast({ variant: 'destructive', title: 'Error', description: t('pin_too_long') }); return; }
        localStorage.setItem('app-local-pin', pinInput);
        setPinLockEnabled(true);
        toast({ title: t('dm_success'), description: t('local_pin_lock') });
    } else {
        const saved = localStorage.getItem('app-local-pin');
        if (pinInput !== saved) { toast({ variant: 'destructive', title: 'Error', description: t('pin_error_mismatch') }); return; }
        localStorage.removeItem('app-local-pin');
        setPinLockEnabled(false);
        toast({ title: t('dm_success') });
    }
    setShowPinSetup(false);
    setPinInput('');
  };

  const userId = currentUser.uid || currentUser.id || '';

  const transfersQuery = useMemo(() => { if (!db || !userId) return null; return query(collection(db, 'transfers'), where('senderId', '==', userId), orderBy('timestamp', 'desc'), limit(50)); }, [db, userId]); const { data: sentTransfers } = useCollection<Transfer>(transfersQuery);
  const receivedQuery = useMemo(() => { if (!db || !userId) return null; return query(collection(db, 'transfers'), where('receiverId', '==', userId), orderBy('timestamp', 'desc'), limit(50)); }, [db, userId]); const { data: receivedTransfers } = useCollection<Transfer>(receivedQuery);
  const isBonusAvailable = !currentUser.lastDailyBonusClaimed || (Date.now() - currentUser.lastDailyBonusClaimed.toMillis()) > 24 * 60 * 60 * 1000;
  
  const formatSize = (bytes: number) => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; };
  const calculateCacheSize = async () => { const dbSize = await getRealCacheSize(); setCurrentCacheSize(formatSize(dbSize)); };
  const handleManualCheckUpdates = () => { setIsCheckingUpdates(true); setHasCheckedUpdates(false); setTimeout(() => { setIsCheckingUpdates(false); setHasCheckedUpdates(true); }, 2000); };
  
  const handleBuyPrem = async (isYearly = false) => { 
    if (!db || !userId || isBuyingPrem) return; 
    const cost = isYearly ? 5000 : 500; 
    setIsBuyingPrem(true); 
    try { 
      await runTransaction(db, async (tx) => { 
        const userRef = doc(db, 'users', userId); 
        const userSnap = await tx.get(userRef); 
        if (!userSnap.exists()) throw new Error("User not found"); 
        const data = userSnap.data(); 
        const currentGold = data.infGoldBalance || 0; 
        if (currentGold < cost) throw new Error(t('not_enough_gold')); 
        tx.update(userRef, { 
          infGoldBalance: increment(-cost), 
          subscriptionTier: 'prem', 
          subscriptionStartedAt: serverTimestamp(), 
          showPremBadge: true 
        }); 
      }); 
      toast({ title: t('dm_success'), description: "Infinite Prem activated!" }); 
      handleBack(); 
    } catch (e: any) { 
      toast({ variant: 'destructive', title: 'Error', description: e.message }); 
    } finally { 
      setIsBuyingPrem(false); 
    } 
  };

  useEffect(() => { if (open) calculateCacheSize(); }, [open, page]);
  useEffect(() => { if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0; }, [page]);
  const navigateTo = (newPage: SettingsPage) => { setAnimationDirection('forward'); setPageHistory(prev => [...prev, newPage]); };
  const handleBack = () => { if (pageHistory.length > 1) { setAnimationDirection('backward'); setPageHistory(prev => prev.slice(0, -1)); } else { onOpenChange(false); } };
  useEffect(() => { if (!open) return; const handleSystemBack = () => { handleBack(); }; let backListener: any; if (Capacitor.isNativePlatform()) { import('@capacitor/app').then(({ App }) => { backListener = App.addListener('backButton', handleSystemBack); }); } return () => { if (backListener) { backListener.then((l: any) => l.remove()); } }; }, [open, pageHistory]);
  
  const handleClearCache = async () => { await clearCacheDB(); calculateCacheSize(); toast({ title: t('dm_success'), description: t('cache_cleared_success') }); };
  const handleLogout = async () => { if (auth && db && userId) { const userRef = doc(db, 'users', userId); try { await updateDoc(userRef, { status: 'offline', lastSeen: serverTimestamp() }); } catch (error) { console.error(error); } auth.signOut(); } else if (auth) { auth.signOut(); } };
  const handleToggleLoginProtection = async (enabled: boolean) => { if (!db || !userId) return; setIsUpdatingPrivacy(true); try { await updateDoc(doc(db, 'users', userId), { loginProtectionEnabled: enabled }); toast({ title: t('dm_success') }); } finally { setIsUpdatingPrivacy(false); } };
  const handleSetStoryExpiration = async (hours: number) => { if (!db || !userId) return; try { await updateDoc(doc(db, 'users', userId), { storyExpirationDuration: hours }); toast({ title: t('dm_success') }); } catch (e) { console.error(e); } };

  const handleDeleteAccount = async () => { if (!auth || !auth.currentUser || !db || !userId) return; setIsDeletingAccount(true); try { const uid = userId; const username = currentUser.username; sessionStorage.setItem('isDeletingAccount', 'true'); await runTransaction(db, async (transaction) => { transaction.update(doc(db, 'users', uid), { name: 'Deleted Account', username: `@deleted_${uid}`, avatar: '', status: 'offline', isDeleted: true, infGoldBalance: 0, subscriptionTier: 'none' }); if (username) { transaction.delete(doc(db, 'usernames', username)); } }); await auth.currentUser.delete(); toast({ title: t('delete_account_success') }); router.push('/goodbye'); } catch (e: any) { console.error(e); toast({ variant: 'destructive', title: 'Error', description: e.message || t('delete_account_error') }); sessionStorage.removeItem('isDeletingAccount'); } finally { setIsDeletingAccount(false); } };
  const faqs = [ { question: t('faq_markdown_q'), answer: t('faq_markdown_a') }, { question: t('faq_create_chat_q'), answer: t('faq_create_chat_a') }, { question: t('faq_invite_q'), answer: t('faq_invite_a') }, { question: t('faq_edit_profile_q'), answer: t('faq_edit_profile_a') }, { question: t('faq_calls_q'), answer: t('faq_calls_a') }, { question: t('faq_media_q'), answer: t('faq_media_a') }, { question: t('faq_infgold_q'), answer: t('faq_infgold_q') }, { question: t('faq_prem_q'), answer: t('faq_prem_a') }, { question: t('faq_infvid_title'), answer: t('faq_infvid_a') }, { question: t('faq_poll_q'), answer: t('faq_poll_a') }, { question: t('faq_story_q'), answer: t('faq_story_a') }, { question: t('faq_security_q'), answer: t('faq_security_a') }, { question: t('faq_bot_prog_q'), answer: t('faq_bot_prog_a') }, ];
  
  const [wheelRotation, setWheelRotation] = useState(0); const [isSpinning, setSpinning] = useState(false);
  const handleSpin = async (): Promise<void> => {
    const totalW = PRIZES_WITH_ANGLES.reduce((sum, p) => sum + p.weight, 0); let randomW = Math.random() * totalW; const winningPrize = PRIZES_WITH_ANGLES.find(p => { randomW -= p.weight; return randomW <= 0; })!; const baseRotation = 360 * 5; const prizeAngle = winningPrize.startAngle + winningPrize.angle / 2; const randomOffset = (Math.random() - 0.5) * (winningPrize.angle * 0.8); setWheelRotation(prev => (prev - (prev % 360)) + baseRotation - prizeAngle - randomOffset);
    setTimeout(async () => { toast({ title: t('you_won'), description: `${winningPrize.value} InfGold!` }); setSpinning(false); try { await updateDoc(doc(db!, 'users', userId!), { infGoldBalance: increment(winningPrize.value), lastDailyBonusClaimed: serverTimestamp(), }); } catch (e) { console.error(e); } }, 5000);
  };

  const renderPage = () => {
      switch(page) {
          case 'main': return (
              <div className="animate-in fade-in duration-300">
                {(experimentalDesign || glassEffect) ? (<div className="flex flex-col items-center pt-6 pb-8 px-6 bg-gradient-to-b from-primary/15 to-transparent"><div className="relative mb-6"><UserAvatarWithStatus user={currentUser as any} className={cn("w-28 h-28 text-4xl border-4 border-background shadow-2xl rounded-full experimental-glow")} />{currentUser.activeGiftEmoji && <div className="absolute -bottom-1 -right-1 bg-background rounded-full w-10 h-10 flex items-center justify-center text-xl shadow-lg border-2 border-primary/20">{currentUser.activeGiftEmoji}</div>}</div><div className="text-center space-y-1.5"><h2 className="text-3xl font-bold font-headline flex items-center justify-center gap-2">{currentUser.name}{currentUser.isAdmin && <VerifiedBadge />}</h2><p className="text-muted-foreground font-medium">{currentUser.username}</p></div></div>) : (<div className="p-0 overflow-hidden"><UserProfileCard user={currentUser} onEditProfile={() => { onOpenChange(false); setTimeout(() => setShowEditProfile(true), 150); }} /></div>)}
                <div className={cn("border-t p-2 space-y-1", (experimentalDesign || glassEffect) && "mt-2")}>
                  <SettingsItem icon={Paintbrush} label={t('appearance')} description={t('appearance_desc')} value={t(theme as any)} onClick={() => navigateTo('appearance')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-blue-500/15" iconColor="text-blue-500" glassEffect={glassEffect} />
                  <SettingsItem icon={MessageSquare} label={t('chat_settings')} description={t('chat_settings_desc')} onClick={() => navigateTo('chat')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-green-500/15" iconColor="text-green-500" glassEffect={glassEffect} />
                  <SettingsItem icon={ShieldCheck} label={t('privacy_security')} description={t('privacy_security_desc')} onClick={() => navigateTo('privacy')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-rose-500/15" iconColor="text-rose-500" glassEffect={glassEffect} />
                  <SettingsItem icon={HardDrive} label={t('data_storage')} description={t('data_storage_desc')} onClick={() => navigateTo('dataStorage')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-orange-500/15" iconColor="text-orange-500" glassEffect={glassEffect} />
                  <SettingsItem icon={Languages} label={t('language')} description={t('language_desc')} value={language.toUpperCase()} onClick={() => navigateTo('language')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-purple-500/15" iconColor="text-purple-500" glassEffect={glassEffect} />
                  <SettingsItem icon={InfGoldIcon} label="InfGold" description={t('infgold_desc')} onClick={() => navigateTo('infGold')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-amber-500/15" iconColor="text-amber-600" isGlow={experimentalDesign || glassEffect} glassEffect={glassEffect} />
                  <SettingsItem icon={User} label={t('profile')} description={t('edit_profile_desc')} onClick={() => navigateTo('account')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-teal-500/15" iconColor="text-teal-500" glassEffect={glassEffect} />
                  <SettingsItem icon={Star} label={t('whats_new')} description={t('whats_new_desc')} onClick={() => navigateTo('whatsNew')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-yellow-500/15" iconColor="text-yellow-600" glassEffect={glassEffect} />
                  <SettingsItem icon={HelpCircle} label={t('help')} description={t('faq_desc')} onClick={() => navigateTo('help')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-pink-500/15" iconColor="text-pink-500" glassEffect={glassEffect} />
                  <SettingsItem icon={RefreshCcw} label={t('check_updates')} description={t('check_updates_desc')} onClick={() => navigateTo('checkUpdates')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-indigo-500/15" iconColor="text-indigo-600" glassEffect={glassEffect} />
                  <SettingsItem icon={Info} label={t('version')} description={t('about_desc')} value={currentVersion} onClick={() => navigateTo('about')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-gray-500/15" iconColor="text-gray-500" glassEffect={glassEffect} />
                  {currentUser.isAdmin && (<div className='border-t mt-4 pt-2'><SettingsItem icon={Shield} label={t('admin_panel_title')} description={t('admin_panel_desc')} onClick={() => router.push('/admin')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-red-600/20" iconColor="text-red-600" isGlow={experimentalDesign || glassEffect} glassEffect={glassEffect} /></div>)}
                </div>
              </div>
          );
          case 'appearance': return (
            <div className='p-2 space-y-1 divide-y animate-in fade-in slide-in-from-right-4 duration-300'>
              <SettingsSwitchItem id="dark-mode" label={t('dark_mode')} checked={isDarkMode} onCheckedChange={toggleTheme} description={t('light_mode')} glassEffect={glassEffect} />
              <SettingsItem icon={Paintbrush} label={t('color_theme')} value={t(theme as any)} onClick={() => navigateTo('theme')} description={t('color_theme')} glassEffect={glassEffect} />
              <SettingsSwitchItem id="sys-font" label={t('use_system_font_label')} checked={useSystemFont} onCheckedChange={toggleSystemFont} description={t('use_system_font_desc')} glassEffect={glassEffect} />
              <SettingsSwitchItem id="snowflakes" label={t('snowflakes')} checked={showSnowflakes} onCheckedChange={toggleSnowflakes} description={t('snowflakes')} glassEffect={glassEffect} />
              <SettingsSwitchItem id="exp-design" label={t('experimental_design_label')} checked={experimentalDesign} onCheckedChange={toggleExperimentalDesign} description={t('experimental_design_desc')} glassEffect={glassEffect} />
              <SettingsSwitchItem id="glass" label={t('glass_effect_label')} checked={glassEffect} onCheckedChange={toggleGlassEffect} description={t('glass_effect_desc')} glassEffect={glassEffect} />
              <SettingsSwitchItem id="show-feed" label={t('show_feed_label')} checked={showFeed} onCheckedChange={toggleShowFeed} description={t('show_feed_desc')} glassEffect={glassEffect} />
            </div>
          );
          case 'whatsNew': return (
              <div className='p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300'>
                  <div className="text-center space-y-2 mb-2">
                      <h2 className='text-4xl font-black font-headline text-primary'>{t('whats_new')}</h2>
                      <p className='text-sm text-muted-foreground font-bold uppercase tracking-widest'>{currentVersion} Official</p>
                  </div>
                  <div className="grid gap-3">
                      <div className={cn("flex items-center gap-4 p-5 border rounded-3xl shadow-sm", glassEffect ? "glass-panel" : "bg-card")}>
                          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0"><Code2 className="h-6 w-6" /></div>
                          <div className="flex-1">
                              <p className="font-black text-sm uppercase tracking-widest leading-none mb-1">{t('wn_game_studio_title')}</p>
                              <p className="text-[10px] text-muted-foreground font-medium leading-tight">{t('wn_game_studio_desc')}</p>
                          </div>
                      </div>
                      <div className={cn("flex items-center gap-4 p-5 border rounded-3xl shadow-sm", glassEffect ? "glass-panel" : "bg-card")}>
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><LayoutGrid className="h-6 w-6" /></div>
                          <div className="flex-1">
                              <p className="font-black text-sm uppercase tracking-widest leading-none mb-1">{t('wn_supergroups_title')}</p>
                              <p className="text-[10px] text-muted-foreground font-medium leading-tight">{t('wn_supergroups_desc')}</p>
                          </div>
                      </div>
                  </div>
              </div>
          );
          case 'theme': return (<RadioGroup value={theme} onValueChange={v => setTheme(v as any)} className="p-4 space-y-1 animate-in fade-in slide-in-from-right-4 duration-300">{['orange', 'purple', 'blue', 'gray', 'green', 'red', 'yellow', 'pink', 'shining_gold'].map(tName => { const isPremTheme = tName === 'shining_gold'; return (<div key={tName} className={cn("flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors", glassEffect && "glass-panel border-none shadow-none")}><div className="flex items-center space-x-3"><RadioGroupItem value={tName} id={tName} disabled={isPremTheme && currentUser.subscriptionTier !== 'prem'} /><Label htmlFor={tName} className='capitalize cursor-pointer font-bold'>{t(tName as any)}</Label></div>{isPremTheme && <Badge className="bg-primary text-primary-foreground text-[9px]">PREM</Badge>}</div>); })}</RadioGroup>);
          case 'language': return (
            <div className="p-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <RadioGroup value={language} onValueChange={v => setLanguage(v as any)} className="space-y-1">
                    <div className={cn("flex items-center space-x-2 p-2 rounded-xl", glassEffect && "glass-panel border-none")}><RadioGroupItem value="en" id="en" /><Label htmlFor="en" className="font-bold">English</Label></div>
                    <div className={cn("flex items-center space-x-2 p-2 rounded-xl", glassEffect && "glass-panel border-none")}><RadioGroupItem value="ru" id="ru" /><Label htmlFor="ru" className="font-bold">Русский</Label></div>
                    <div className={cn("flex items-center space-x-2 p-2 rounded-xl", glassEffect && "glass-panel border-none")}><RadioGroupItem value="es" id="es" /><Label htmlFor="es" className="font-bold">Español</Label></div>
                    <div className={cn("flex items-center space-x-2 p-2 rounded-xl", glassEffect && "glass-panel border-none")}><RadioGroupItem value="pt-BR" id="pt-br" /><Label htmlFor="pt-BR" className="font-bold">Português (Brasil)</Label></div>
                </RadioGroup>
            </div>
          );
          case 'chat': return (<div className='p-2 space-y-1 divide-y animate-in fade-in slide-in-from-right-4 duration-300'><SettingsSwitchItem id="send-enter" label={t('send_on_enter_label')} checked={sendOnEnter} onCheckedChange={toggleSendOnEnter} description={t('send_on_enter_label')} glassEffect={glassEffect} /><SettingsSwitchItem id="smooth-scroll" label={t('smooth_scroll_label')} checked={smoothScroll} onCheckedChange={toggleSmoothScroll} description={t('smooth_scroll_desc')} glassEffect={glassEffect} /><SettingsSwitchItem id="min-call" label={t('minimize_call_on_close_label')} checked={minimizeCallOnClose} onCheckedChange={toggleMinimizeCallOnClose} description={t('minimize_call_on_close_label')} glassEffect={glassEffect} /></div>);
          case 'privacy': return (
            <div className='p-2 space-y-1 divide-y animate-in fade-in slide-in-from-right-4 duration-300'>
              <SettingsSwitchItem id="login-prot" label={t('login_protection_label')} checked={!!currentUser.loginProtectionEnabled} onCheckedChange={handleToggleLoginProtection} description={t('login_protection_desc')} glassEffect={glassEffect} />
              {currentUser.loginProtectionEnabled && (<SettingsItem icon={Lock} label={t('cloud_password_label')} onClick={() => {}} description={t('cloud_password_desc')} glassEffect={glassEffect} />)}
              <SettingsSwitchItem id="local-pin" label={t('local_pin_lock')} checked={pinLockEnabled} onCheckedChange={handleTogglePin} description={t('local_pin_lock_desc')} glassEffect={glassEffect} />
              <div className={cn("p-4 space-y-3 rounded-xl", glassEffect && "glass-panel border-none")}><Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{t('story_expiration_label')}</Label><Select value={(currentUser.storyExpirationDuration ?? 24).toString()} onValueChange={(v) => handleSetStoryExpiration(parseInt(v))}><SelectTrigger className={cn("h-12 rounded-xl border-none font-bold", glassEffect ? "glass-input" : "bg-muted/50")}><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="12">12 {t('hours')}</SelectItem><SelectItem value="24">24 {t('hours')}</SelectItem><SelectItem value="48">48 {t('hours')}</SelectItem><SelectItem value="72">72 {t('hours')}</SelectItem><SelectItem value="0">{t('story_expiration_never')}</SelectItem></SelectContent></Select></div>
            </div>
          );
          case 'dataStorage': return (<div className='p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300'><div className={cn('border rounded-3xl p-6 space-y-4 shadow-sm', glassEffect ? "glass-panel" : "bg-card")}><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center"><HardDrive className="h-6 w-6 text-orange-500" /></div><div><p className='text-xs font-black uppercase tracking-widest text-muted-foreground'>{t('cache_usage')}</p><p className='text-2xl font-black text-foreground'>{currentCacheSize}</p></div></div><p className="text-xs text-muted-foreground leading-relaxed">{t('clear_cache_desc')}</p><Button variant="outline" className={cn('w-full h-12 rounded-2xl font-bold border-orange-500/20 hover:bg-orange-500/5', glassEffect && "glass-button border-none")} onClick={handleClearCache}><Trash2 className="mr-2 h-4 w-4 text-orange-500" /> {t('clear_cache')}</Button></div></div>);
          case 'infGold': return (<div className='p-6 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300'><div className={cn("border border-amber-500/20 rounded-[2rem] p-8 text-center space-y-4", glassEffect ? "glass-panel" : "bg-amber-500/10")}><InfGoldIcon className='h-16 w-16 mx-auto experimental-glow text-amber-600' /><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700/60 mb-1">{t('inf_gold_balance')}</p><h2 className='text-5xl font-black text-amber-600'>{Math.round(currentUser.infGoldBalance || 0)}</h2></div></div><div className="p-2 gap-1 flex flex-col"><SettingsItem icon={Sparkles} label={t('daily_bonus')} onClick={() => navigateTo('dailyBonus')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-amber-500/15" iconColor="text-amber-600" glassEffect={glassEffect} /><SettingsItem icon={Gift} label="Отправить подарок себе" onClick={() => setShowSelfGiftPicker(true)} showExpColors={experimentalDesign || glassEffect} iconBg="bg-pink-500/15" iconColor="text-pink-600" glassEffect={glassEffect} /><SettingsItem icon={Star} label={t('infinite_prem')} onClick={() => navigateTo('infinitePrem')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-primary/15" iconColor="text-primary" glassEffect={glassEffect} /><SettingsItem icon={Clock} label={t('transfer_history')} onClick={() => navigateTo('transferHistory')} showExpColors={experimentalDesign || glassEffect} iconBg="bg-blue-500/15" iconColor="text-blue-500" glassEffect={glassEffect} /></div></div>);
          case 'infinitePrem': return (<div className='p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300'><div className={cn("rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden transition-colors", glassEffect ? "glass-panel border-none bg-primary/80 backdrop-blur-xl" : "bg-primary")}><div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 blur-3xl rounded-full" /><div className="relative z-10 space-y-4"><div className='flex items-center justify-between'><VerifiedBadge className="w-12 h-12" />{currentUser.subscriptionTier === 'prem' && <Badge variant="secondary" className="bg-white/20 text-white border-none font-black">ACTIVE</Badge>}</div><h2 className="text-3xl font-black font-headline leading-none">Infinite Prem</h2><p className="text-white/80 text-sm leading-relaxed">{t('prem_description')}</p><ul className="space-y-3 pt-2">{[1, 2, 3].map(i => (<li key={i} className="flex items-center gap-3 text-sm font-bold"><div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0"><Check className="w-3 h-3" /></div>{t(`prem_benefit_${i}` as any)}</li>))}</ul></div></div><div className="space-y-3"><Button onClick={() => handleBuyPrem(false)} disabled={isBuyingPrem || currentUser.subscriptionTier === 'prem'} className="w-full h-16 rounded-3xl font-black text-lg shadow-xl">{isBuyingPrem ? <Loader2 className='animate-spin' /> : (currentUser.subscriptionTier === 'prem' ? "Current Plan" : t('subscribe_monthly'))}</Button><Button onClick={() => handleBuyPrem(true)} variant="outline" disabled={isBuyingPrem || currentUser.subscriptionTier === 'prem'} className="w-full h-16 rounded-3xl font-black text-lg border-primary/20">{t('subscribe_yearly')}</Button><p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('yearly_discount_note')}</p></div></div>);
          case 'transferHistory': return (<div className='p-4 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300'><h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Последние операции</h3><div className="space-y-2">{[...(sentTransfers || []), ...(receivedTransfers || [])].sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()).map(item => { const isSent = item.senderId === userId; return (<div key={item.id} className={cn("border rounded-2xl p-4 flex items-center justify-between", glassEffect ? "glass-panel" : "bg-card")}><div className="flex items-center gap-3"><div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isSent ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500")}>{isSent ? <ArrowLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}</div><div><p className="font-bold text-sm leading-tight">{isSent ? item.receiverName : item.senderName}</p><p className="text-[10px] text-muted-foreground uppercase font-medium">{isSent ? 'Sent' : 'Received'}</p></div></div><div className="text-right"><p className={cn("font-black text-base", isSent ? "text-red-500" : "text-green-500")}>{isSent ? '-' : '+'}{item.amount} G</p><p className="text-[9px] text-muted-foreground">{format(item.timestamp.toMillis(), 'dd.MM, HH:mm')}</p></div></div>); })}{(!sentTransfers?.length && !receivedTransfers?.length) && (<div className="text-center py-20 opacity-30"><Coins className="h-12 w-12 mx-auto mb-2" /><p className="text-xs font-bold uppercase">{t('no_transfers')}</p></div>)}</div></div>);
          case 'dailyBonus': return <div className='p-6 animate-in fade-in slide-in-from-right-4 duration-300'><DailyBonusWheel onSpin={handleSpin} isSpinning={isSpinning} setSpinning={setSpinning} canSpin={isBonusAvailable} rotation={wheelRotation} /></div>;
          case 'help': return (<Accordion type="single" collapsible className="w-full animate-in fade-in slide-in-from-right-4 duration-300">{faqs.map((f, i) => (<AccordionItem value={`f-${i}`} key={i} className="px-4"><AccordionTrigger className="text-left font-bold">{f.question}</AccordionTrigger><AccordionContent><div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p>{processMarkdownChildren(children)}</p> }}>{f.answer}</ReactMarkdown></div></AccordionContent></AccordionItem>))}</Accordion>);
          case 'checkUpdates': return (<div className='p-12 flex flex-col items-center text-center gap-8 animate-in fade-in slide-in-from-right-4 duration-300'><div className={cn("w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center shadow-inner transition-transform duration-1000", isCheckingUpdates && "rotate-180")}>{isCheckingUpdates ? (<Loader2 className="h-10 w-10 text-primary animate-spin" />) : (<RefreshCcw className="h-10 w-10 text-primary" />)}</div><div className="space-y-4"><h2 className="text-2xl font-black font-headline">{isCheckingUpdates ? t('checking_updates_progress') : (hasCheckedUpdates ? (isUpdateAvailable ? t('update_available_title') : t('latest_version_installed')) : t('check_updates'))}</h2>{hasCheckedUpdates && (<p className="text-sm text-muted-foreground font-medium">{isUpdateAvailable ? t('update_available_status', { version: updateInfo?.latest }) : `${t('version')}: ${currentVersion}`}</p>)}</div>{!isCheckingUpdates && (<div className="w-full max-xs pt-4">{isUpdateAvailable && hasCheckedUpdates ? (<Button className="w-full h-14 rounded-2xl font-black text-lg shadow-xl" onClick={promptUpdate}><Download className="mr-2 h-5 w-5" /> {t('download')}</Button>) : (<Button variant="outline" className={cn("w-full h-14 rounded-2xl font-bold text-lg", glassEffect && "glass-button border-none")} onClick={handleManualCheckUpdates}>{t('check_updates')}</Button>)}</div>)}</div>);
          case 'account': return (<div className='p-6 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300'><Button variant="outline" className={cn('w-full h-14 rounded-2xl font-bold text-lg', glassEffect && "glass-button border-none")} onClick={() => { onOpenChange(false); setTimeout(() => setShowEditProfile(true), 150); }}><Pencil className="mr-3 h-5 w-5 text-primary" /> {t('edit_profile')}</Button><Button variant="destructive" className={cn('w-full h-14 rounded-2xl font-bold text-lg', glassEffect && "opacity-80")} onClick={handleLogout}><LogOut className="mr-3 h-5 w-5" /> {t('logout')}</Button><div className="pt-8 border-t"><Button variant="ghost" className="w-full h-12 rounded-xl text-destructive hover:bg-destructive/10 font-bold" onClick={() => setShowDeleteConfirm(true)}><Trash2 className="mr-3 h-4 w-4" /> {t('delete_account')}</Button></div></div>);
          case 'about': return (
              <div className='p-12 flex flex-col items-center text-center gap-6 animate-in fade-in slide-in-from-right-4 duration-300'>
                <div className={cn("w-32 h-32 bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 rounded-[2.5rem] experimental-glow")}><InfiniteLogo className='w-20 h-20 text-white' /></div>
                <div className="space-y-2">
                    <h2 className='text-4xl font-black font-headline'>Infinite</h2>
                    <Badge className="bg-primary text-white h-6 px-3 rounded-full text-xs font-black">{currentVersion}</Badge>
                </div>
                <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20 text-[10px] font-black text-primary leading-relaxed uppercase tracking-widest">Official Release</div>
                <div className="flex flex-col gap-2 w-full pt-4">
                    <button onClick={() => setShowLegalType('tos')} className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 rounded-2xl transition-all group"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><FileText className="h-4 w-4" /></div><span className="text-xs font-bold">{t('terms_of_service')}</span></div><ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /></button>
                    <button onClick={() => setShowLegalType('privacy')} className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 rounded-2xl transition-all group"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><ShieldCheck className="h-4 w-4" /></div><span className="text-xs font-bold">{t('privacy_policy')}</span></div><ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /></button>
                </div>
                <p className='text-xs text-muted-foreground leading-relaxed max-w-xs font-medium opacity-60'>{t('version_info_detail')}</p>
              </div>
          );
          default: return null;
      }
  };
  const handleResetState = () => { setPageHistory(['main']); setAnimationDirection('forward'); setHasCheckedUpdates(false); };
  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setTimeout(() => handleResetState(), 200); }}>
      <DialogContent hideCloseButton className={cn("max-w-md w-full h-[85svh] h-full-safe flex flex-col p-0 gap-0 overflow-hidden outline-none bg-card", (experimentalDesign || glassEffect) && "rounded-[2.5rem] border-none shadow-2xl")}>
        <DialogHeader className="relative flex-row items-center justify-center p-4 shrink-0 h-16 z-20 transition-all bg-card border-b"><Button variant="ghost" size="icon" onClick={handleBack} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button><DialogTitle className="text-lg font-black font-headline tracking-tight">{t(page as any) || t('settings')}</DialogTitle><Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2"><X /></Button></DialogHeader>
        <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-x-hidden"><div key={page} className={cn("animate-in fade-in-0 duration-300", animationDirection === 'forward' ? 'slide-in-from-right-5' : 'slide-in-from-left-5')}>{renderPage()}</div></ScrollArea>
      </DialogContent>
    </Dialog>
    <EditProfileDialog user={currentUser} open={showEditProfile} onOpenChange={setShowEditProfile} />
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}><AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl"><AlertDialogHeader className="items-center text-center space-y-4"><div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center"><Trash2 className="h-8 w-8 text-destructive" /></div><div className="space-y-2"><AlertDialogTitle className="text-2xl font-bold font-headline">{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription className="text-muted-foreground leading-relaxed">{t('delete_account_confirm_desc')}</AlertDialogDescription></div></AlertDialogHeader><AlertDialogFooter className="flex flex-col gap-2 pt-4 sm:flex-col sm:justify-center"><AlertDialogAction onClick={handleDeleteAccount} disabled={isDeletingAccount} className={cn(buttonVariants({ variant: 'destructive' }), "w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-destructive/20")}>{isDeletingAccount ? <Loader2 className="animate-spin" /> : t('delete_account')}</AlertDialogAction><AlertDialogCancel className="w-full h-12 rounded-2xl font-medium border-none hover:bg-muted">{t('cancel')}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <GiftPickerDialog open={showSelfGiftPicker} onOpenChange={setShowSelfGiftPicker} recipient={currentUser as any} currentUser={currentUser} />
    <LegalDialog open={!!showLegalType} onOpenChange={(open) => !open && setShowLegalType(null)} type={showLegalType || 'tos'} />
    
    <Dialog open={showPinSetup} onOpenChange={setShowPinSetup}>
        <DialogContent className="max-w-xs rounded-3xl p-8 border-none shadow-2xl space-y-6">
            <DialogHeader className="items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                    <KeyRound className="h-8 w-8 text-primary" />
                </div>
                <DialogTitle className="text-xl font-bold font-headline">
                    {pinStep === 'new' ? t('set_pin') : t('disable_pin')}
                </DialogTitle>
                <DialogDescription>
                    {pinStep === 'new' ? t('enter_new_pin') : t('enter_current_pin')}
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <Input 
                    type="password"
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    placeholder="••••"
                    className="text-center text-2xl font-black h-14 rounded-2xl bg-muted/50 border-none"
                    maxLength={16}
                    autoFocus
                />
                <Button className="w-full h-12 rounded-xl font-bold" onClick={handlePinSubmit} disabled={pinInput.length < 4}>
                    {t('ok')}
                </Button>
                <Button variant="ghost" className="w-full rounded-xl" onClick={() => setShowPinSetup(false)}>
                    {t('cancel')}
                </Button>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
