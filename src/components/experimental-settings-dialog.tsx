
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTitle as AlertDialogTitleComponent,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

import { ArrowLeft, ChevronRight, LogOut, Trash2, Paintbrush, Languages, HelpCircle, Info, Shield, User, Star, MessageSquare, Crown, Gift, Loader2, Bell, Phone, Pencil, HardDrive, ShoppingBag } from 'lucide-react';
import type { AuthenticatedUser } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth, useFirestore } from '@/firebase';
import { doc, runTransaction, setDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';

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

type SettingsPage = 'main' | 'appearance' | 'theme' | 'language' | 'account' | 'help' | 'about' | 'chat' | 'infGold' | 'prem' | 'dailyBonus' | 'whatsNew' | 'dataStorage';

const SETTINGS_KEYS = ['app-color-theme', 'app-theme-mode', 'app-snowflakes-mode', 'app-send-on-enter', 'app-minimize-call', 'app-experimental-design', 'app-lang'];

const SettingsItem = ({ icon: Icon, label, value, onClick, disabled = false, description, iconBg = "bg-primary/10", iconColor = "text-primary", showExpColors = false, isGlow = false }: { icon: React.ElementType, label: string, value?: string, onClick: () => void, disabled?: boolean, description?: string, iconBg?: string, iconColor?: string, showExpColors?: boolean, isGlow?: boolean }) => (
    <button onClick={onClick} className="flex items-center w-full p-4 text-left rounded-lg hover:bg-muted disabled:opacity-50 disabled:pointer-events-none group" disabled={disabled}>
        <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-4 transition-colors",
            showExpColors ? iconBg : "bg-primary/10 group-hover:bg-primary/20",
            isGlow && "experimental-glow"
        )}>
            <Icon className={cn("h-5 w-5", showExpColors ? iconColor : "text-primary")} />
        </div>
        <div className="flex-1 flex flex-col justify-center min-w-0 overflow-hidden mr-2">
            <span className="font-medium truncate">{label}</span>
            {description && <span className="text-xs text-muted-foreground truncate">{description}</span>}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
            {value && <span className='capitalize text-sm max-w-[80px] truncate'>{value}</span>}
            <ChevronRight className="h-5 w-5 shrink-0" />
        </div>
  </button>
);


const SettingsSwitchItem = ({ label, checked, onCheckedChange, id, description }: { label: string, checked: boolean, onCheckedChange: (checked: boolean) => void, id: string, description?: string }) => (
    <div className="flex items-start justify-between w-full p-4">
        <div className="flex flex-col flex-1 mr-4 min-w-0">
            <Label htmlFor={id} className="font-medium cursor-pointer truncate mb-0.5">{label}</Label>
            {description && <span className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{description}</span>}
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="shrink-0 mt-1" />
    </div>
);


export function ExperimentalSettingsDialog({ open, onOpenChange, currentUser }: { open: boolean, onOpenChange: (open: boolean) => void, currentUser: AuthenticatedUser }) {
  const [pageHistory, setPageHistory] = useState<SettingsPage[]>(['main']);
  const [animationDirection, setAnimationDirection] = useState<'forward' | 'backward'>('forward');
  const page = pageHistory[pageHistory.length - 1];
  
  const [showEditProfile, setShowEditProfile] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, isDarkMode, toggleTheme, showSnowflakes, toggleSnowflakes, sendOnEnter, toggleSendOnEnter, minimizeCallOnClose, toggleMinimizeCallOnClose, experimentalDesign, toggleExperimentalDesign } = useTheme();
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentCacheSize, setCurrentCacheSize] = useState('0 B');
  
  // Daily Bonus State
  const [isSpinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const isBonusAvailable = !currentUser.lastDailyBonusClaimed || (Date.now() - currentUser.lastDailyBonusClaimed.toMillis()) > 24 * 60 * 60 * 1000;

  const calculateCacheSize = () => {
    if (typeof window === 'undefined') return '0 B';
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !SETTINGS_KEYS.includes(key)) {
        total += (localStorage.getItem(key) || '').length * 2;
      }
    }
    if (total === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(total) / Math.log(k));
    return parseFloat((total / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (open) {
        setCurrentCacheSize(calculateCacheSize());
    }
  }, [open, page]);


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
    }
  };

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

            transaction.update(userDocRef, {
                name: 'Deleted Account',
                username: `@deleted_${userToDelete.uid}`,
                avatar: '',
                status: 'offline',
                statusMessage: '',
                isDeleted: true,
            });

            if (usernameDoc.exists()) {
                transaction.delete(usernameDocRef);
            }
        });

        await deleteUser(userToDelete);
        
        router.push('/goodbye');

    } catch (error: any) {
        console.error("Error deleting account:", error);
        toast({
            variant: 'destructive',
            title: t('delete_account_error'),
            description: error.message || t('unexpected_error')
        });
        setIsDeleting(false);
        sessionStorage.removeItem('isDeletingAccount');
    }
  };

  const handleSpin = async (): Promise<void> => {
    const totalWeight = PRIZES_WITH_ANGLES.reduce((sum, p) => sum + p.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    const winningPrize = PRIZES_WITH_ANGLES.find(p => {
        randomWeight -= p.weight;
        return randomWeight <= 0;
    })!;
    
    const baseRotation = 360 * 5; 
    const prizeAngle = winningPrize.startAngle + winningPrize.angle / 2;
    const randomOffset = (Math.random() - 0.5) * (winningPrize.angle * 0.8);
    
    setWheelRotation(prev => (prev - (prev % 360)) + baseRotation - prizeAngle - randomOffset);

    setTimeout(async () => {
        toast({
            title: t('you_won'),
            description: `${winningPrize.value} InfGold!`,
        });
        setSpinning(false);
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                infGoldBalance: increment(winningPrize.value),
                lastDailyBonusClaimed: serverTimestamp(),
            });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to claim bonus.'});
        }
    }, 5000);
};

  const handleClearCache = () => {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !SETTINGS_KEYS.includes(key)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        toast({ title: t('dm_success'), description: t('cache_cleared_success') });
        setCurrentCacheSize(calculateCacheSize());
    } catch (e) {
        console.error("Clear cache failed", e);
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
      default: return t('settings');
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
    { question: t('faq_bot_q'), answer: t('faq_bot_a') },
    { question: t('faq_security_q'), answer: t('faq_security_a') },
  ];

  const ExperimentalProfileHeader = () => (
    <div className="flex flex-col items-center pt-6 pb-8 px-6 bg-gradient-to-b from-primary/15 to-transparent">
        <UserAvatarWithStatus user={currentUser as any} className="w-28 h-28 text-4xl mb-6 border-4 border-background shadow-2xl rounded-full experimental-glow" />
        <div className="text-center space-y-1.5">
            <h2 className="text-3xl font-bold font-headline flex items-center justify-center gap-2">
                {currentUser.name}
                {currentUser.isAdmin && <VerifiedBadge />}
            </h2>
            <p className="text-muted-foreground font-medium">{currentUser.username}</p>
        </div>
    </div>
  );

  const mainPageContent = (
      <>
        {experimentalDesign ? <ExperimentalProfileHeader /> : (
            <div className="p-0 overflow-hidden">
                <UserProfileCard 
                    user={currentUser} 
                    onEditProfile={() => {
                        onOpenChange(false);
                        setTimeout(() => setShowEditProfile(true), 150);
                    }} 
                />
            </div>
        )}
        <div className={cn("border-t", experimentalDesign && "mt-2")}>
          <SettingsItem 
            icon={Paintbrush} 
            label={t('appearance')} 
            description={t('appearance')} 
            value={t(theme === 'frutiger' ? 'frutiger_aero' : (theme as any))} 
            onClick={() => navigateTo('appearance')}
            showExpColors={experimentalDesign}
            iconBg="bg-blue-500/15"
            iconColor="text-blue-500"
          />
          <SettingsItem 
            icon={MessageSquare} 
            label={t('chat_settings')} 
            description={t('chat_settings')} 
            onClick={() => navigateTo('chat')} 
            showExpColors={experimentalDesign}
            iconBg="bg-green-500/15"
            iconColor="text-green-500"
          />
          <SettingsItem 
            icon={HardDrive} 
            label={t('data_storage')} 
            description={t('data_storage')} 
            onClick={() => navigateTo('dataStorage')} 
            showExpColors={experimentalDesign}
            iconBg="bg-orange-500/15"
            iconColor="text-orange-500"
          />
          <SettingsItem 
            icon={Languages} 
            label={t('language')} 
            description={t('language')} 
            value={language.toUpperCase()} 
            onClick={() => navigateTo('language')} 
            showExpColors={experimentalDesign}
            iconBg="bg-purple-500/15"
            iconColor="text-purple-500"
          />
          <SettingsItem 
            icon={InfGoldIcon} 
            label="InfGold" 
            description={t('inf_gold_balance')} 
            onClick={() => navigateTo('infGold')} 
            showExpColors={experimentalDesign}
            iconBg="bg-amber-500/15"
            iconColor="text-amber-600"
            isGlow={experimentalDesign}
          />
          <SettingsItem 
            icon={User} 
            label={t('profile')} 
            description={t('view_profile')} 
            onClick={() => navigateTo('account')} 
            showExpColors={experimentalDesign}
            iconBg="bg-teal-500/15"
            iconColor="text-teal-500"
          />
          <SettingsItem 
            icon={Star} 
            label={t('whats_new')} 
            description={t('whats_new_desc')} 
            onClick={() => navigateTo('whatsNew')} 
            showExpColors={experimentalDesign}
            iconBg="bg-yellow-500/15"
            iconColor="text-yellow-600"
          />
          <SettingsItem 
            icon={HelpCircle} 
            label={t('help')} 
            description={t('faq_desc')} 
            onClick={() => navigateTo('help')} 
            showExpColors={experimentalDesign}
            iconBg="bg-rose-500/15"
            iconColor="text-rose-500"
          />
          <SettingsItem 
            icon={Info} 
            label={t('version')} 
            description={t('version_info')} 
            value="0.3" 
            onClick={() => navigateTo('about')} 
            showExpColors={experimentalDesign}
            iconBg="bg-gray-500/15"
            iconColor="text-gray-500"
          />
          {currentUser.isAdmin && (
              <SettingsItem 
                icon={Shield} 
                label={t('admin_panel_title')} 
                description={t('admin_panel_title')} 
                onClick={() => router.push('/admin')} 
                showExpColors={experimentalDesign}
                iconBg="bg-indigo-500/15"
                iconColor="text-indigo-500"
              />
          )}
        </div>
      </>
  );

  const appearancePageContent = (
      <>
        <SettingsSwitchItem id="dark-mode-switch" label={t('dark_mode')} checked={isDarkMode} onCheckedChange={toggleTheme} />
        <SettingsItem icon={Paintbrush} label={t('color_theme')} value={t(theme === 'frutiger' ? 'frutiger_aero' : (theme as any))} onClick={() => navigateTo('theme')} />
        <SettingsSwitchItem id="snow-switch" label={t('snowflakes')} checked={showSnowflakes} onCheckedChange={toggleSnowflakes} />
        <SettingsSwitchItem 
            id="exp-design-switch" 
            label={t('experimental_design_label')} 
            checked={experimentalDesign} 
            onCheckedChange={toggleExperimentalDesign} 
            description={t('experimental_design_desc')} 
        />
      </>
  );
  
  const currentTierLevel = currentUser.subscriptionTier ? ['none', 'super', 'mega', 'prem', 'giga', 'ultra'].indexOf(currentUser.subscriptionTier) : 0;
  const premTierLevel = 3;
  const hasPremAccess = currentTierLevel >= premTierLevel;
  const allThemes: Theme[] = ['orange', 'purple', 'blue', 'gray', 'green', 'red', 'yellow', 'pink', 'frutiger', 'shining_gold'];
  
  const themePageContent = (
    <RadioGroup value={theme} onValueChange={(v) => setTheme(v as any)} className="p-4 space-y-1">
        {allThemes.map(themeName => {
            const isPremium = themeName === 'shining_gold';
            const isDisabled = isPremium && !hasPremAccess;

            if (isDisabled && theme !== themeName) {
                return null;
            }
            
            return (
                <div key={themeName} className={cn("flex items-center space-x-2", isDisabled && "opacity-50")}>
                    <RadioGroupItem value={themeName} id={`theme-${themeName}`} disabled={isDisabled} />
                    <Label htmlFor={`theme-${themeName}`} className={cn('capitalize', !isDisabled && 'cursor-pointer')}>
                        {t(themeName === 'frutiger' ? 'frutiger_aero' : (themeName as any))}
                        {isPremium && <Crown className="inline-block ml-2 h-4 w-4 text-amber-500" />}
                    </Label>
                </div>
            )
        })}
    </RadioGroup>
  );

  const languagePageContent = (
    <RadioGroup value={language} onValueChange={(v) => setLanguage(v as 'en' | 'ru')} className="p-4 space-y-1">
        <div className="flex items-center space-x-2">
            <RadioGroupItem value="en" id="lang-en" />
            <Label htmlFor="lang-en" className='cursor-pointer'>English</Label>
        </div>
        <div className="flex items-center space-x-2">
            <RadioGroupItem value="ru" id="lang-ru" />
            <Label htmlFor="lang-ru" className='cursor-pointer'>Русский</Label>
        </div>
    </RadioGroup>
  );

  const chatPageContent = (
    <div className='divide-y'>
        <SettingsSwitchItem id="send-on-enter-switch" label={t('send_on_enter_label')} checked={sendOnEnter} onCheckedChange={toggleSendOnEnter} />
        <SettingsSwitchItem id="minimize-call-switch" label={t('minimize_call_on_close_label')} checked={minimizeCallOnClose} onCheckedChange={toggleMinimizeCallOnClose} />
    </div>
  );

  const dataStoragePageContent = (
    <div className='p-4 space-y-4'>
        <div className="p-6 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col items-center text-center gap-2">
            <HardDrive className="h-10 w-10 text-primary mb-2" />
            <h3 className="text-xl font-bold font-headline">{t('cache_usage')}</h3>
            <p className="text-3xl font-black text-primary">{currentCacheSize}</p>
        </div>

        <div className="p-4 rounded-xl bg-card border flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{t('clear_cache')}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{t('clear_cache_desc')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleClearCache} className="shrink-0">
                {t('clear_cache')}
            </Button>
        </div>
    </div>
  );
  
  const accountPageContent = (
    <div className='p-4 space-y-2'>
        <Button onClick={() => setShowEditProfile(true)} variant="outline" className='w-full justify-start'>
            <Pencil className="mr-2 h-4 w-4" />
            <span>{t('edit_profile')}</span>
        </Button>
        <Button onClick={handleLogout} variant="outline" className='w-full justify-start'>
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('logout')}</span>
        </Button>
        <Button onClick={() => setShowDeleteConfirm(true)} variant="destructive" className='w-full justify-start'>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>{t('delete_account')}</span>
        </Button>
    </div>
  );
  
  const helpPageContent = (
      <Accordion type="single" collapsible className="w-full px-4">
        {faqs.map((faq, index) => (
          <AccordionItem value={`item-${index}`} key={index}>
            <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
            <AccordionContent>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            a: ({node, ...props}) => <a href={props.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props} />
                        }}
                    >
                        {faq.answer}
                    </ReactMarkdown>
                </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
  );
  
  const aboutPageContent = (
    <div className='p-4 space-y-4 text-center flex flex-col items-center justify-center h-full min-h-[50vh]'>
      <h2 className="text-6xl font-bold font-headline">0.3</h2>
      <p className="text-muted-foreground">{t('beta_badge')}</p>
      <p className="text-sm text-muted-foreground max-w-xs mt-2">{t('version_info_detail')}</p>
       <Alert className="border-yellow-400 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 text-left mt-8">
            <Star className="h-4 w-4 !text-yellow-500 dark:!text-yellow-600" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                {t('thank_you_beta')}
            </AlertDescription>
      </Alert>
    </div>
);

 const infGoldPageContent = (
      <>
        <div className="p-4 text-center space-y-2">
            <h2 className="text-4xl font-bold flex items-center justify-center gap-2">
                <InfGoldIcon className={cn("w-8 h-8", experimentalDesign && "experimental-glow")} />
                <span>{currentUser.infGoldBalance ?? 0}</span>
            </h2>
            <p className="text-muted-foreground">{t('inf_gold_balance')}</p>
        </div>
        <div className="border-t">
          <SettingsItem icon={Crown} label={t('infinite_prem')} onClick={() => navigateTo('prem')} />
          <SettingsItem icon={Gift} label={t('daily_bonus')} onClick={() => navigateTo('dailyBonus')} />
        </div>
      </>
  );

  const premPageContent = (
    <div className="p-8 space-y-8 flex flex-col items-center justify-center text-center h-full min-h-[50vh]">
        <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full animate-pulse" />
            <ShoppingBag className="h-20 w-20 text-primary relative z-10 experimental-glow" />
        </div>
        <div className="space-y-3">
            <h2 className="text-3xl font-bold font-headline">{t('rustore_development')}</h2>
            <p className="text-muted-foreground max-sm">{t('rustore_note')}</p>
        </div>
    </div>
  );


  const dailyBonusPageContent = (
      <div className="p-4 flex flex-col items-center">
        <DailyBonusWheel 
            onSpin={handleSpin}
            isSpinning={isSpinning}
            setSpinning={setSpinning}
            canSpin={isBonusAvailable}
            rotation={wheelRotation}
        />
        {!isBonusAvailable && <p className="text-sm text-muted-foreground mt-4 text-center">{t('come_back_tomorrow')}</p>}
      </div>
  );

    const whatsNewPageContent = (
    <div className='p-6 space-y-6'>
      <div className="text-center">
        <h2 className="text-2xl font-bold font-headline">{t('whats_new_title')}</h2>
        <p className="text-muted-foreground">{t('whats_new_desc')}</p>
      </div>
      <div className="space-y-4 text-sm">
        <div className="p-4 rounded-lg bg-card border">
          <h3 className="font-semibold text-base mb-1">{t('whats_new_infgold_title')}</h3>
          <p className="text-muted-foreground">{t('whats_new_infgold_desc')}</p>
        </div>
        <div className="p-4 rounded-lg bg-card border">
          <h3 className="font-semibold text-base mb-1">{t('whats_new_media_title')}</h3>
          <p className="text-muted-foreground">{t('whats_new_media_desc')}</p>
        </div>
        <div className="p-4 rounded-lg bg-card border">
          <h3 className="font-semibold text-base mb-1">{t('whats_new_calls_title')}</h3>
          <p className="text-muted-foreground">{t('whats_new_calls_desc')}</p>
        </div>
        <div className="p-4 rounded-lg bg-card border">
          <h3 className="font-semibold text-base mb-1">{t('whats_new_themes_title')}</h3>
          <p className="text-muted-foreground">{t('whats_new_themes_desc')}</p>
        </div>
      </div>
    </div>
  );


  const renderContent = () => {
    switch (page) {
      case 'main': return mainPageContent;
      case 'appearance': return appearancePageContent;
      case 'theme': return themePageContent;
      case 'language': return languagePageContent;
      case 'chat': return chatPageContent;
      case 'account': return accountPageContent;
      case 'help': return helpPageContent;
      case 'about': return aboutPageContent;
      case 'infGold': return infGoldPageContent;
      case 'prem': return premPageContent;
      case 'dailyBonus': return dailyBonusPageContent;
      case 'whatsNew': return whatsNewPageContent;
      case 'dataStorage': return dataStoragePageContent;
      default: return null;
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setTimeout(() => resetState(), 200); }}>
      <DialogContent className={cn("max-w-md w-full h-[85svh] flex flex-col p-0 gap-0 overflow-hidden outline-none bg-card", experimentalDesign && "rounded-[2.5rem] border-none shadow-2xl")}>
        <DialogHeader className="relative flex-row items-center justify-center p-4 shrink-0 h-16 z-20 transition-all bg-card border-b">
          {pageHistory.length > 1 && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="absolute left-2 top-1/2 -translate-y-1/2">
              <ArrowLeft />
            </Button>
          )}
          <DialogTitle className="text-lg">{getTitle()}</DialogTitle>
        </DialogHeader>
        <ScrollArea ref={scrollAreaRef} className="flex-1">
           <div 
                key={page} 
                className={cn(
                    "animate-in fade-in-0 duration-300",
                    animationDirection === 'forward' ? 'slide-in-from-right-5' : 'slide-in-from-left-5'
                )}
            >
                {renderContent()}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    <EditProfileDialog 
        user={currentUser}
        open={showEditProfile}
        onOpenChange={setShowEditProfile}
    />

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
            <AlertDialogTitleComponent>{t('delete_account_confirm_title')}</AlertDialogTitleComponent>
            <AlertDialogDescription>
                {t('delete_account_confirm_desc')}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteAccount} 
                disabled={isDeleting}
                className={cn(buttonVariants({ variant: "destructive" }), "rounded-xl")}
            >
                {isDeleting ? t('deleting_account') : t('delete_account')}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
