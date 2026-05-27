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
import { Alert, AlertDescription, AlertTitle } from '@/components/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import { ArrowLeft, ChevronRight, LogOut, Trash2, Paintbrush, Languages, HelpCircle, Info, Shield, User, Star, MessageSquare, Crown, Gift, Loader2, Bell, Phone, Pencil, HardDrive, ShoppingBag, Sparkles, ShieldCheck, Lock, Copy, CheckCircle2, Download, FileCheck, Timer, Gamepad2, X, History, TrendingUp, TrendingDown, BookOpen, Cpu, Check, MousePointer2, Image as ImageIcon, Globe, Type } from 'lucide-react';
import type { AuthenticatedUser, Transfer } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { doc, runTransaction, setDoc, serverTimestamp, updateDoc, increment, getDoc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

import { UserProfileCard } from './user-profile-card';
import { useLanguage } from '@/context/language-context';
import { useTheme, type Theme } from '@/context/theme-context';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EditProfileDialog } from './edit-profile-dialog';
import { InfGoldIcon } from './ui/inf-gold-icon';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { DailyBonusWheel, PRIZES_WITH_ANGLES } from './daily-bonus-wheel';
import { UserAvatarWithStatus } from './chat/user-avatar-with-status';
import { VerifiedBadge } from './ui/verified-badge';
import { useUpdatePrompt } from '@/context/update-prompt-context';
import { clearCacheDB, calculateCacheSize as getRealCacheSize } from '@/lib/cache-utils';
import { format } from 'date-fns';

type SettingsPage = 'main' | 'appearance' | 'theme' | 'language' | 'account' | 'help' | 'about' | 'chat' | 'infGold' | 'prem' | 'dailyBonus' | 'whatsNew' | 'dataStorage' | 'privacy' | 'transferHistory' | 'botGuide';

const SETTINGS_KEYS = ['app-color-theme', 'app-theme-mode', 'app-snowflakes-mode', 'app-send-on-enter', 'app-smooth-scroll', 'app-minimize-call', 'app-experimental-design', 'app-lang', 'app-glass-effect', 'app-show-feed', 'app-use-system-font'];

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
            <ChevronRight className="h-5 w-5 shrink-0" />
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
  
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, isDarkMode, toggleTheme, showSnowflakes, toggleSnowflakes, sendOnEnter, toggleSendOnEnter, smoothScroll, toggleSmoothScroll, minimizeCallOnClose, toggleMinimizeCallOnClose, experimentalDesign, toggleExperimentalDesign, glassEffect, toggleGlassEffect, showFeed, toggleShowFeed, useSystemFont, toggleSystemFont } = useTheme();
  const { isUpdateAvailable, promptUpdate } = useUpdatePrompt();
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentCacheSize, setCurrentCacheSize] = useState('0 B');
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [cloudPassword, setCloudPassword] = useState('');
  const [recoveryCodeToShow, setRecoveryCodeToShow] = useState<string | null>(null);
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [showCloudPasswordDialog, setShowCloudPasswordDialog] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [isUpdatingPrem, setIsUpdatingPrem] = useState(false);
  
  const [androidVersion, setAndroidVersion] = useState<number | null>(null);
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent;
        const match = ua.match(/Android\s([0-9\.]+)/);
        if (match) {
            setAndroidVersion(parseFloat(match[1]));
        }
    }
  }, []);

  const isExperimentalRestricted = androidVersion !== null && androidVersion < 9;

  const isBonusAvailable = !currentUser.lastDailyBonusClaimed || (Date.now() - currentUser.lastDailyBonusClaimed.toMillis()) > 24 * 60 * 60 * 1000;

  const transfersQuery = useMemo(() => {
    if (!db || !currentUser.uid || page !== 'transferHistory') return null;
    return query(
        collection(db, 'transfers'),
        where('senderId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(20)
    );
  }, [db, currentUser.uid, page]);

  const receivedQuery = useMemo(() => {
    if (!db || !currentUser.uid || page !== 'transferHistory') return null;
    return query(
        collection(db, 'transfers'),
        where('receiverId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(20)
    );
  }, [db, currentUser.uid, page]);

  const { data: sentTransfers, loading: loadingSent } = useCollection<Transfer>(transfersQuery);
  const { data: receivedTransfers, loading: loadingReceived } = useCollection<Transfer>(receivedQuery);

  const combinedTransfers = useMemo(() => {
    if (!sentTransfers && !receivedTransfers) return [];
    return [...(sentTransfers || []), ...(receivedTransfers || [])]
        .sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0))
        .slice(0, 30);
  }, [sentTransfers, receivedTransfers]);

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

  useEffect(() => {
    if (open) {
        calculateCacheSize();
    }
  }, [open, page]);

  useEffect(() => {
    if (page === 'privacy' && db && currentUser.uid) {
        const checkSecurity = async () => {
            const securityRef = doc(db, 'users', currentUser.uid, 'private', 'security');
            const snap = await getDoc(securityRef);
            setIsPasswordSet(snap.exists() && !!snap.data().cloudPassword);
        };
        checkSecurity();
    }
  }, [page, db, currentUser.uid]);


  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = 0;
    }
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
        await setDoc(userRef, {
            status: 'offline',
            lastSeen: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error("Failed to update status on logout:", error);
      }
      auth.signOut();
    } else if (auth) {
        auth.signOut();
    }
  };
  
  const handleDeleteAccount = async () => {
    if (!auth || !db || !currentUser?.username) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete account. User data is missing.' });
        return;
    }
    setIsDeleting(true);
    sessionStorage.setItem('isDeletingAccount', 'true');
    const userToDelete = auth.currentUser;
    if (!userToDelete) {
        setIsDeleting(false);
        sessionStorage.removeItem('isDeletingAccount');
        return;
    }
    const usernameToDelete = currentUser.username;
    try {
        await runTransaction(db, async (transaction) => {
            const userDocRef = doc(db, 'users', userToDelete.uid);
            const usernameDocRef = doc(db, 'usernames', usernameToDelete);
            const usernameDoc = await transaction.get(usernameDocRef);
            transaction.update(userDocRef, { name: 'Deleted Account', username: `@deleted_${userToDelete.uid}`, avatar: '', status: 'offline', statusMessage: '', isDeleted: true, });
            if (usernameDoc.exists()) transaction.delete(usernameDocRef);
        });
        await deleteUser(userToDelete);
        router.push('/goodbye');
    } catch (error: any) {
        console.error("Error deleting account:", error);
        toast({ variant: 'destructive', title: t('delete_account_error'), description: error.message || t('unexpected_error') });
        setIsDeleting(false);
        sessionStorage.removeItem('isDeletingAccount');
    }
  };

  const handleToggleLoginProtection = async (enabled: boolean) => {
    if (!db || !currentUser.uid) return;
    setIsUpdatingPrivacy(true);
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { loginProtectionEnabled: enabled });
        toast({ title: t('dm_success'), description: t('profile_update_success') });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update privacy settings.' });
    } finally {
        setIsUpdatingPrivacy(false);
    }
  };

  const handleTogglePremBadge = async (enabled: boolean) => {
    if (!db || !currentUser.uid) return;
    setIsUpdatingPrem(true);
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { showPremBadge: enabled });
        toast({ title: t('dm_success'), description: t('profile_update_success') });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update badge settings.' });
    } finally {
        setIsUpdatingPrem(false);
    }
  }

  const handleUpdateStoryExpiration = async (duration: string) => {
    if (!db || !currentUser.uid) return;
    setIsUpdatingPrivacy(true);
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { storyExpirationDuration: parseInt(duration) });
        toast({ title: t('dm_success'), description: t('profile_update_success') });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update story settings.' });
    } finally {
        setIsUpdatingPrivacy(false);
    }
  };

  const handleSaveCloudPassword = async () => {
    if (!db || !currentUser.uid || !cloudPassword.trim()) return;
    setIsUpdatingPrivacy(true);
    try {
        const recoveryCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const securityRef = doc(db, 'users', currentUser.uid, 'private', 'security');
        await setDoc(securityRef, { cloudPassword: cloudPassword.trim(), recoveryCode: recoveryCode }, { merge: true });
        setIsPasswordSet(true);
        setRecoveryCodeToShow(recoveryCode);
        toast({ title: t('dm_success'), description: t('profile_update_success') });
        setCloudPassword('');
        setShowCloudPasswordDialog(false);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save password.' });
    } finally {
        setIsUpdatingPrivacy(false);
    }
  };

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
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { infGoldBalance: increment(winningPrize.value), lastDailyBonusClaimed: serverTimestamp(), });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to claim bonus.'});
        }
    }, 5000);
};

  const handleClearCache = async () => {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !SETTINGS_KEYS.includes(key)) keysToRemove.push(key);
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        await clearCacheDB();
        toast({ title: t('dm_success'), description: t('cache_cleared_success') });
        await calculateCacheSize();
    } catch (e) { console.error("Clear cache failed", e); }
  };

  const handlePurchasePrem = async () => {
    if (!db || !currentUser.uid) return;
    const price = 500;
    if ((currentUser.infGoldBalance || 0) < price) { toast({ variant: 'destructive', title: t('not_enough_gold') }); return; }
    setIsProcessingPurchase(true);
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { infGoldBalance: increment(-price), subscriptionTier: 'prem' });
        toast({ title: t('subscription_successful_title'), description: t('subscription_successful_desc') });
        navigateTo('main');
    } catch (e) { console.error(e); toast({ variant: 'destructive', title: 'Error', description: t('subscription_failed') }); }
    finally { setIsProcessingPurchase(false); }
  };

  const faqs = [
    { question: t('faq_markdown_q'), answer: t('faq_markdown_a') },
    { question: t('faq_bot_prog_q'), answer: `${t('faq_bot_prog_a')}\n\n[BOT_GUIDE_BUTTON]` },
    { question: t('faq_create_chat_q'), answer: t('faq_create_chat_a') },
    { question: t('faq_invite_q'), answer: t('faq_invite_a') },
    { question: t('faq_edit_profile_q'), answer: t('faq_edit_profile_a') },
    { question: t('faq_calls_q'), answer: t('faq_calls_a') },
    { question: t('faq_media_q'), answer: t('faq_media_a') },
    { question: t('faq_infgold_q'), answer: t('faq_infgold_a') },
    { question: t('faq_prem_q'), answer: t('faq_prem_a') },
    { question: t('faq_bot_q'), answer: t('faq_bot_a') },
    { question: t('faq_security_q'), answer: t('faq_security_a') },
    { question: t('faq_poll_q'), answer: t('faq_poll_a') },
    { question: t('faq_story_q'), answer: t('faq_story_a') },
    { question: t('faq_transfer_q'), answer: t('faq_transfer_a') },
    { question: t('faq_feed_q'), answer: t('faq_feed_a') },
    { question: t('faq_mention_all_q'), answer: t('faq_mention_all_a') },
  ];

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
          {currentUser.isAdmin && (<SettingsItem icon={Shield} label={t('admin_panel_title')} onClick={() => router.push('/admin')} showExpColors={experimentalDesign} iconBg="bg-indigo-500/15" iconColor="text-indigo-500" />)}
          {isUpdateAvailable && (<SettingsItem icon={Download} label={t('update_infinite')} description={t('update_available_title')} onClick={promptUpdate} showExpColors={true} iconBg="bg-orange-500/15" iconColor="text-orange-600" isGlow={true} />)}
        </div>
      </>
  );

  const appearancePageContent = (
      <div className='divide-y'>
        <SettingsSwitchItem id="dark-mode-switch" label={t('dark_mode')} checked={isDarkMode} onCheckedChange={toggleTheme} />
        <SettingsItem icon={Paintbrush} label={t('color_theme')} value={t(theme === 'frutiger' ? 'frutiger_aero' : (theme as any))} onClick={() => navigateTo('theme')} />
        <SettingsSwitchItem id="system-font-switch" label={t('use_system_font_label')} checked={useSystemFont} onCheckedChange={toggleSystemFont} description={t('use_system_font_desc')} />
        <SettingsSwitchItem id="glass-effect-switch" label={t('glass_effect_label')} checked={glassEffect} onCheckedChange={toggleGlassEffect} description={t('glass_effect_desc')} />
        <SettingsSwitchItem id="snow-switch" label={t('snowflakes')} checked={showSnowflakes} onCheckedChange={toggleSnowflakes} />
        <SettingsSwitchItem id="exp-design-switch" label={`${t('experimental_design_label')} (${t('android_9_plus_only')})`} checked={experimentalDesign} onCheckedChange={toggleExperimentalDesign} description={isExperimentalRestricted ? 'Restricted for your Android version.' : t('experimental_design_desc')} disabled={isExperimentalRestricted} />
        <SettingsSwitchItem id="show-feed-switch" label={t('show_feed_label')} checked={showFeed} onCheckedChange={toggleShowFeed} description={t('show_feed_desc')} />
      </div>
  );
  
  const currentTierLevel = currentUser.subscriptionTier ? ['none', 'super', 'mega', 'prem', 'giga', 'ultra'].indexOf(currentUser.subscriptionTier) : 0;
  const hasPremAccess = currentTierLevel >= 3;
  const allThemes: Theme[] = ['orange', 'purple', 'blue', 'gray', 'green', 'red', 'yellow', 'pink', 'frutiger', 'shining_gold'];
  
  const themePageContent = (
    <RadioGroup value={theme} onValueChange={(v) => setTheme(v as any)} className="p-4 space-y-1">
        {allThemes.map(themeName => {
            const isDisabled = themeName === 'shining_gold' && !hasPremAccess;
            if (isDisabled && theme !== themeName) return null;
            return (<div key={themeName} className={cn("flex items-center space-x-2", isDisabled && "opacity-50")}><RadioGroupItem value={themeName} id={`theme-${themeName}`} disabled={isDisabled} /><Label htmlFor={`theme-${themeName}`} className={cn('capitalize', !isDisabled && 'cursor-pointer')}>{t(themeName === 'frutiger' ? 'frutiger_aero' : (themeName as any))}{themeName === 'shining_gold' && <Crown className="inline-block ml-2 h-4 w-4 text-amber-500" />}</Label></div>);
        })}
    </RadioGroup>
  );

  const whatsNewPageContent = (
    <div className='p-6 space-y-6'>
      <div className="text-center"><h2 className="text-2xl font-bold font-headline">{t('whats_new_title', { version: t('beta_badge') })}</h2><p className="text-muted-foreground">{t('whats_new_desc')}</p></div>
      <div className="space-y-4 text-sm">
        <div className="p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all"><h3 className="font-bold text-base mb-1 flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /> {t('whats_new_legacy_title')}</h3><p className="text-muted-foreground leading-relaxed">{t('whats_new_legacy_desc')}</p></div>
        <div className="p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all"><h3 className="font-bold text-base mb-1 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {t('whats_new_ui_title')}</h3><p className="text-muted-foreground leading-relaxed">{t('whats_new_ui_desc')}</p></div>
        <div className="p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all"><h3 className="font-bold text-base mb-1 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> {t('whats_new_optimization_title')}</h3><p className="text-muted-foreground leading-relaxed">{t('whats_new_optimization_desc')}</p></div>
        <div className="p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all"><h3 className="font-bold text-base mb-1 flex items-center gap-2"><Type className="h-4 w-4 text-primary" /> {t('whats_new_font_title')}</h3><p className="text-muted-foreground leading-relaxed">{t('whats_new_font_desc')}</p></div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (page) {
      case 'main': return mainPageContent;
      case 'appearance': return appearancePageContent;
      case 'theme': return themePageContent;
      case 'language': return <div className="p-4"><RadioGroup value={language} onValueChange={(v) => setLanguage(v as 'en' | 'ru')} className="space-y-1"><div className="flex items-center space-x-2"><RadioGroupItem value="en" id="lang-en" /><Label htmlFor="lang-en">English</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="ru" id="lang-ru" /><Label htmlFor="lang-ru">Русский</Label></div></RadioGroup></div>;
      case 'chat': return <div className='divide-y'><SettingsSwitchItem id="send-on-enter-switch" label={t('send_on_enter_label')} checked={sendOnEnter} onCheckedChange={toggleSendOnEnter} /><SettingsSwitchItem id="smooth-scroll-switch" label={t('smooth_scroll_label')} checked={smoothScroll} onCheckedChange={toggleSmoothScroll} description={t('smooth_scroll_desc')} /><SettingsSwitchItem id="minimize-call-switch" label={t('minimize_call_on_close_label')} checked={minimizeCallOnClose} onCheckedChange={toggleMinimizeCallOnClose} /></div>;
      case 'privacy': return privacyPageContent;
      case 'dataStorage': return dataStoragePageContent;
      case 'infGold': return infGoldPageContent;
      case 'dailyBonus': return dailyBonusPageContent;
      case 'transferHistory': return transferHistoryPageContent;
      case 'prem': return premPageContent;
      case 'whatsNew': return whatsNewPageContent;
      case 'account': return accountPageContent;
      case 'help': return helpPageContent;
      case 'about': return aboutPageContent;
      case 'botGuide': return botGuidePageContent;
      default: return null;
    }
  };

  const getTitle = () => {
    switch (page) {
      case 'main': return t('settings');
      case 'appearance': return t('appearance');
      case 'theme': return t('color_theme');
      case 'language': return t('language');
      case 'chat': return t('chat_settings');
      case 'account': return t('profile');
      case 'help': return t('help');
      case 'about': return t('version');
      case 'infGold': return 'InfGold';
      case 'prem': return t('infinite_prem');
      case 'dailyBonus': return t('daily_bonus');
      case 'whatsNew': return t('whats_new');
      case 'dataStorage': return t('data_storage');
      case 'privacy': return t('privacy_security');
      case 'transferHistory': return t('transfer_history');
      case 'botGuide': return t('bot_guide_title');
      default: return t('settings');
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setTimeout(() => resetState(), 200); }}>
      <DialogContent hideCloseButton className={cn("max-w-md w-full h-[85svh] h-full-safe flex flex-col p-0 gap-0 overflow-hidden outline-none bg-card", experimentalDesign && "rounded-[2.5rem] border-none shadow-2xl")}>
        <DialogHeader className="relative flex-row items-center justify-center p-4 shrink-0 h-16 z-20 transition-all bg-card border-b">
          <Button variant="ghost" size="icon" onClick={handleBack} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button>
          <DialogTitle className="text-lg">{getTitle()}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2"><X /></Button>
        </DialogHeader>
        <ScrollArea ref={scrollAreaRef} className="flex-1"><div key={page} className={cn("animate-in fade-in-0 duration-300", animationDirection === 'forward' ? 'slide-in-from-right-5' : 'slide-in-from-left-5')}>{renderContent()}</div></ScrollArea>
      </DialogContent>
    </Dialog>
    <EditProfileDialog user={currentUser} open={showEditProfile} onOpenChange={setShowEditProfile} />
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle>{t('delete_account_confirm_title')}</AlertDialogTitle><AlertDialogDescription>{t('delete_account_confirm_desc')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="flex-col gap-2"><AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting} className={cn(buttonVariants({ variant: "destructive" }), "rounded-xl")}>{isDeleting ? t('deleting_account') : t('delete_account')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    </>
  );
}