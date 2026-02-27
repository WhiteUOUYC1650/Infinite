'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
import { Sun, Moon, Languages, Loader2, Lock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/context/theme-context';

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
  const [cloudPasswordInput, setCloudPasswordInput] = useState('');
  const [userId, setUserId] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!auth || !db) return;
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const uid = userCredential.user.uid;

      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data().isDeleted === true) {
        await auth.signOut();
        toast({
          variant: 'destructive',
          title: t('sign_in_failed_toast_title'),
          description: t('user_blocked_error'),
        });
        setIsLoading(false);
        return;
      }

      if (userDocSnap.exists() && userDocSnap.data().loginProtectionEnabled) {
        setUserId(uid);
        setNeedsTwoFactor(true);
        setIsLoading(false);
      } else {
        sessionStorage.setItem('justLoggedIn', 'true');
        sessionStorage.setItem('isVerified', 'true');
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

  const handleVerifyCloudPassword = async () => {
    if (!db || !userId || !cloudPasswordInput.trim()) return;
    setIsLoading(true);
    try {
        const securityRef = doc(db, 'users', userId, 'private', 'security');
        const securitySnap = await getDoc(securityRef);
        
        if (securitySnap.exists() && securitySnap.data().cloudPassword === cloudPasswordInput.trim()) {
            sessionStorage.setItem('justLoggedIn', 'true');
            sessionStorage.setItem('isVerified', 'true');
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

  return (
    <div className="flex min-h-svh items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-[calc(1rem+env(safe-area-inset-right))] flex items-center gap-2 z-10">
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
        {!needsTwoFactor ? (
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
                            <FormLabel>{t('password_label')}</FormLabel>
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
                        <Lock className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold font-headline">{t('verify_identity_title')}</h2>
                        <p className="text-muted-foreground text-sm">{t('enter_cloud_password')}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <Input 
                        type="password" 
                        placeholder="********" 
                        value={cloudPasswordInput} 
                        onChange={(e) => setCloudPasswordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyCloudPassword()}
                        className="text-center text-lg tracking-widest"
                        autoFocus
                    />
                    <Button className="w-full" onClick={handleVerifyCloudPassword} disabled={isLoading || !cloudPasswordInput.trim()}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('verify_button')}
                    </Button>
                    <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setNeedsTwoFactor(false)}>
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