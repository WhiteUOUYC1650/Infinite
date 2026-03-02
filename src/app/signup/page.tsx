
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, runTransaction, collection, query, where, getDocs, getDoc, setDoc, Timestamp, addDoc, updateDoc } from 'firebase/firestore';
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
import Link from 'link';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { Sun, Moon, Languages } from 'lucide-react';
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
    
    let createdUser: import('firebase/auth').User | null = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      createdUser = userCredential.user;

      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, 'usernames', usernameWithAt);
        const userDocRef = doc(db, 'users', createdUser!.uid);

        const usernameDoc = await transaction.get(usernameRef);
        if (usernameDoc.exists()) {
          throw new Error(t('username_taken_error'));
        }
        
        const isBotUser = usernameWithAt === '@InfiniteBot' || usernameWithAt === '@VeoBot';

        transaction.set(userDocRef, {
          name: isBotUser ? 'Infinite' : usernameWithAt,
          username: usernameWithAt,
          status: 'online',
          statusMessage: isBotUser 
            ? 'I am the official Infinite bot. I can send you welcome messages and important announcements!'
            : 'Hey there! I am using Infinite.',
          hasSetNickname: true,
          isBot: isBotUser,
          infGoldBalance: 0,
          subscriptionTier: 'none',
        });

        transaction.set(usernameRef, { uid: createdUser!.uid });

        if (isBotUser) {
            let botPath = values.username;
            if (usernameWithAt === '@InfiniteBot') botPath = 'Infinite';
            if (usernameWithAt === '@VeoBot') botPath = 'Veo';

            const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/' + botPath));
            transaction.set(botLinkRef, { botId: createdUser!.uid });
        }
      });

      try {
        const isBotUser = usernameWithAt === '@InfiniteBot' || usernameWithAt === '@VeoBot';
        if (!isBotUser) {
          const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/Infinite'));
          const botLinkSnap = await getDoc(botLinkRef);
      
          if (botLinkSnap.exists()) {
              const botId = botLinkSnap.data().botId;
              const botUserRef = doc(db, 'users', botId);
              const botUserSnap = await getDoc(botUserRef);

              if (botUserSnap.exists()) {
                const botData = botUserSnap.data() as User;
                const newUserId = createdUser!.uid;
                const members = [newUserId, botId].sort();
                const chatId = members.join('_');
                const chatRef = doc(db, 'chats', chatId);
                
                const chatSnap = await getDoc(chatRef);
                if (!chatSnap.exists()) {
                    await setDoc(chatRef, {
                        type: 'dm',
                        members: members,
                        unreadCounts: { [newUserId]: 1, [botId]: 0 },
                        icon: 'Bot',
                    });
                }
                
                const messagesCollectionRef = collection(db, 'chats', chatId, 'messages');
                const welcomeMessage = {
                    senderId: newUserId,
                    type: 'announcement',
                    content: 'Welcome to Infinite!',
                    timestamp: Timestamp.now(),
                    senderName: botData.name,
                    senderAvatar: botData.avatar || null
                };
                const msgRef = await addDoc(messagesCollectionRef, welcomeMessage);
                await updateDoc(chatRef, { lastMessage: { ...welcomeMessage, id: msgRef.id } });
              }
          }
        }
      } catch (botError) {
          console.error("Could not send welcome message from bot:", botError);
      }
      
      router.push('/welcome');

    } catch (error: any) {
        if (createdUser) {
            await deleteUser(createdUser).catch(e => {
                console.error("Failed to clean up orphaned auth user:", e);
            });
        }

        console.error('Error signing up:', error);

        if (error.message === t('username_taken_error')) {
            form.setError('username', { message: t('username_taken_error') });
            return;
        }

        if (error.code) {
            switch (error.code) {
                case 'auth/email-already-in-use':
                    form.setError('email', { message: t('email_in_use_error') });
                    return;
                case 'auth/invalid-email':
                    form.setError('email', { message: t('invalid_email_error') });
                    return;
                case 'auth/weak-password':
                    form.setError('password', { message: t('weak_password_error') });
                    return;
            }
        }
        
        toast({
            variant: 'destructive',
            title: t('signup_failed_toast_title'),
            description: error.message || t('unexpected_error'),
        });
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
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-4xl font-bold font-headline text-primary">Infinite</h1>
          </div>
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
       <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))]">
        <Badge variant="outline">{t('beta_badge')}</Badge>
      </div>
    </div>
  );
}
