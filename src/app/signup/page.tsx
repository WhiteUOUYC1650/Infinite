'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
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
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/language-context';
import { Sun, Moon, Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const formSchema = z.object({
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const initialTheme =
      storedTheme === 'dark' ||
      (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light';
    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!auth || !db) return;

    form.clearErrors();
    const usernameWithAt = '@' + values.username;

    try {
      const usernameRef = doc(db, 'usernames', usernameWithAt);
      const usernameDoc = await getDoc(usernameRef);
      if (usernameDoc.exists()) {
        form.setError('username', { message: t('username_taken_error') });
        return;
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      const userDocRef = doc(db, 'users', user.uid);
      
      await runTransaction(db, async (transaction) => {
        const usernameDocInTransaction = await transaction.get(usernameRef);
        if (usernameDocInTransaction.exists()) {
          throw new Error(t('username_just_taken_error'));
        }
        
        transaction.set(usernameRef, { uid: user.uid });
        transaction.set(userDocRef, {
          name: usernameWithAt,
          username: usernameWithAt,
          status: 'online',
          statusMessage: 'Hey there! I am using Infinite.',
          hasSetNickname: false
        });
      });
      
      router.push('/welcome');

    } catch (error: any) {
        if (auth.currentUser && error.message.includes(t('username_just_taken_error'))) {
             await deleteUser(auth.currentUser);
             form.setError('username', { message: error.message });
        } else if (error.code === 'auth/email-already-in-use') {
            form.setError('email', { message: t('email_in_use_error') });
        } else {
            console.error('Error signing up', error);
            toast({
                variant: 'destructive',
                title: t('signup_failed_toast_title'),
                description: error.message || 'An unexpected error occurred.',
            });
        }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
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
          {theme === 'light' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
      <div className="w-full max-w-md p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold font-headline text-primary mb-2">{t('signup_title')}</h1>
          <p className="text-muted-foreground">
            {t('signup_subtitle')}
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('username_label')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                            @
                        </span>
                        <Input placeholder={t('username_placeholder')} className="pl-7" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('creating_account_button') : t('create_account_button')}
            </Button>
          </form>
        </Form>
        <p className="text-center text-sm text-muted-foreground">
          {t('has_account_prompt')}{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t('sign_in_link')}
          </Link>
        </p>
      </div>
    </div>
  );
}
