'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, collection, Timestamp, increment, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { Sun, Moon, Languages, Loader2, Lock, ShieldAlert, MessageSquare, KeyRound, Mail, User as UserIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/context/theme-context';
import type { User } from '@/types';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function LoginPage() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { isDarkMode, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [isLoading, setIsLoading] = useState(false);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [isBotRecoveryMode, setIsBotRecoveryMode] = useState(false);
  const [recoveryEmailInput, setRecoveryEmailInput] = useState('');
  
  const [cloudPasswordInput, setCloudPasswordInput] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [botCodeInput, setBotCodeInput] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isBotCodeMode, setIsBotCodeMode] = useState(false);
  const [userId, setUserId] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Reset login state on mount to prevent being stuck
  useEffect(() => {
    setNeedsTwoFactor(false);
    setIsRecoveryMode(false);
    setIsBotCodeMode(false);
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!auth || !db) return;
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const uid = userCredential.user.uid;

      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        
        if (userData.isDeleted === true) {
          await auth.signOut();
          toast({
            variant: 'destructive',
            title: t('sign_in_failed_toast_title'),
            description: t('user_blocked_error'),
          });
          setIsLoading(false);
          return;
        }

        // 0.6 Beta: Beta-tester only access check
        const isBetaTester = userData.isBetaTester;
        const isAdmin = userData.username === '@Infinite';
        const isBot = userData.isBot || userData.isCustomBot;

        if (!isBetaTester && !isAdmin && !isBot) {
          await auth.signOut();
          toast({
            variant: 'destructive',
            title: t('sign_in_failed_toast_title'),
            description: t('access_denied_beta_only'),
          });
          setIsLoading(false);
          return;
        }

        if (userData.loginProtectionEnabled) {
          setUserId(uid);
          setNeedsTwoFactor(true);
          setIsLoading(false);
        } else {
          localStorage.setItem('justLoggedIn', 'true');
          localStorage.setItem('isVerified', 'true');
          router.push('/');
        }
      } else {
        // Handle case where auth user exists but firestore user doesn't
        setIsLoading(false);
        router.push('/');
      }
    } catch (error: any) {
      console.error('Error signing in', error);
      let description = t('unexpected_error');
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            description = t('invalid_credentials_error');
            break;
          case 'auth/user-disabled':
            description = t('user_disabled_error');
            break;
          case 'auth/invalid-email':
            description = t('invalid_email_error');
            break;
          default:
            description = error.message;
        }
      }
      toast({
        variant: 'destructive',
        title: t('sign_in_failed_toast_title'),
        description: description,
      });
      setIsLoading(false);
    }
  };

  const handleSendBotCodeByEmail = async () => {
    if (!db || !recoveryEmailInput.trim()) return;
    setIsLoading(true);
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', recoveryEmailInput.trim()), limit(1));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
            toast({ variant: 'destructive', title: t('sign_in_failed_toast_title'), description: t('user_not_found') });
            setIsLoading(false);
            return;
        }

        const foundUserDoc = querySnap.docs[0];
        const foundUserId = foundUserDoc.id;
        setUserId(foundUserId);

        const code = Math.random().toString().substring(2, 10);
        const securityRef = doc(db, 'users', foundUserId, 'private', 'security');
        await setDoc(securityRef, { tempBotCode: code }, { merge: true });

        const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/Infinite'));
        const botLinkSnap = await getDoc(botLinkRef);

        if (botLinkSnap.exists()) {
            const botId = botLinkSnap.data().botId;
            const botUserRef = doc(db, 'users', botId);
            const botUserSnap = await getDoc(botUserRef);

            if (botUserSnap.exists()) {
                const botData = botUserSnap.data() as User;
                const members = [foundUserId, botId].sort();
                const chatId = members.join('_');
                const chatRef = doc(db, 'chats', chatId);

                const chatSnap = await getDoc(chatRef);
                if (!chatSnap.exists()) {
                    await setDoc(chatRef, {
                        type: 'dm',
                        members: members,
                        unreadCounts: { [foundUserId]: 1 },
                        icon: 'Bot',
                    });
                } else {
                    await updateDoc(chatRef, { [`unreadCounts.${foundUserId}`]: increment(1) });
                }

                const messagesCollectionRef = collection(db, 'chats', chatId, 'messages');
                const recoveryMessage = {
                    senderId: foundUserId,
                    type: 'announcement',
                    content: `Your login verification code is: **${code}**`,
                    timestamp: Timestamp.now(),
                    senderName: botData.name,
                    senderAvatar: botData.avatar || null,
                };
                const msgRef = await addDoc(messagesCollectionRef, recoveryMessage);
                await updateDoc(chatRef, { lastMessage: { ...recoveryMessage, id: msgRef.id } });
            }
        }

        setIsBotCodeMode(true);
        setNeedsTwoFactor(true);
        setIsBotRecoveryMode(false);
        toast({ title: t('dm_success'), description: t('bot_code_sent') });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: t('unexpected_error') });
    } finally {
        setIsLoading(false);
    }
  };

  const handleVerifyCloudPassword = async () => {
    if (!db || !userId || !cloudPasswordInput.trim()) return;
    setIsLoading(true);
    try {
        const securityRef = doc(db, 'users', userId, 'private', 'security');
        const securitySnap = await getDoc(securityRef);
        
        if (securitySnap.exists() && securitySnap.data().cloudPassword === cloudPasswordInput.trim()) {
            localStorage.setItem('justLoggedIn', 'true');
            localStorage.setItem('isVerified', 'true');
            router.push('/');
        } else {
            toast({
                variant: 'destructive',
                title: t('sign_in_failed_toast_title'),
                description: t('incorrect_cloud_password'),
            });
            setIsLoading(false);
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: t('unexpected_error') });
        setIsLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async () => {
    if (!db || !userId || !recoveryCodeInput.trim()) return;
    setIsLoading(true);
    try {
        const securityRef = doc(db, 'users', userId, 'private', 'security');
        const securitySnap = await getDoc(securityRef);
        
        if (securitySnap.exists() && securitySnap.data().recoveryCode === recoveryCodeInput.trim().toUpperCase()) {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, { loginProtectionEnabled: false });
            
            toast({
                title: t('dm_success'),
                description: t('recovery_success'),
            });
            
            localStorage.setItem('justLoggedIn', 'true');
            localStorage.setItem('isVerified', 'true');
            router.push('/');
        } else {
            toast({
                variant: 'destructive',
                title: t('sign_in_failed_toast_title'),
                description: t('incorrect_recovery_code'),
            });
            setIsLoading(false);
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: t('unexpected_error') });
        setIsLoading(false);
    }
  };

  const handleSendBotCode = async () => {
    if (!db || !userId) return;
    setIsLoading(true);
    try {
        const code = Math.random().toString().substring(2, 10);
        const securityRef = doc(db, 'users', userId, 'private', 'security');
        await setDoc(securityRef, { tempBotCode: code }, { merge: true });

        const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/Infinite'));
        const botLinkSnap = await getDoc(botLinkRef);

        if (botLinkSnap.exists()) {
            const botId = botLinkSnap.data().botId;
            const botUserRef = doc(db, 'users', botId);
            const botUserSnap = await getDoc(botUserRef);

            if (botUserSnap.exists()) {
                const botData = botUserSnap.data() as User;
                const members = [userId, botId].sort();
                const chatId = members.join('_');
                const chatRef = doc(db, 'chats', chatId);

                const chatSnap = await getDoc(chatRef);
                if (!chatSnap.exists()) {
                    await setDoc(chatRef, {
                        type: 'dm',
                        members: members,
                        unreadCounts: { [userId]: 1 },
                        icon: 'Bot',
                    });
                } else {
                    await updateDoc(chatRef, { [`unreadCounts.${userId}`]: increment(1) });
                }

                const messagesCollectionRef = collection(db, 'chats', chatId, 'messages');
                const recoveryMessage = {
                    senderId: userId,
                    type: 'announcement',
                    content: `Your login verification code is: **${code}**`,
                    timestamp: Timestamp.now(),
                    senderName: botData.name,
                    senderAvatar: botData.avatar || null,
                };
                const msgRef = await addDoc(messagesCollectionRef, recoveryMessage);
                await updateDoc(chatRef, { lastMessage: { ...recoveryMessage, id: msgRef.id } });
            }
        }

        setIsBotCodeMode(true);
        setIsRecoveryMode(false);
        toast({ title: t('dm_success'), description: t('bot_code_sent') });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: t('unexpected_error') });
    } finally {
        setIsLoading(false);
    }
  };

  const handleVerifyBotCode = async () => {
    if (!db || !userId || !botCodeInput.trim()) return;
    setIsLoading(true);
    try {
        const securityRef = doc(db, 'users', userId, 'private', 'security');
        const securitySnap = await getDoc(securityRef);
        
        if (securitySnap.exists() && securitySnap.data().tempBotCode === botCodeInput.trim()) {
            await updateDoc(securityRef, { tempBotCode: null }); // Clear it
            localStorage.setItem('justLoggedIn', 'true');
            localStorage.setItem('isVerified', 'true');
            router.push('/');
        } else {
            toast({
                variant: 'destructive',
                title: t('sign_in_failed_toast_title'),
                description: t('incorrect_bot_code'),
            });
            setIsLoading(false);
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: t('unexpected_error') });
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-[calc(1rem+env(safe-area-inset-left))] flex items-center gap-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Languages className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={language} onValueChange={(value) => setLanguage(value as 'en' | 'ru')}>
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="ru">Русский</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDarkMode ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      <div className="w-full max-w-md p-8 space-y-8">
        {isBotRecoveryMode ? (
            <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <KeyRound className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold font-headline">{t('forgot_password_title')}</h2>
                        <p className="text-muted-foreground text-sm">
                            {t('enter_email_for_recovery')}
                        </p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="space-y-2 text-left">
                        <Label htmlFor="recovery-email">{t('email_label')}</Label>
                        <Input 
                            id="recovery-email"
                            type="email" 
                            placeholder="name@example.com" 
                            value={recoveryEmailInput} 
                            onChange={(e) => setRecoveryEmailInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendBotCodeByEmail()}
                            autoFocus
                        />
                    </div>
                    <Button className="w-full" onClick={handleSendBotCodeByEmail} disabled={isLoading || !recoveryEmailInput.includes('@')}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('verify_button')}
                    </Button>
                    <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setIsBotRecoveryMode(false)}>
                        {t('cancel')}
                    </Button>
                </div>
            </div>
        ) : !needsTwoFactor ? (
            <>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <h1 className="text-4xl font-bold font-headline text-primary">Infinite</h1>
                    </div>
                    <p className="text-muted-foreground">
                        {t('login_subtitle')}
                    </p>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>{t('email_label')}</FormLabel>
                            <FormControl>
                                <Input placeholder="name@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                            <div className="flex items-center justify-between">
                                <FormLabel>{t('password_label')}</FormLabel>
                                <Button variant="link" className="px-0 h-auto text-xs text-primary" type="button" onClick={() => setIsBotRecoveryMode(true)}>
                                    {t('forgot_password_link')}
                                </Button>
                            </div>
                            <FormControl>
                                <Input type="password" placeholder="********" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? t('signing_in_button') : t('sign_in_button')}
                        </Button>
                    </form>
                </Form>
                <p className="text-center text-sm text-muted-foreground">
                    {t('no_account_prompt')}{' '}
                    <Link href="/signup" className="font-semibold text-primary hover:underline">
                        {t('sign_up_link')}
                    </Link>
                </p>
            </>
        ) : (
            <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        {isRecoveryMode ? <ShieldAlert className="h-8 w-8 text-primary" /> : isBotCodeMode ? <MessageSquare className="h-8 w-8 text-primary" /> : <Lock className="h-8 w-8 text-primary" />}
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold font-headline">
                            {isRecoveryMode ? t('use_recovery_code') : isBotCodeMode ? t('enter_bot_code') : t('verify_identity_title')}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            {isRecoveryMode ? t('enter_recovery_code') : isBotCodeMode ? t('enter_bot_code') : t('enter_cloud_password')}
                        </p>
                    </div>
                </div>
                <div className="space-y-4">
                    {isRecoveryMode ? (
                        <Input 
                            type="text" 
                            placeholder="XXXXXXXX" 
                            value={recoveryCodeInput} 
                            onChange={(e) => setRecoveryCodeInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyRecoveryCode()}
                            className="text-center text-lg font-mono tracking-widest"
                            autoFocus
                        />
                    ) : isBotCodeMode ? (
                        <Input 
                            type="text" 
                            placeholder="XXXXXXXX" 
                            value={botCodeInput} 
                            onChange={(e) => setBotCodeInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyBotCode()}
                            className="text-center text-lg font-mono tracking-widest"
                            autoFocus
                        />
                    ) : (
                        <Input 
                            type="password" 
                            placeholder="********" 
                            value={cloudPasswordInput} 
                            onChange={(e) => setCloudPasswordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyCloudPassword()}
                            className="text-center text-lg tracking-widest"
                            autoFocus
                        />
                    )}
                    
                    <Button className="w-full" onClick={isRecoveryMode ? handleVerifyRecoveryCode : isBotCodeMode ? handleVerifyBotCode : handleVerifyCloudPassword} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('verify_button')}
                    </Button>

                    <div className="flex flex-col gap-1">
                        {!isRecoveryMode && !isBotCodeMode && (
                            <>
                                <Button variant="link" className="text-xs text-muted-foreground h-auto p-1" onClick={() => setIsRecoveryMode(true)}>
                                    {t('forgot_cloud_password')}
                                </Button>
                                <Button variant="link" className="text-xs text-muted-foreground h-auto p-1" onClick={handleSendBotCode}>
                                    {t('recovery_via_bot')}
                                </Button>
                            </>
                        )}
                    </div>

                    <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => {
                        if (isRecoveryMode || isBotCodeMode) {
                            setIsRecoveryMode(false);
                            setIsBotCodeMode(false);
                        } else {
                            setNeedsTwoFactor(false);
                        }
                    }}>
                        {t('cancel')}
                    </Button>
                </div>
            </div>
        )}
      </div>

      <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))]">
        <Badge variant="outline">{t('beta_badge')}</Badge>
      </div>
    </div>
  );
}
