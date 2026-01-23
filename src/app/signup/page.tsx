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

const formSchema = z.object({
  username: z.string()
    .min(4, { message: 'Username must be at least 4 characters.'})
    .refine(value => value.startsWith('@'), { message: "Username must start with '@'." })
    .refine(value => !/\s/.test(value), { message: 'Username must not contain spaces.'}),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function SignUpPage() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '@',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!auth || !db) return;

    form.clearErrors();

    try {
      const usernameRef = doc(db, 'usernames', values.username);
      const usernameDoc = await getDoc(usernameRef);
      if (usernameDoc.exists()) {
        form.setError('username', { message: 'This username is already taken.' });
        return;
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      const userDocRef = doc(db, 'users', user.uid);
      
      await runTransaction(db, async (transaction) => {
        const usernameDocInTransaction = await transaction.get(usernameRef);
        if (usernameDocInTransaction.exists()) {
          throw new Error("Username was just taken. Please choose another.");
        }
        
        transaction.set(usernameRef, { uid: user.uid });
        transaction.set(userDocRef, {
          name: values.username,
          username: values.username,
          avatar: `https://i.pravatar.cc/150?u=${user.uid}`,
          status: 'online',
          statusMessage: 'Hey there! I am using Infinite.',
          hasSetNickname: false
        });
      });
      
      router.push('/');

    } catch (error: any) {
        if (auth.currentUser && error.message.includes("Username was just taken")) {
             await deleteUser(auth.currentUser);
             form.setError('username', { message: error.message });
        } else if (error.code === 'auth/email-already-in-use') {
            form.setError('email', { message: 'This email is already in use.' });
        } else {
            console.error('Error signing up', error);
            toast({
                variant: 'destructive',
                title: 'Sign up failed',
                description: error.message || 'An unexpected error occurred.',
            });
        }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold font-headline text-primary mb-2">Create an Account</h1>
          <p className="text-muted-foreground">
            to start using Infinite messenger.
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="@yourname" {...field} />
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
                  <FormLabel>Email</FormLabel>
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </Form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
