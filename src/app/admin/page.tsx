
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, doc, getDoc, deleteDoc, runTransaction, updateDoc, increment, setDoc, serverTimestamp, getDocs, Timestamp, addDoc } from 'firebase/firestore';
import type { User, Chat } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Trash2, Users, Megaphone, MoreVertical, Ban, Coins, Star, Upload, FileJson, Send, MessageSquare, Image as ImageIcon, Pencil, X } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from '@/components/ui/verified-badge';
import { BetaBadge } from '@/components/ui/beta-badge';
import { UserAvatarWithStatus } from '@/components/chat/user-avatar-with-status';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';


function AdminPage() {
  const { user: authUser, loading: authLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();

  // Renaming State
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string, type: 'user' | 'chat', currentVal: string, chatType?: string } | null>(null);
  const [newVal, setNewVal] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Grant Gold State
  const [goldDialogOpen, setGoldDialogOpen] = useState(false);
  const [selectedUserForGold, setSelectedUserForGold] = useState<User | null>(null);
  const [goldAmount, setGoldAmount] = useState('100');

  // Update System State
  const [isUploadingApk, setIsUploadingApk] = useState(false);
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [newVersion, setNewVersion] = useState('0.4.3 Beta');
  const [notifyUpdate, setNotifyUpdate] = useState(true);
  const apkInputRef = useRef<HTMLInputElement>(null);

  // Broadcast State
  const [broadcastText, setBroadcastText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

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

  const handleDeleteChat = async (chatId: string) => {
    if (!db) return;
    const chatRef = doc(db, 'chats', chatId);
    try {
      await deleteDoc(chatRef);
      toast({
        title: t('dm_success'),
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

  const handleGrantGold = async (userId: string, amount: number) => {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, {
        infGoldBalance: increment(amount)
      });
      toast({
        title: t('dm_success'),
        description: `Successfully granted ${amount} InfGold.`,
      });
    } catch (error: any) {
      console.error('Error granting gold:', error);
      toast({
        variant: 'destructive',
        title: t('admin_toast_error_title'),
        description: error.message || "Could not grant InfGold.",
      });
    }
  };

  const handleRename = async () => {
    if (!db || !renameTarget || !newVal.trim() || isRenaming) return;
    
    // Stricter regex for English only (letters, numbers, underscores)
    const englishOnlyRegex = /^[a-zA-Z0-9_]+$/;
    const cleanVal = newVal.trim().replace(/^@/, '').replace(/^\/G\//, '').replace(/^\/C\//, '');
    
    if (!englishOnlyRegex.test(cleanVal)) {
        toast({ variant: 'destructive', title: 'Error', description: 'Only English letters, numbers and underscores allowed.' });
        return;
    }

    setIsRenaming(true);
    try {
        if (renameTarget.type === 'user') {
            const newUsername = '@' + cleanVal;
            const oldUsername = renameTarget.currentVal;
            
            await runTransaction(db, async (tx) => {
                const newUsernameRef = doc(db, 'usernames', newUsername);
                const oldUsernameRef = doc(db, 'usernames', oldUsername);
                const userRef = doc(db, 'users', renameTarget.id);

                const newSnap = await tx.get(newUsernameRef);
                if (newSnap.exists()) throw new Error(t('username_taken_error'));

                tx.update(userRef, { username: newUsername });
                tx.delete(oldUsernameRef);
                tx.set(newUsernameRef, { uid: renameTarget.id });
            });
        } else {
            const prefix = renameTarget.chatType === 'group' ? '/G/' : '/C/';
            const newLink = prefix + cleanVal;
            const oldLink = renameTarget.currentVal;

            await runTransaction(db, async (tx) => {
                const newLinkRef = doc(db, 'chatLinks', encodeURIComponent(newLink));
                const oldLinkRef = doc(db, 'chatLinks', encodeURIComponent(oldLink));
                const chatRef = doc(db, 'chats', renameTarget.id);

                const newSnap = await tx.get(newLinkRef);
                if (newSnap.exists()) throw new Error(t('link_taken'));

                tx.update(chatRef, { link: newLink });
                tx.delete(oldLinkRef);
                tx.set(newLinkRef, { chatId: renameTarget.id });
            });
        }

        toast({ title: t('dm_success') });
        setRenameDialogOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsRenaming(false);
    }
  };

  const handleToggleBetaStatus = async (userId: string, currentStatus: boolean) => {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, {
        isBetaTester: !currentStatus
      });
      toast({
        title: t('dm_success'),
        description: t('profile_update_success'),
      });
    } catch (error: any) {
      console.error('Error toggling beta status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
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
          const usernameDoc = await transaction.get(usernameDocRef);

          transaction.update(userDocRef, {
            name: 'Deleted Account',
            username: `@deleted_${userToBan.id}`,
            avatar: '',
            status: 'offline',
            statusMessage: '',
            isDeleted: true,
          });

          if (usernameDoc.exists()){
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

  const sendBotBroadcast = async (text: string) => {
    if (!db || !text.trim()) return;
    
    try {
        const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/Infinite'));
        const botLinkSnap = await getDoc(botLinkRef);
        if (!botLinkSnap.exists()) throw new Error("Bot link not found");

        const botId = botLinkSnap.data().botId;
        const botUserSnap = await getDoc(doc(db, 'users', botId));
        if (!botUserSnap.exists()) throw new Error("Bot user not found");
        const botData = botUserSnap.data() as User;

        const usersSnap = await getDocs(collection(db, 'users'));
        const targetUsers = usersSnap.docs.filter(d => !d.data().isBot && !d.data().isDeleted);

        let sentCount = 0;
        for (const userDoc of targetUsers) {
            const uid = userDoc.id;
            const members = [uid, botId].sort();
            const chatId = members.join('_');
            const chatRef = doc(db, 'chats', chatId);

            const chatSnap = await getDoc(chatRef);
            if (!chatSnap.exists()) {
                await setDoc(chatRef, {
                    type: 'dm',
                    members: members,
                    unreadCounts: { [uid]: 1 },
                    icon: 'Bot',
                });
            } else {
                await updateDoc(chatRef, { [`unreadCounts.${uid}`]: increment(1) });
            }

            const message = {
                senderId: botId,
                type: 'announcement',
                content: text,
                timestamp: Timestamp.now(),
                senderName: botData.name,
                senderAvatar: botData.avatar || null,
                readBy: []
            };
            const msgRef = await addDoc(collection(db, 'chats', chatId, 'messages'), message);
            await updateDoc(chatRef, { lastMessage: { ...message, id: msgRef.id } });
            sentCount++;
            
            if (sentCount % 5 === 0) await new Promise(r => setTimeout(r, 100));
        }

        return sentCount;
    } catch (e) {
        console.error("Broadcast failed:", e);
        throw e;
    }
  };

  const handleUploadUpdate = async () => {
    if (!db || !apkFile || !newVersion.trim() || isUploadingApk) return;
    setIsUploadingApk(true);

    try {
        const apkBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(apkFile);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
        });

        const CHUNK_SIZE = 900 * 1024;
        const chunkIds: string[] = [];

        for (let i = 0; i < apkBase64.length; i += CHUNK_SIZE) {
            const chunkRef = doc(collection(db, 'apkChunks'));
            await setDoc(chunkRef, {
                data: apkBase64.substring(i, i + CHUNK_SIZE),
                part: i / CHUNK_SIZE,
                timestamp: serverTimestamp(),
            });
            chunkIds.push(chunkRef.id);
            await new Promise(r => setTimeout(r, 50));
        }

        const verRef = doc(db, 'info', 'ver');
        await setDoc(verRef, {
            latest: newVersion.trim(),
            apkChunkIds: chunkIds,
            updatedAt: serverTimestamp(),
        });

        if (notifyUpdate) {
            const updateMsgRu = `Вышло обновление ${newVersion.trim()}! Советуем обновиться, чтобы получить доступ к последним функциям!`;
            await sendBotBroadcast(updateMsgRu);
        }

        toast({ title: t('dm_success'), description: "Update published successfully!" });
        setApkFile(null);
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Upload Failed', description: e.message });
    } finally {
        setIsUploadingApk(false);
    }
  };

  const handleBroadcast = async () => {
      if (!broadcastText.trim() || isBroadcasting) return;
      setIsBroadcasting(true);
      try {
          const count = await sendBotBroadcast(broadcastText);
          toast({ title: t('dm_success'), description: t('admin_broadcast_success', { count }) });
          setBroadcastText('');
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Broadcast Failed', description: e.message });
      } finally {
          setIsBroadcasting(false);
      }
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background overflow-hidden relative">
      <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b px-4 z-20">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold font-headline truncate">{t('admin_panel_title')}</h1>
      </header>
      <main className="flex-1 overflow-hidden p-0 relative">
        <Tabs defaultValue="users" className="flex h-full flex-col">
          <div className="px-4 py-2 bg-background border-b shrink-0">
            <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 bg-transparent p-0">
                <TabsTrigger value="users" className="rounded-full px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t('admin_users_tab')}</TabsTrigger>
                <TabsTrigger value="groups" className="rounded-full px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t('admin_groups_tab')}</TabsTrigger>
                <TabsTrigger value="channels" className="rounded-full px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t('admin_channels_tab')}</TabsTrigger>
                <TabsTrigger value="broadcast" className="rounded-full px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t('admin_broadcast_tab')}</TabsTrigger>
                <TabsTrigger value="update" className="rounded-full px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Update</TabsTrigger>
                <TabsTrigger value="resources" className="rounded-full px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Icon</TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 pb-20">
                <TabsContent value="users" className="mt-0 outline-none">
                    <ItemList
                    items={users}
                    loading={usersLoading}
                    renderItem={(user: User) => (
                        <UserItem 
                        key={user.id} 
                        user={user} 
                        onBan={handleBanUser} 
                        onGrantGold={(u) => { setSelectedUserForGold(u); setGoldDialogOpen(true); }}
                        onToggleBeta={handleToggleBetaStatus}
                        onRename={(u) => { setRenameTarget({ id: u.id, type: 'user', currentVal: u.username }); setNewVal(u.username); setRenameDialogOpen(true); }}
                        />
                    )}
                    />
                </TabsContent>
                <TabsContent value="groups" className="mt-0 outline-none">
                    <ItemList
                    items={groups}
                    loading={chatsLoading}
                    renderItem={(chat: Chat) => <ChatItem key={chat.id} chat={chat} onDelete={handleDeleteChat} onRename={(c) => { setRenameTarget({ id: c.id, type: 'chat', currentVal: c.link || '', chatType: 'group' }); setNewVal(c.link || ''); setRenameDialogOpen(true); }} />}
                    />
                </TabsContent>
                <TabsContent value="channels" className="mt-0 outline-none">
                    <ItemList
                    items={channels}
                    loading={chatsLoading}
                    renderItem={(chat: Chat) => <ChatItem key={chat.id} chat={chat} onDelete={handleDeleteChat} onRename={(c) => { setRenameTarget({ id: c.id, type: 'chat', currentVal: c.link || '', chatType: 'channel' }); setNewVal(c.link || ''); setRenameDialogOpen(true); }} />}
                    />
                </TabsContent>
                <TabsContent value="broadcast" className="mt-0 outline-none">
                    <div className="max-w-md mx-auto space-y-8 p-6 bg-card border rounded-3xl shadow-sm">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold font-headline">{t('admin_broadcast_title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('admin_broadcast_desc')}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('admin_broadcast_label')}</Label>
                                <Textarea 
                                    value={broadcastText} 
                                    onChange={e => setBroadcastText(e.target.value)} 
                                    placeholder="Type broadcast message..." 
                                    className="min-h-[150px] rounded-xl bg-muted/50 border-none"
                                />
                            </div>
                            <Button 
                                className="w-full h-12 rounded-xl font-bold gap-2" 
                                onClick={handleBroadcast} 
                                disabled={!broadcastText.trim() || isBroadcasting}
                            >
                                {isBroadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {t('admin_broadcast_button')}
                            </Button>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="update" className="mt-0 outline-none">
                    <div className="max-w-md mx-auto space-y-8 p-6 bg-card border rounded-3xl shadow-sm">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Upload className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold font-headline">Publish APK Update</h2>
                            <p className="text-sm text-muted-foreground">Upload a new APK version. Users will be notified every 10 launches.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Version Name</Label>
                                <Input value={newVersion} onChange={e => setNewVersion(e.target.value)} placeholder="e.g. 0.4.3 Beta" />
                            </div>
                            <div className="space-y-2">
                                <Label>APK File</Label>
                                <div 
                                    className={cn(
                                        "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all",
                                        apkFile ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
                                    )}
                                    onClick={() => apkInputRef.current?.click()}
                                >
                                    <input type="file" ref={apkInputRef} accept=".apk" className="hidden" onChange={e => e.target.files?.[0] && setApkFile(e.target.files[0])} />
                                    {apkFile ? (
                                        <div className="flex items-center gap-3">
                                            <FileJson className="h-8 w-8 text-primary" />
                                            <div className="text-left">
                                                <p className="font-bold text-sm truncate max-w-[200px]">{apkFile.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{(apkFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground font-medium">Select APK file</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                                <Label className="cursor-pointer">{t('admin_notify_update_label')}</Label>
                                <Switch checked={notifyUpdate} onCheckedChange={setNotifyUpdate} />
                            </div>
                            <Button className="w-full h-12 rounded-xl font-bold" onClick={handleUploadUpdate} disabled={!apkFile || !newVersion.trim() || isUploadingApk}>
                                {isUploadingApk ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Publish Update"}
                            </Button>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="resources" className="mt-0 outline-none">
                    <div className="max-w-md mx-auto space-y-8 p-6 bg-card border rounded-3xl shadow-sm">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <ImageIcon className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold font-headline">Android App Icon Preview</h2>
                        </div>
                        <div className="flex flex-col items-center gap-6 p-10 bg-muted/20 rounded-[2.5rem] border">
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Icon Mockup</div>
                            <div className="w-24 h-24 bg-[#FF8C00] rounded-[1.75rem] shadow-xl flex items-center justify-center border-2 border-white/10 relative overflow-hidden">
                                <div className="absolute inset-0 bg-black/5" />
                                <svg width="72" height="72" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg" className="relative z-10">
                                    <g transform="translate(4, 4)">
                                        <path d="M 25 50 C 25 25, 40 25, 50 50 C 60 75, 75 75, 75 50 C 75 25, 60 25, 50 50 C 40 75, 25 75, 25 50 Z" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" />
                                        <path d="M 20 78 L 10 90 L 25 78" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M 80 22 L 90 10 L 75 22" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                                    </g>
                                </svg>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </main>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="max-w-sm rounded-[2rem]">
            <DialogHeader>
                <DialogTitle>Rename {renameTarget?.type === 'user' ? 'User' : 'Chat'}</DialogTitle>
                <DialogDescription>
                    Enter a new unique identifier. English letters, numbers and underscores only.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label>New Value</Label>
                    <div className="relative">
                        {renameTarget?.type === 'user' ? (
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">@</span>
                        ) : (
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                                {renameTarget?.chatType === 'group' ? '/G/' : '/C/'}
                            </span>
                        )}
                        <Input 
                            value={newVal.replace(/^@/, '').replace(/^\/G\//, '').replace(/^\/C\//, '')} 
                            onChange={e => setNewVal(e.target.value)}
                            className={cn(
                                "rounded-xl h-12 bg-muted/50 border-none font-bold",
                                renameTarget?.type === 'user' ? "pl-7" : "pl-9"
                            )}
                        />
                    </div>
                </div>
            </div>
            <DialogFooter className="flex-col gap-2">
                <Button onClick={handleRename} disabled={isRenaming || !newVal.trim()} className="w-full h-12 rounded-xl font-bold">
                    {isRenaming ? <Loader2 className="animate-spin" /> : "Save Changes"}
                </Button>
                <Button variant="ghost" onClick={() => setRenameDialogOpen(false)} className="w-full h-12 rounded-xl text-muted-foreground">Cancel</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goldDialogOpen} onOpenChange={setGoldDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Grant InfGold</DialogTitle>
            <DialogDescription>
              Enter the amount of InfGold to grant to {selectedUserForGold?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="gold-amount" className="text-right">Amount</Label>
              <Input id="gold-amount" type="number" value={goldAmount} onChange={(e) => setGoldAmount(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoldDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (selectedUserForGold) { handleGrantGold(selectedUserForGold.id, parseInt(goldAmount) || 0); setGoldDialogOpen(false); } }}>Grant Gold</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!items || items.length === 0) return <p className="text-center text-muted-foreground py-8">{t('admin_no_items')}</p>;
  return <div className="space-y-2">{items.map(renderItem)}</div>;
}

// --- List Item Components ---
function UserItem({ user, onBan, onGrantGold, onToggleBeta, onRename }: { user: User; onBan: (user: User) => void; onGrantGold: (user: User) => void; onToggleBeta: (userId: string, current: boolean) => void; onRename: (user: User) => void; }) {
  const isProtectedUser = user.username === '@Infinite' || user.username === '@InfiniteBot';
  const { t } = useLanguage();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const displayName = user.isDeleted ? t('deleted_account') : user.name;
  const displayUsername = user.isDeleted ? '' : user.username;

  return (
    <div className="flex items-center gap-4 rounded-xl border p-3 bg-card/50">
      <UserAvatarWithStatus user={user} />
      <div className="flex-1 truncate">
        <div className="font-semibold flex items-center gap-2">
            {displayName} 
            {isProtectedUser && !user.isDeleted && <VerifiedBadge />}
            {user.subscriptionTier === 'prem' && user.showPremBadge && !user.isDeleted && <VerifiedBadge className="bg-purple-500" />}
            {user.isBetaTester && !isProtectedUser && !user.isDeleted && <BetaBadge />}
        </div>
        <p className="text-sm text-muted-foreground">{displayUsername}</p>
      </div>
      {!user.isDeleted && (
        <div className="flex flex-col items-end gap-1">
          <Badge variant={user.status === 'online' ? 'default' : 'secondary'} className={cn(user.status === 'online' && 'bg-green-500', user.status === 'away' && 'bg-yellow-500')}>
              {user.status}
          </Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
            <Coins className="h-3 w-3" />
            <span>{user.infGoldBalance || 0}</span>
          </div>
        </div>
      )}
       
      <div className="flex items-center gap-2">
        {!user.isDeleted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onRename(user)}><Pencil className="mr-2 h-4 w-4" /><span>Rename Handle</span></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onGrantGold(user)}><Coins className="mr-2 h-4 w-4" /><span>Grant InfGold</span></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onToggleBeta(user.id, !!user.isBetaTester)}><Star className="mr-2 h-4 w-4" /><span>{t('admin_toggle_beta')}</span></DropdownMenuItem>
              {!isProtectedUser && (
                <DropdownMenuItem onSelect={() => setDeleteDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Ban className="mr-2 h-4 w-4" /><span>{t('admin_ban_user_button')}</span></DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t('admin_ban_user_confirm_desc', { name: user.name, username: user.username })}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => { onBan(user); setDeleteDialogOpen(false); }} className={cn(buttonVariants({ variant: "destructive" }), "rounded-xl")}>{t('admin_ban_user_button')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChatItem({ chat, onDelete, onRename }: { chat: Chat; onDelete: (id: string) => void; onRename: (chat: Chat) => void; }) {
  const Icon = chat.type === 'group' ? Users : Megaphone;
  const { t } = useLanguage();
  const isVerifiedChat = chat.link === '/G/Infinite' || chat.link === '/C/Infinite';
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  return (
    <div className="flex items-center gap-4 rounded-xl border p-3 bg-card/50">
      <Avatar>{chat.avatar ? <AvatarImage src={chat.avatar} alt={chat.name} /> : <AvatarFallback><Icon className="h-5 w-5 text-muted-foreground" /></AvatarFallback>}</Avatar>
      <div className="flex-1 truncate">
        <div className="font-semibold flex items-center gap-2">{chat.name}{isVerifiedChat && <VerifiedBadge />}</div>
        <p className="text-sm text-muted-foreground">{t(chat.type === 'channel' ? 'subscribers_count' : 'members_count', { count: chat.members?.length || 0 })}</p>
        {chat.link && <p className="text-xs text-muted-foreground truncate">{chat.link}</p>}
      </div>
      
      {!isVerifiedChat && chat.id !== 'GENERAL_CHAT' && (
        <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onSelect={() => onRename(chat)}><Pencil className="mr-2 h-4 w-4" /><span>Rename Link</span></DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeleteDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /><span>{t('delete')}</span></DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t('admin_delete_chat_confirm_desc', { name: chat.name })}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => {onDelete(chat.id); setDeleteDialogOpen(false); }} className={cn(buttonVariants({ variant: "destructive" }), "rounded-xl")}>{t('delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminPage;
