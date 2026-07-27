'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
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
import { Sun, Moon, Languages, ArrowLeft, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/context/theme-context';

const step1Schema = z.object({
  name: z.string().min(2, { message: 'Nickname must be at least 2 characters.' }),
});

const step2Schema = z.object({
  username: z.string()
    .min(4, { message: 'Username must be at least 4 characters.'})
    .refine(value => !/\s/.test(value), { message: 'Username must not contain spaces.'})
    .refine(value => /^[a-zA-Z0-9_]+$/.test(value), { message: 'Username can only contain English letters, numbers, and underscores.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function SignUpPage() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { isDarkMode, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const form1 = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { name: '' },
  });

  const form2 = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: { username: '', email: '', password: '' },
  });

  const onStep1Submit = (values: z.infer<typeof step1Schema>) => {
    setNickname(values.name);
    setStep(2);
  };

  const onStep2Submit = async (values: z.infer<typeof step2Schema>) => {
    if (!auth || !db) return;
    setIsLoading(true);

    const usernameWithAt = '@' + values.username;
    let createdUser: any = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      createdUser = userCredential.user;

      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, 'usernames', usernameWithAt);
        const userDocRef = doc(db, 'users', createdUser!.uid);

        const usernameDoc = await transaction.get(usernameRef);
        if (usernameDoc.exists()) throw new Error(t('username_taken_error'));
        
        transaction.set(userDocRef, {
          id: createdUser.uid,
          name: nickname,
          username: usernameWithAt,
          email: values.email,
          status: 'online',
          statusMessage: 'Hey there! I am using Infinite.',
          hasSetNickname: true,
          isBot: false,
          infGoldBalance: 0,
          subscriptionTier: 'none',
          createdAt: serverTimestamp(),
          subscriptions: [],
          subscriberCount: 0,
          storyExpirationDuration: 24,
        });

        transaction.set(usernameRef, { uid: createdUser!.uid });
      });

      router.push('/welcome');
    } catch (error: any) {
        if (createdUser) await deleteUser(createdUser).catch(console.error);
        if (error.message === t('username_taken_error')) {
            form2.setError('username', { message: t('username_taken_error') });
        } else {
            toast({ variant: 'destructive', title: t('signup_failed_toast_title'), description: error.message || t('unexpected_error') });
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-[calc(1rem+env(safe-area-inset-left))] flex items-center gap-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Languages className="h-5 w-5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={language} onValueChange={(value) => setLanguage(value as 'en' | 'ru')}>
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="ru">Русский</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>{isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button>
      </div>

      <div className="w-full max-w-md p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold font-headline text-primary mb-2">Infinite</h1>
          <p className="text-muted-foreground">{step === 1 ? t('nickname_label') : t('signup_subtitle')}</p>
        </div>

        {step === 1 ? (
            <Form {...form1}>
                <form onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-4">
                    <FormField control={form1.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('nickname_label')}</FormLabel>
                            <FormControl><Input placeholder={t('nickname_placeholder')} {...field} autoFocus /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <Button type="submit" className="w-full h-12 rounded-xl font-bold">{t('continue_button')}</Button>
                </form>
            </Form>
        ) : (
            <Form {...form2}>
                <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-4">
                    <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="mb-2 p-0 h-auto text-muted-foreground hover:bg-transparent"><ArrowLeft className="h-4 w-4 mr-1" /> {t('back_button') || 'Назад'}</Button>
                    <FormField control={form2.control} name="username" render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('username_label')}</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">@</span>
                                    <Input placeholder={t('username_placeholder')} className="pl-7" {...field} />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form2.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>{t('email_label')}</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form2.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>{t('password_label')}</FormLabel><FormControl><Input type="password" placeholder="********" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={isLoading}>
                        {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                        {t('create_account_button')}
                    </Button>
                </form>
            </Form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {t('has_account_prompt')} <Link href="/login" className="font-semibold text-primary hover:underline">{t('sign_in_link')}</Link>
        </p>
      </div>
       <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))]">
        <Badge variant="outline">{t('beta_badge')}</Badge>
      </div>
    </div>
  );
}
