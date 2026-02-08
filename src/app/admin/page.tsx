'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, doc, getDoc, deleteDoc, runTransaction, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { User, Chat, Message } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Trash2, Users, Megaphone, User2, MoreVertical, Bot, Ban } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateUserReport } from '@/ai/flows/generate-user-report-flow';
import { UserAvatarWithStatus } from '@/components/chat/user-avatar-with-status';


function AdminPage() {
  const { user: authUser, loading: authLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [reportingUser, setReportingUser] = useState<User | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

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

  // --- Action Logic ---
  
  const handleGenerateReport = async (userToReport: User) => {
    if (!db) return;
    setIsGeneratingReport(true);
    setReportingUser(userToReport);
    
    try {
        const messagesRef = collection(db, 'chats', 'GENERAL_CHAT', 'messages');
        const q = query(messagesRef, where('senderId', '==', userToReport.id), orderBy('timestamp', 'desc'), limit(30));
        const querySnapshot = await getDocs(q);
        
        const messages = querySnapshot.docs.map(doc => {
            const data = doc.data() as Message;
            return {
                content: data.content || '',
                imageUrl: data.imageUrl,
            };
        });

        if (messages.length === 0) {
            setReportContent('Не найдено сообщений пользователя в общем чате для анализа.');
            setReportDialogOpen(true);
            setIsGeneratingReport(false);
            setReportingUser(null);
            return;
        }

        const { report } = await generateUserReport({
            userName: userToReport.name,
            userUsername: userToReport.username,
            messages: messages,
        });
        setReportContent(report);
        setReportDialogOpen(true);
    } catch (error) {
        console.error("Error generating AI report:", error);
        toast({
            variant: "destructive",
            title: t('admin_toast_error_title'),
            description: t('ai_report_failed'),
        });
    } finally {
        setIsGeneratingReport(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!db) return;
    const chatRef = doc(db, 'chats', chatId);
    try {
      await deleteDoc(chatRef);
      toast({
        title: t('admin_toast_success_title'),
        description: t('admin_toast_chat_deleted_desc', { chatId }),
      });
    } catch (error: any) {
      console.error('Error deleting chat:', error);
      toast({
        variant: 'destructive',
        title: t('admin_toast_error_title'),
        description: error.message || t('admin_toast_delete_chat_error_desc'),
      });
    }
  };

  const handleBanUser = async (userToBan: User) => {
    if (!db || !userToBan.id || !userToBan.username) {
        toast({
            variant: 'destructive',
            title: t('admin_toast_error_title'),
            description: t('admin_toast_delete_user_no_username_desc'),
        });
        return;
    }
    if (userToBan.username === '@Infinite' || userToBan.username === '@InfiniteBot') {
        toast({
            variant: 'destructive',
            title: t('admin_toast_action_not_allowed_title'),
            description: t('admin_toast_cannot_delete_admin_desc'),
        });
        return;
    }

    const userDocRef = doc(db, 'users', userToBan.id);
    const usernameDocRef = doc(db, 'usernames', userToBan.username);

    try {
      await runTransaction(db, async (transaction) => {
          transaction.update(userDocRef, {
            name: 'Deleted Account',
            username: `@deleted_${userToBan.id}`,
            avatar: '',
            status: 'offline',
            statusMessage: '',
            isDeleted: true,
          });
          if ((await transaction.get(usernameDocRef)).exists()){
            transaction.delete(usernameDocRef);
          }
      });
      toast({
        title: t('admin_toast_user_banned_title'),
        description: t('admin_toast_user_banned_desc', { name: userToBan.name, username: userToBan.username }),
      });
    } catch (error: any) {
      console.error('Error banning user:', error);
      toast({
        variant: 'destructive',
        title: t('admin_toast_error_title'),
        description: error.message || t('admin_toast_ban_user_error_desc'),
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
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold font-headline">{t('admin_panel_title')}</h1>
      </header>
      <main className="flex-1 p-4 overflow-hidden">
        <Tabs defaultValue="users" className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">{t('admin_users_tab')} ({users?.length || 0})</TabsTrigger>
            <TabsTrigger value="groups">{t('admin_groups_tab')} ({groups.length || 0})</TabsTrigger>
            <TabsTrigger value="channels">{t('admin_channels_tab')} ({channels.length || 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="flex-1 overflow-auto mt-4">
            <ItemList
              items={users}
              loading={usersLoading}
              renderItem={(user: User) => <UserItem key={user.id} user={user} onBan={handleBanUser} onGenerateReport={handleGenerateReport} isGenerating={isGeneratingReport} isCurrentUserReport={reportingUser?.id === user.id} />}
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
      
      <AlertDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ai_report_title', { username: reportingUser?.name || '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('ai_report_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none max-h-[60vh] overflow-y-auto p-1 rounded-md border">
            <ReactMarkdown remarkPlugins={[remarkGfm]} className="p-4">
              {reportContent}
            </ReactMarkdown>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setReportDialogOpen(false); setReportingUser(null); }}>{t('ok')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  const { t } = useLanguage();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!items || items.length === 0) {
    return <p className="text-center text-muted-foreground">{t('admin_no_items')}</p>;
  }
  return <div className="space-y-2">{items.map(renderItem)}</div>;
}

// --- List Item Components ---
function UserItem({ user, onBan, onGenerateReport, isGenerating, isCurrentUserReport }: { user: User; onBan: (user: User) => void; onGenerateReport: (user: User) => void; isGenerating: boolean; isCurrentUserReport: boolean; }) {
  const isProtectedUser = user.username === '@Infinite' || user.username === '@InfiniteBot';
  const { t } = useLanguage();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const displayName = user.isDeleted ? t('deleted_account') : user.name;
  const displayUsername = user.isDeleted ? '' : user.username;

  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <UserAvatarWithStatus user={user} />
      <div className="flex-1 truncate">
        <div className="font-semibold flex items-center gap-2">
            {displayName} {isProtectedUser && !user.isDeleted && <VerifiedBadge />}
        </div>
        <p className="text-sm text-muted-foreground">{displayUsername}</p>
      </div>
      {!user.isDeleted && (
        <Badge variant={user.status === 'online' ? 'default' : 'secondary'} className={cn(
            user.status === 'online' && 'bg-green-500',
            user.status === 'away' && 'bg-yellow-500',
        )}>
            {user.status}
        </Badge>
      )}
       
      <div className="flex items-center gap-2">
        {isCurrentUserReport && <Loader2 className="h-4 w-4 animate-spin" />}
        {!isProtectedUser && !user.isDeleted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isGenerating}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onGenerateReport(user)} disabled={isGenerating}>
                <Bot className="mr-2 h-4 w-4" />
                <span>{t('admin_ai_report_exp')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDeleteDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Ban className="mr-2 h-4 w-4" />
                <span>{t('admin_ban_user_button')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
            <AlertDialogDescription>
            {t('admin_ban_user_confirm_desc', { name: user.name, username: user.username })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onBan(user); setDeleteDialogOpen(false); }} className={cn(buttonVariants({ variant: "destructive" }))}>
            {t('admin_ban_user_button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChatItem({ chat, onDelete }: { chat: Chat; onDelete: (id: string) => void }) {
  const Icon = chat.type === 'group' ? Users : Megaphone;
  const { t } = useLanguage();
  const isVerifiedChat = chat.link === '/G/Infinite' || chat.link === '/C/Infinite';
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <Avatar>
         {chat.avatar ? (
          <AvatarImage src={chat.avatar} alt={chat.name} />
        ) : (
          <AvatarFallback>
            <Icon className="h-5 w-5 text-muted-foreground" />
          </AvatarFallback>
        )}
      </Avatar>
      <div className="flex-1 truncate">
        <div className="font-semibold flex items-center gap-2">
          {chat.name}
          {isVerifiedChat && <VerifiedBadge />}
        </div>
        <p className="text-sm text-muted-foreground">{t(chat.type === 'channel' ? 'subscribers_count' : 'members_count', { count: chat.members?.length || 0 })}</p>
        {chat.link && <p className="text-xs text-muted-foreground truncate">{chat.link}</p>}
      </div>
      
      {!isVerifiedChat && (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDeleteDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>{t('delete')}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin_delete_chat_confirm_desc', { name: chat.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {onDelete(chat.id); setDeleteDialogOpen(false); }} className={cn(buttonVariants({ variant: "destructive" }))}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminPage;
