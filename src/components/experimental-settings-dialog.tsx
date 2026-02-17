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

import { ArrowLeft, ChevronRight, LogOut, Trash2, Paintbrush, Languages, HelpCircle, Info, Shield, User, Star, MessageSquare } from 'lucide-react';
import type { AuthenticatedUser } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth, useFirestore } from '@/firebase';
import { doc, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';

import { UserProfileCard } from './user-profile-card';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EditProfileDialog } from './edit-profile-dialog';

type SettingsPage = 'main' | 'appearance' | 'theme' | 'language' | 'account' | 'help' | 'about' | 'chat';

const SettingsItem = ({ icon: Icon, label, value, onClick, disabled = false }: { icon: React.ElementType, label: string, value?: string, onClick: () => void, disabled?: boolean }) => (
    <button onClick={onClick} className="flex items-center w-full p-4 text-left rounded-lg hover:bg-muted disabled:opacity-50 disabled:pointer-events-none" disabled={disabled}>
        <Icon className="h-6 w-6 mr-4 text-muted-foreground" />
        <div className="flex-1 flex items-center justify-between">
            <span className="font-medium">{label}</span>
            <div className="flex items-center gap-2 text-muted-foreground">
                {value && <span className='capitalize'>{value}</span>}
                <ChevronRight className="h-5 w-5" />
            </div>
        </div>
  </button>
);


const SettingsSwitchItem = ({ label, checked, onCheckedChange, id }: { label: string, checked: boolean, onCheckedChange: (checked: boolean) => void, id: string }) => (
    <div className="flex items-center justify-between w-full p-4">
        <Label htmlFor={id} className="font-medium cursor-pointer">{label}</Label>
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
  const { theme, setTheme, isDarkMode, toggleTheme, showSnowflakes, toggleSnowflakes, useExperimentalMenu, toggleExperimentalMenu, sendOnEnter, toggleSendOnEnter, minimizeCallOnClose, toggleMinimizeCallOnClose } = useTheme();
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (scrollAreaRef.current) {
        // The viewport is the direct scrollable child of the ScrollArea root.
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
      default: return t('settings');
    }
  };
  
  const faqs = [
    { question: t('faq_markdown_q'), answer: t('faq_markdown_a') },
    { question: t('faq_create_chat_q'), answer: t('faq_create_chat_a') },
    { question: t('faq_invite_q'), answer: t('faq_invite_a') },
    { question: t('faq_edit_profile_q'), answer: t('faq_edit_profile_a') },
    { question: t('faq_bot_q'), answer: t('faq_bot_a') },
    { question: t('faq_security_q'), answer: t('faq_security_a') },
  ];

  const mainPageContent = (
      <>
        <div className="p-4">
            <UserProfileCard 
                user={currentUser} 
                onEditProfile={() => {
                    onOpenChange(false);
                    setTimeout(() => setShowEditProfile(true), 150);
                }} 
            />
        </div>
        <div className="border-t">
          <SettingsItem icon={Paintbrush} label={t('appearance')} value={t(theme === 'frutiger' ? 'frutiger_aero' : (theme as any))} onClick={() => navigateTo('appearance')} />
          <SettingsItem icon={MessageSquare} label={t('chat_settings')} onClick={() => navigateTo('chat')} />
          <SettingsItem icon={Languages} label={t('language')} value={language.toUpperCase()} onClick={() => navigateTo('language')} />
          <SettingsItem icon={User} label={t('profile')} onClick={() => navigateTo('account')} />
          <SettingsItem icon={HelpCircle} label={t('help')} onClick={() => navigateTo('help')} />
          <SettingsItem icon={Info} label={t('version')} value="0.3" onClick={() => navigateTo('about')} />
          {currentUser.isAdmin && (
              <SettingsItem icon={Shield} label={t('admin_panel_title')} onClick={() => router.push('/admin')} />
          )}
        </div>
      </>
  );

  const appearancePageContent = (
      <>
        <SettingsSwitchItem id="dark-mode-switch" label={t('dark_mode')} checked={isDarkMode} onCheckedChange={toggleTheme} />
        <SettingsItem icon={Paintbrush} label={t('color_theme')} value={t(theme === 'frutiger' ? 'frutiger_aero' : (theme as any))} onClick={() => navigateTo('theme')} />
        <SettingsSwitchItem id="snow-switch" label={t('snowflakes')} checked={showSnowflakes} onCheckedChange={toggleSnowflakes} />
        <SettingsSwitchItem id="experimental-menu-switch" label={t('experimental_settings_menu_label')} checked={useExperimentalMenu} onCheckedChange={toggleExperimentalMenu} />
      </>
  );
  
  const themePageContent = (
    <RadioGroup value={theme} onValueChange={(v) => setTheme(v as any)} className="p-4 space-y-1">
        {(['orange', 'purple', 'blue', 'gray', 'green', 'red', 'yellow', 'pink', 'frutiger'] as const).map(themeName => (
            <div key={themeName} className="flex items-center space-x-2">
                <RadioGroupItem value={themeName} id={`theme-${themeName}`} />
                <Label htmlFor={`theme-${themeName}`} className='capitalize cursor-pointer'>{t(themeName === 'frutiger' ? 'frutiger_aero' : themeName)}</Label>
            </div>
        ))}
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
    <div className='p-4 space-y-4'>
      <p>{t('version_info')}</p>
       <Alert className="border-yellow-400 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 text-left">
            <Star className="h-4 w-4 !text-yellow-500 dark:!text-yellow-600" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                {t('thank_you_beta')}
            </AlertDescription>
      </Alert>

      <h3 className="text-lg font-semibold pt-4">{t('version_history')}</h3>
      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="0.3">
              <AccordionTrigger>Version 0.3 (Beta)</AccordionTrigger>
              <AccordionContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 whitespace-pre-wrap">
                      {t('version_0_3_changes')}
                  </div>
              </AccordionContent>
          </AccordionItem>
          <AccordionItem value="0.2">
              <AccordionTrigger>Version 0.2 (Beta)</AccordionTrigger>
              <AccordionContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 whitespace-pre-wrap">
                      {t('version_0_2_changes')}
                  </div>
              </AccordionContent>
          </AccordionItem>
          <AccordionItem value="0.1.3">
              <AccordionTrigger>Version 0.1.3 (Beta)</AccordionTrigger>
              <AccordionContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 whitespace-pre-wrap">
                      {t('version_0_1_3_changes')}
                  </div>
              </AccordionContent>
          </AccordionItem>
          <AccordionItem value="0.1.2">
              <AccordionTrigger>Version 0.1.2 (Beta)</AccordionTrigger>
              <AccordionContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 whitespace-pre-wrap">
                      {t('version_0_1_2_changes')}
                  </div>
              </AccordionContent>
          </AccordionItem>
          <AccordionItem value="0.1.1">
              <AccordionTrigger>Version 0.1.1 (Beta)</AccordionTrigger>
              <AccordionContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 whitespace-pre-wrap">
                      {t('version_0_1_1_changes')}
                  </div>
              </AccordionContent>
          </AccordionItem>
          <AccordionItem value="0.1">
              <AccordionTrigger>Version 0.1 (Beta)</AccordionTrigger>
              <AccordionContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 whitespace-pre-wrap">
                      {t('version_0_1_changes')}
                  </div>
              </AccordionContent>
          </AccordionItem>
      </Accordion>
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
      default: return null;
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setTimeout(() => resetState(), 200); }}>
      <DialogContent className="max-w-md w-full h-[80svh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="relative flex-row items-center justify-center p-4 border-b shrink-0 h-16">
          {pageHistory.length > 1 && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="absolute left-2 top-1/2 -translate-y-1/2">
              <ArrowLeft />
            </Button>
          )}
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        <ScrollArea>
           <div 
                ref={scrollAreaRef}
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
