'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, doc, getDoc, deleteDoc } from 'firebase/firestore';
import type { User, Chat } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Trash2, Users, Megaphone, User2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

function AdminPage() {
  const { user: authUser, loading: authLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- Auth and Admin Check ---
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      router.replace('/login');
      return;
    }
    if (!db) return;

    const checkAdminStatus = async () => {
      const userDocRef = doc(db, 'users', authUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().username === '@Infinite') {
        setIsAdmin(true);
      } else {
        router.replace('/');
      }
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [authUser, authLoading, db, router]);

  // --- Data Fetching ---
  const usersCollection = useMemo(() => (isAdmin && db ? collection(db, 'users') : null), [isAdmin, db]);
  const chatsCollection = useMemo(() => (isAdmin && db ? collection(db, 'chats') : null), [isAdmin, db]);

  const { data: users, loading: usersLoading } = useCollection<User>(usersCollection);
  const { data: chats, loading: chatsLoading } = useCollection<Chat>(chatsCollection);

  const groups = useMemo(() => chats?.filter(c => c.type === 'group') || [], [chats]);
  const channels = useMemo(() => chats?.filter(c => c.type === 'channel') || [], [chats]);

  // --- Deletion Logic ---
  const handleDeleteChat = async (chatId: string) => {
    if (!db) return;
    const chatRef = doc(db, 'chats', chatId);
    try {
      await deleteDoc(chatRef);
      toast({
        title: 'Success',
        description: `Chat (${chatId}) has been deleted.`,
      });
    } catch (error: any) {
      console.error('Error deleting chat:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not delete the chat.',
      });
    }
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b px-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold font-headline">Admin Panel</h1>
      </header>
      <main className="flex-1 p-4 overflow-hidden">
        <Tabs defaultValue="users" className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Users ({users?.length || 0})</TabsTrigger>
            <TabsTrigger value="groups">Groups ({groups.length || 0})</TabsTrigger>
            <TabsTrigger value="channels">Channels ({channels.length || 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="flex-1 overflow-auto mt-4">
            <ItemList
              items={users}
              loading={usersLoading}
              renderItem={(user: User) => <UserItem key={user.id} user={user} />}
            />
          </TabsContent>
          <TabsContent value="groups" className="flex-1 overflow-auto mt-4">
            <ItemList
              items={groups}
              loading={chatsLoading}
              renderItem={(chat: Chat) => <ChatItem key={chat.id} chat={chat} onDelete={handleDeleteChat} />}
            />
          </TabsContent>
          <TabsContent value="channels" className="flex-1 overflow-auto mt-4">
            <ItemList
              items={channels}
              loading={chatsLoading}
              renderItem={(chat: Chat) => <ChatItem key={chat.id} chat={chat} onDelete={handleDeleteChat} />}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// --- Generic List Component ---
interface ItemListProps<T> {
  items: T[] | null;
  loading: boolean;
  renderItem: (item: T) => React.ReactNode;
}
function ItemList<T>({ items, loading, renderItem }: ItemListProps<T>) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!items || items.length === 0) {
    return <p className="text-center text-muted-foreground">No items found.</p>;
  }
  return <div className="space-y-2">{items.map(renderItem)}</div>;
}

// --- List Item Components ---
function UserItem({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <Avatar>
        <AvatarImage src={user.avatar} />
        <AvatarFallback>{user.name?.charAt(0) || <User2 />}</AvatarFallback>
      </Avatar>
      <div className="flex-1 truncate">
        <p className="font-semibold">{user.name}</p>
        <p className="text-sm text-muted-foreground">{user.username}</p>
      </div>
      <Badge variant={user.status === 'online' ? 'default' : 'secondary'} className={cn(
          user.status === 'online' && 'bg-green-500',
          user.status === 'away' && 'bg-yellow-500',
      )}>
          {user.status}
      </Badge>
    </div>
  );
}

function ChatItem({ chat, onDelete }: { chat: Chat; onDelete: (id: string) => void }) {
  const Icon = chat.type === 'group' ? Users : Megaphone;
  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <Avatar>
        <AvatarFallback>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 truncate">
        <p className="font-semibold">{chat.name}</p>
        <p className="text-sm text-muted-foreground">{chat.members?.length || 0} members</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="icon">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chat "{chat.name}" and all of its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(chat.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminPage;
