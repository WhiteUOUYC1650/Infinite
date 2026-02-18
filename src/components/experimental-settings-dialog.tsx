'use client';

import { useState, useRef, useEffect } from 'react';
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

import { ArrowLeft, ChevronRight, LogOut, Trash2, Paintbrush, Languages, HelpCircle, Info, Shield, User, Star, MessageSquare, Crown, Gift, Loader2, Bell, Phone } from 'lucide-react';
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

type SettingsPage = 'main' | 'appearance' | 'theme' | 'language' | 'account' | 'help' | 'about' | 'chat' | 'infGold' | 'prem' | 'dailyBonus' | 'whatsNew';

type SubscriptionTierId = 'super' | 'mega' | 'prem' | 'giga' | 'ultra';

const subscriptionTiers: {
    id: SubscriptionTierId;
    nameKey: any;
    monthlyPrice: number;
    yearlyPrice: number;
    features: any[];
    level: number;
}[] = [
  {
    id: 'super',
    nameKey: 'infinite_super',
    monthlyPrice: 10,
    yearlyPrice: 100,
    features: ['super_feature_1'],
    level: 1,
  },
  {
    id: 'mega',
    nameKey: 'infinite_mega',
    monthlyPrice: 50,
    yearlyPrice: 500,
    features: ['mega_feature_1'],
    level: 2,
  },
  {
    id: 'prem',
    nameKey: 'infinite_prem',
    monthlyPrice: 100,
    yearlyPrice: 1000,
    features: ['prem_feature_1', 'prem_feature_2'],
    level: 3,
  },
  {
    id: 'giga',
    nameKey: 'infinite_giga',
    monthlyPrice: 250,
    yearlyPrice: 2500,
    features: ['giga_feature_1'],
    level: 4,
  },
  {
    id: 'ultra',
    nameKey: 'infinite_ultra',
    monthlyPrice: 500,
    yearlyPrice: 5000,
    features: ['ultra_feature_1'],
    level: 5,
  },
].sort((a, b) => a.level - b.level);


const SettingsItem = ({ icon: Icon, label, value, onClick, disabled = false, description }: { icon: React.ElementType, label: string, value?: string, onClick: () => void, disabled?: boolean, description?: string }) => (
    <button onClick={onClick} className="flex items-center w-full p-4 text-left rounded-lg hover:bg-muted disabled:opacity-50 disabled:pointer-events-none group" disabled={disabled}>
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 group-hover:bg-primary/20 transition-colors">
            <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 flex flex-col justify-center min-w-0">
            <span className="font-medium truncate">{label}</span>
            {description && <span className="text-xs text-muted-foreground truncate">{description}</span>}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground ml-2">
            {value && <span className='capitalize text-sm'>{value}</span>}
            <ChevronRight className="h-5 w-5" />
        </div>
  </button>
);


const SettingsSwitchItem = ({ label, checked, onCheckedChange, id, description }: { label: string, checked: boolean, onCheckedChange: (checked: boolean) => void, id: string, description?: string }) => (
    <div className="flex items-center justify-between w-full p-4">
        <div className="flex flex-col flex-1 mr-4">
            <Label htmlFor={id} className="font-medium cursor-pointer">{label}</Label>
            {description && <span className="text-xs text-muted-foreground">{description}</span>}
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
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
  
  // Subscription state
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<'monthly' | 'yearly'>('monthly');

  // Daily Bonus State
  const [isSpinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const isBonusAvailable = !currentUser.lastDailyBonusClaimed || (Date.now() - currentUser.lastDailyBonusClaimed.toMillis()) > 24 * 60 * 60 * 1000;


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

  const handleSubscribe = async (tier: typeof subscriptionTiers[0]) => {
    const cost = subscriptionPlan === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;
    if (!db || (currentUser.infGoldBalance ?? 0) < cost) return;
    setIsSubscribing(true);

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            subscriptionTier: tier.id,
            infGoldBalance: increment(-cost)
        });
        toast({
            title: t('subscription_successful_title'),
            description: t('subscription_successful_desc'),
        });
    } catch (error) {
        console.error("Subscription failed:", error);
        toast({ variant: 'destructive', title: 'Error', description: t('subscription_failed') });
    } finally {
        setIsSubscribing(false);
    }
  };

  const handleSpin = async (): Promise<void> => {
    // Weighted random selection
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

    // Delay showing result to match animation
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
    }, 5000); // animation duration
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
    <div className="flex flex-col items-center pt-8 pb-6 px-4 bg-primary/5">
        <UserAvatarWithStatus user={currentUser as any} className="w-24 h-24 text-3xl mb-4 border-4 border-background shadow-xl" />
        <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold font-headline flex items-center justify-center gap-2">
                {currentUser.name}
                {currentUser.isAdmin && <VerifiedBadge />}
            </h2>
            <p className="text-muted-foreground">{currentUser.username}</p>
        </div>
        
        <div className="grid grid-cols-3 gap-4 w-full max-w-xs mt-8">
            <button className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-xs font-medium">{t('message')}</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-green-500" />
                </div>
                <span className="text-xs font-medium">{t('music')}</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-orange-500" />
                </div>
                <span className="text-xs font-medium">{t('audio_call')}</span>
            </button>
        </div>
    </div>
  );

  const mainPageContent = (
      <>
        {experimentalDesign ? <ExperimentalProfileHeader /> : (
            <div className="p-4">
                <UserProfileCard 
                    user={currentUser} 
                    onEditProfile={() => {
                        onOpenChange(false);
                        setTimeout(() => setShowEditProfile(true), 150);
                    }} 
                />
            </div>
        )}
        <div className={cn("border-t", experimentalDesign && "mt-4")}>
          <SettingsItem icon={Paintbrush} label={t('appearance')} description={t('appearance')} value={t(theme === 'frutiger' ? 'frutiger_aero' : (theme as any))} onClick={() => navigateTo('appearance')} />
          <SettingsItem icon={MessageSquare} label={t('chat_settings')} description={t('chat_settings')} onClick={() => navigateTo('chat')} />
          <SettingsItem icon={Languages} label={t('language')} description={t('language')} value={language.toUpperCase()} onClick={() => navigateTo('language')} />
          <SettingsItem icon={InfGoldIcon} label="InfGold" description={t('inf_gold_balance')} onClick={() => navigateTo('infGold')} />
          <SettingsItem icon={User} label={t('profile')} description={t('view_profile')} onClick={() => navigateTo('account')} />
          <SettingsItem icon={Star} label={t('whats_new')} description={t('whats_new_desc')} onClick={() => navigateTo('whatsNew')} />
          <SettingsItem icon={HelpCircle} label={t('help')} description={t('faq_desc')} onClick={() => navigateTo('help')} />
          <SettingsItem icon={Info} label={t('version')} description={t('version_info')} value="0.3" onClick={() => navigateTo('about')} />
          {currentUser.isAdmin && (
              <SettingsItem icon={Shield} label={t('admin_panel_title')} description={t('admin_panel_title')} onClick={() => router.push('/admin')} />
          )}
        </div>
      </>
  );

  const appearancePageContent = (
      <>
        <SettingsSwitchItem id="dark-mode-switch" label={t('dark_mode')} checked={isDarkMode} onCheckedChange={toggleTheme} />
        <SettingsItem icon={Paintbrush} label={t('color_theme')} value={t(theme === 'frutiger' ? 'frutiger_aero' : (theme as any))} onClick={() => navigateTo('theme')} />
        <SettingsSwitchItem id="snow-switch" label={t('snowflakes')} checked={showSnowflakes} onCheckedChange={toggleSnowflakes} />
        <SettingsSwitchItem id="exp-design-switch" label={t('experimental_design_label')} checked={experimentalDesign} onCheckedChange={toggleExperimentalDesign} description={t('experimental_design_desc')} />
      </>
  );
  
  const currentTierLevel = subscriptionTiers.find(t => t.id === currentUser.subscriptionTier)?.level ?? 0;
  const premTierLevel = subscriptionTiers.find(t => t.id === 'prem')?.level ?? 3;
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
  
  const accountPageContent = (
    <div className='p-4 space-y-2'>
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
            <AccordionTrigger>{faq.question}</AccordionTrigger>
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
                <InfGoldIcon className="w-8 h-8" />
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
    <div className="p-4 space-y-6">
        <RadioGroup defaultValue={subscriptionPlan} onValueChange={(value: any) => setSubscriptionPlan(value)} className="grid grid-cols-2 gap-4">
            <div>
                <RadioGroupItem value="monthly" id="monthly" className="sr-only" />
                <Label htmlFor="monthly" className={cn("flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer")}>
                    {t('monthly')}
                </Label>
            </div>
            <div>
                <RadioGroupItem value="yearly" id="yearly" className="sr-only" />
                <Label htmlFor="yearly" className={cn("flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer")}>
                     {t('yearly')}
                     <Badge variant="secondary" className="mt-1">{t('yearly_discount_note')}</Badge>
                </Label>
            </div>
        </RadioGroup>

        <div className="space-y-4">
        {subscriptionTiers.map((tier, index) => {
            const currentTierLevel = subscriptionTiers.find(t => t.id === currentUser.subscriptionTier)?.level ?? 0;
            const isCurrent = currentUser.subscriptionTier === tier.id;
            const previousTier = index > 0 ? subscriptionTiers[index - 1] : null;
            const cost = subscriptionPlan === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;
            const canAfford = (currentUser.infGoldBalance ?? 0) >= cost;
            
            let buttonTextKey: any = 'subscribe';
            if (isCurrent) buttonTextKey = 'current_plan';
            else if (tier.level > currentTierLevel) buttonTextKey = 'upgrade';
            else if (tier.level < currentTierLevel) buttonTextKey = 'downgrade';

            return (
                <Card key={tier.id} className={cn(isCurrent && 'border-primary ring-1 ring-primary')}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>{t(tier.nameKey)}</CardTitle>
                                <CardDescription className="flex items-center gap-1.5">
                                    <span className="font-bold">{cost}</span>
                                    <InfGoldIcon className="w-4 h-4" />
                                    <span>/ {t(subscriptionPlan === 'yearly' ? 'year' : 'month')}</span>
                                </CardDescription>
                            </div>
                            {tier.id === 'prem' && <Badge variant="secondary">{t('best_value')}</Badge>}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc space-y-2 pl-5 text-sm">
                            <li>
                                {previousTier 
                                    ? t('all_features_from', { tierName: t(previousTier.nameKey) })
                                    : t('all_free_features')
                                }
                            </li>
                            {tier.features.map((featureKey: any) => (
                                <li key={featureKey}>{t(featureKey)}</li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                         <Button
                            onClick={() => handleSubscribe(tier)}
                            disabled={isSubscribing || isCurrent || !canAfford}
                            className='w-full'
                         >
                            {isSubscribing ? <Loader2 className="animate-spin" /> : t(buttonTextKey)}
                         </Button>
                    </CardFooter>
                </Card>
            )
        })}
        </div>

        { (currentUser.infGoldBalance ?? 0) < (subscriptionPlan === 'yearly' ? 1000 : 100) && (
            <p className="text-sm text-center text-destructive">{t('not_enough_gold')}</p>
        )}
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
      default: return null;
    }
  };

  const isMainPage = page === 'main';

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setTimeout(() => resetState(), 200); }}>
      <DialogContent className={cn("max-w-md w-full h-[85svh] flex flex-col p-0 gap-0 overflow-hidden outline-none", experimentalDesign && "rounded-3xl border-none")}>
        <DialogHeader className={cn(
            "relative flex-row items-center justify-center p-4 shrink-0 h-16 z-20",
            experimentalDesign ? "bg-background/60 backdrop-blur-xl border-none" : "bg-background border-b"
        )}>
          {pageHistory.length > 1 && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="absolute left-2 top-1/2 -translate-y-1/2">
              <ArrowLeft />
            </Button>
          )}
          <DialogTitle className={cn(experimentalDesign && isMainPage && "sr-only")}>{getTitle()}</DialogTitle>
        </DialogHeader>
        <ScrollArea ref={scrollAreaRef} className="animate-in fade-in-0 duration-300">
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
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitleComponent>{t('delete_account_confirm_title')}</AlertDialogTitleComponent>
            <AlertDialogDescription>
                {t('delete_account_confirm_desc')}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteAccount} 
                disabled={isDeleting}
                className={cn(buttonVariants({ variant: "destructive" }))}
            >
                {isDeleting ? t('deleting_account') : t('delete_account')}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
