'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, doc, getDoc, deleteDoc, runTransaction, updateDoc, increment, setDoc, serverTimestamp, getDocs, Timestamp, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import type { User, Chat, Message } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Trash2, Users, Megaphone, MoreVertical, Ban, Coins, Star, Upload, FileJson, Send, MessageSquare, Image as ImageIcon, Pencil, X, Sparkles, Terminal, Copy, Palette, ShieldCheck, FileSearch } from 'lucide-react';
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
import { generateUserReport } from '@/ai/flows/generate-user-report-flow';


function AdminPage() {
  const { user: authUser, loading: authLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();

  // AI Report State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

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
  const [newVersion, setNewVersion] = useState('0.6.1 Beta');
  const [isClosedBeta, setIsClosedBeta] = useState(true);
  const [notifyUpdate, setNotifyUpdate] = useState(true);
  const apkInputRef = useRef<HTMLInputElement>(null);

  // Branding State
  const [remoteIconBase64, setRemoteIconBase64] = useState('');
  const [isUpdatingBranding, setIsUpdatingBranding] = useState(false);

  // Broadcast State
  const [broadcastText, setBroadcastText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Build Log Scanner State
  const [buildLog, setBuildLog] = useState('');
  const [extractedLibrary, setExtractedLibrary] = useState<string | null>(null);

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
      toast({ title: t('dm_success') });
    } catch (error: any) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleGenerateReport = async (user: User) => {
    if (!db) return;
    setIsGeneratingReport(true);
    try {
        // Deep Analysis: Collect recent messages from accessible chats
        const messages: string[] = [];
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('members', 'array-contains', user.id), limit(10));
        const chatsSnap = await getDocs(q);
        
        for (const chatDoc of chatsSnap.docs) {
            const msgsRef = collection(db, 'chats', chatDoc.id, 'messages');
            const mq = query(msgsRef, where('senderId', '==', user.id), orderBy('timestamp', 'desc'), limit(5));
            const msgsSnap = await getDocs(mq);
            msgsSnap.forEach(m => {
                const data = m.data();
                if (data.content) messages.push(data.content);
            });
        }

        const { report } = await generateUserReport({
            name: user.name,
            username: user.username,
            statusMessage: user.statusMessage,
            infGold: user.infGoldBalance,
            tier: user.subscriptionTier,
            recentMessages: messages
        });
        setAiReport(report);
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'AI Error', description: 'Failed to generate report. Make sure Genkit is configured.' });
    } finally {
        setIsGeneratingReport(false);
    }
  };

  const handleGrantGold = async (userId: string, amount: number) => {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, {
        infGoldBalance: increment(amount)
      });
      toast({ title: t('dm_success'), description: `Granted ${amount} InfGold.` });
    } catch (error: any) {
      console.error('Error granting gold:', error);
    }
  };

  const handleRename = async () => {
    if (!db || !renameTarget || !newVal.trim() || isRenaming) return;
    setIsRenaming(true);
    try {
        if (renameTarget.type === 'user') {
            const newUsername = newVal.trim().startsWith('@') ? newVal.trim() : '@' + newVal.trim();
            await runTransaction(db, async (tx) => {
                tx.update(doc(db, 'users', renameTarget.id), { username: newUsername });
                tx.set(doc(db, 'usernames', newUsername), { uid: renameTarget.id });
                tx.delete(doc(db, 'usernames', renameTarget.currentVal));
            });
        } else {
            const prefix = renameTarget.chatType === 'group' ? '/G/' : '/C/';
            const newLink = newVal.trim().startsWith('/') ? newVal.trim() : prefix + newVal.trim();
            await runTransaction(db, async (tx) => {
                tx.update(doc(db, 'chats', renameTarget.id), { link: newLink });
                tx.set(doc(db, 'chatLinks', encodeURIComponent(newLink)), { chatId: renameTarget.id });
                tx.delete(doc(db, 'chatLinks', encodeURIComponent(renameTarget.currentVal)));
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

  const handleScanLog = () => {
      const regex = /declared in library \[(.*?)\]/i;
      const match = buildLog.match(regex);
      if (match && match[1]) {
          const packagePart = match[1].split(':')[0];
          setExtractedLibrary(packagePart);
      } else {
          setExtractedLibrary(null);
          toast({ variant: 'destructive', title: 'Scan Failed', description: 'Could not find library coordinates in the log.' });
      }
  };

  const handleToggleBetaStatus = async (userId: string, currentStatus: boolean) => {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, { isBetaTester: !currentStatus });
      toast({ title: t('dm_success') });
    } catch (error: any) {
      console.error('Error toggling beta status:', error);
    }
  };

  const handleUpdateBranding = async () => {
    if (!db || !remoteIconBase64) return;
    setIsUpdatingBranding(true);
    try {
        const configRef = doc(db, 'info', 'ver');
        await updateDoc(configRef, { appIcon: remoteIconBase64, appIconType: 'image' });
        toast({ title: t('dm_success'), description: "App icon updated globally!" });
        setRemoteIconBase64('');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsUpdatingBranding(false);
    }
  };

  const handleBanUser = async (userToBan: User) => {
    if (!db || !userToBan.id || !userToBan.username) return;
    try {
      await runTransaction(db, async (transaction) => {
          transaction.update(doc(db, 'users', userToBan.id), {
            name: 'Deleted Account',
            username: `@deleted_${userToBan.id}`,
            avatar: '',
            status: 'offline',
            isDeleted: true,
          });
          transaction.delete(doc(db, 'usernames', userToBan.username));
      });
      toast({ title: t('admin_toast_user_banned_title') });
    } catch (error: any) {
      console.error('Error banning user:', error);
    }
  };

  const sendBotBroadcast = async (text: string) => {
    if (!db || !text.trim()) return;
    try {
        const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/Infinite'));
        const botLinkSnap = await getDoc(botLinkRef);
        if (!botLinkSnap.exists()) return 0;

        const botId = botLinkSnap.data().botId;
        const usersSnap = await getDocs(collection(db, 'users'));
        const targetUsers = usersSnap.docs.filter(d => !d.data().isBot && !d.data().isDeleted);

        let sentCount = 0;
        for (const userDoc of targetUsers) {
            const uid = userDoc.id;
            const members = [uid, botId].sort();
            const chatId = members.join('_');
            const message = {
                senderId: botId,
                type: 'announcement',
                content: text,
                timestamp: Timestamp.now(),
                readBy: []
            };
            await addDoc(collection(db, 'chats', chatId, 'messages'), message);
            await setDoc(doc(db, 'chats', chatId), { type: 'dm', members: members, lastMessage: { ...message, id: 'last' } }, { merge: true });
            sentCount++;
            if (sentCount % 5 === 0) await new Promise(r => setTimeout(r, 100));
        }
        return sentCount;
    } catch (e) {
        console.error("Bot broadcast failed:", e);
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
            await setDoc(chunkRef, { data: apkBase64.substring(i, i + CHUNK_SIZE), part: i / CHUNK_SIZE, timestamp: serverTimestamp() });
            chunkIds.push(chunkRef.id);
            await new Promise(r => setTimeout(r, 50));
        }
        const verRef = doc(db, 'info', 'ver');
        
        const updateData: any = { 
            apkChunkIds: chunkIds, 
            updatedAt: serverTimestamp() 
        };

        if (isClosedBeta) {
            updateData.latestClosedBeta = newVersion.trim();
        } else {
            updateData.latest = newVersion.trim();
        }

        await updateDoc(verRef, updateData);

        if (notifyUpdate) {
            const targetAudience = isClosedBeta ? "бета-тестеров" : "всех пользователей";
            await sendBotBroadcast(`Вышло обновление ${newVersion.trim()} для ${targetAudience}! Рекомендуем обновиться.`);
        }
        toast({ title: t('dm_success'), description: "Update published!" });
        setApkFile(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: e.message });
    } finally {
        setIsUploadingApk(false);
    }
  };

  if (isLoading || !isAdmin) {
    return <div className="flex h-svh items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex h-svh flex-col bg-background overflow-hidden relative">
      <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b px-4 z-20">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
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
                <TabsTrigger value="update" className="rounded-full px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t('admin_system_tab')}</TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 pb-20 space-y-8">
                <TabsContent value="users" className="mt-0 outline-none">
                    <ItemList items={users} loading={usersLoading} renderItem={(user: User) => (
                        <UserItem 
                          key={user.id} 
                          user={user} 
                          onBan={handleBanUser} 
                          onGrantGold={(u) => { setSelectedUserForGold(u); setGoldDialogOpen(true); }} 
                          onToggleBeta={handleToggleBetaStatus} 
                          onRename={(u) => { setRenameTarget({ id: u.id, type: 'user', currentVal: u.username }); setNewVal(u.username); setRenameDialogOpen(true); }}
                          onReport={handleGenerateReport}
                        />
                    )} />
                </TabsContent>
                <TabsContent value="groups" className="mt-0 outline-none">
                    <ItemList items={groups} loading={chatsLoading} renderItem={(chat: Chat) => <ChatItem key={chat.id} chat={chat} onDelete={handleDeleteChat} onRename={(c) => { setRenameTarget({ id: c.id, type: 'chat', currentVal: c.link || '', chatType: 'group' }); setNewVal(c.link || ''); setRenameDialogOpen(true); }} />} />
                </TabsContent>
                <TabsContent value="channels" className="mt-0 outline-none">
                    <ItemList items={channels} loading={chatsLoading} renderItem={(chat: Chat) => <ChatItem key={chat.id} chat={chat} onDelete={handleDeleteChat} onRename={(c) => { setRenameTarget({ id: c.id, type: 'chat', currentVal: c.link || '', chatType: 'channel' }); setNewVal(c.link || ''); setRenameDialogOpen(true); }} />} />
                </TabsContent>
                <TabsContent value="broadcast" className="mt-0 outline-none">
                    <div className="max-w-md mx-auto space-y-6 p-6 bg-card border rounded-3xl">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold font-headline">{t('admin_broadcast_title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('admin_broadcast_desc')}</p>
                        </div>
                        <Textarea value={broadcastText} onChange={e => setBroadcastText(e.target.value)} placeholder="Type broadcast message..." className="min-h-[150px] rounded-xl bg-muted/50 border-none" />
                        <Button className="w-full h-12 rounded-xl font-bold" onClick={async () => { setIsBroadcasting(true); const c = await sendBotBroadcast(broadcastText); toast({ title: t('dm_success'), description: t('admin_broadcast_success', { count: c }) }); setBroadcastText(''); setIsBroadcasting(false); }} disabled={!broadcastText.trim() || isBroadcasting}>
                            {isBroadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                            {t('admin_broadcast_button')}
                        </Button>
                    </div>
                </TabsContent>
                <TabsContent value="update" className="mt-0 outline-none space-y-6">
                    <div className="max-w-md mx-auto space-y-6 p-6 bg-card border rounded-3xl">
                        <h2 className="text-xl font-bold font-headline flex items-center gap-2">
                            <Palette className="h-5 w-5 text-primary" /> Branding
                        </h2>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Remote App Icon (Base64 or URL)</Label>
                                <Textarea 
                                    value={remoteIconBase64} 
                                    onChange={e => setRemoteIconBase64(e.target.value)} 
                                    placeholder="data:image/png;base64,..." 
                                    className="min-h-[100px] text-[10px] font-mono"
                                />
                            </div>
                            <Button className="w-full" onClick={handleUpdateBranding} disabled={!remoteIconBase64.trim() || isUpdatingBranding}>
                                {isUpdatingBranding ? <Loader2 className="animate-spin h-4 w-4" /> : "Update Global Icon"}
                            </Button>
                        </div>
                    </div>

                    <div className="max-w-md mx-auto space-y-6 p-6 bg-card border rounded-3xl">
                        <h2 className="text-xl font-bold font-headline">Legacy Build Helper</h2>
                        <p className="text-xs text-muted-foreground">Paste Build Log error about minSdkVersion mismatch to extract the library package name.</p>
                        <Textarea value={buildLog} onChange={e => setBuildLog(e.target.value)} placeholder="uses-sdk:minSdkVersion 16 cannot be smaller than version 21 declared in library [androidx.annotation:annotation-experimental:1.4.1] ..." className="min-h-[100px] text-[10px] font-mono" />
                        <Button variant="outline" className="w-full" onClick={handleScanLog}><Terminal className="mr-2 h-4 w-4" /> Scan Build Log</Button>
                        {extractedLibrary && (
                            <div className="p-3 bg-muted rounded-xl flex items-center justify-between gap-4">
                                <code className="text-xs font-bold text-primary truncate">{extractedLibrary}</code>
                                <Button size="sm" onClick={() => { navigator.clipboard.writeText(extractedLibrary); toast({ title: 'Copied!' }); }}><Copy className="h-3 w-3" /></Button>
                            </div>
                        )}
                    </div>
                    
                    <div className="max-w-md mx-auto space-y-6 p-6 bg-card border rounded-3xl">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold font-headline">Publish APK Update</h2>
                            <p className="text-sm text-muted-foreground">Upload a new APK version for all editions.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Version Name</Label>
                                <Input value={newVersion} onChange={e => setNewVersion(e.target.value)} placeholder="e.g. 0.6.1 Beta" />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    <Label className="font-bold">Closed Beta Only</Label>
                                </div>
                                <Switch checked={isClosedBeta} onCheckedChange={setIsClosedBeta} />
                            </div>

                            <div className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer" onClick={() => apkInputRef.current?.click()}>
                                <input type="file" ref={apkInputRef} accept=".apk" className="hidden" onChange={e => e.target.files?.[0] && setApkFile(e.target.files[0])} />
                                {apkFile ? <div className="text-center"><FileJson className="h-8 w-8 text-primary mx-auto mb-2" /><p className="font-bold text-sm truncate max-w-[200px]">{apkFile.name}</p></div> : <p className="text-sm text-muted-foreground">Select APK file</p>}
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                                <Label>Notify users via Bot</Label>
                                <Switch checked={notifyUpdate} onCheckedChange={setNotifyUpdate} />
                            </div>
                            <Button className="w-full h-12 rounded-xl font-bold" onClick={handleUploadUpdate} disabled={!apkFile || isUploadingApk}>
                                {isUploadingApk ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Publish Update"}
                            </Button>
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
            </DialogHeader>
            <div className="py-4"><Input value={newVal} onChange={e => setNewVal(e.target.value)} className="rounded-xl h-12 bg-muted/50 border-none font-bold" /></div>
            <DialogFooter className="flex-col gap-2">
                <Button onClick={handleRename} disabled={isRenaming || !newVal.trim()} className="w-full h-12 rounded-xl font-bold">{isRenaming ? <Loader2 className="animate-spin" /> : "Save Changes"}</Button>
                <Button variant="ghost" onClick={() => setRenameDialogOpen(false)} className="w-full h-12 rounded-xl">Cancel</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goldDialogOpen} onOpenChange={setGoldDialogOpen}>
        <DialogContent className="max-w-sm rounded-[2rem]">
          <DialogHeader><DialogTitle>Grant InfGold</DialogTitle></DialogHeader>
          <div className="py-4"><Input type="number" value={goldAmount} onChange={(e) => setGoldAmount(e.target.value)} className="rounded-xl h-12" /></div>
          <DialogFooter className="flex-col gap-2">
            <Button onClick={() => { if (selectedUserForGold) { handleGrantGold(selectedUserForGold.id, parseInt(goldAmount) || 0); setGoldDialogOpen(false); } }} className="w-full h-12 rounded-xl font-bold">Grant Gold</Button>
            <Button variant="ghost" onClick={() => setGoldDialogOpen(false)} className="w-full h-12 rounded-xl">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!aiReport} onOpenChange={(o) => !o && setAiReport(null)}>
        <DialogContent className="max-w-sm rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-primary/10 border-b">
                <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> ИИ-Донос</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
                <div className="p-8"><p className="text-sm italic leading-relaxed text-muted-foreground whitespace-pre-wrap">"{aiReport}"</p></div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-0"><Button onClick={() => setAiReport(null)} className="w-full rounded-xl font-bold">Закрыть</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ItemListProps<T> { items: T[] | null; loading: boolean; renderItem: (item: T) => React.ReactNode; }
function ItemList<T>({ items, loading, renderItem }: ItemListProps<T>) {
  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!items || items.length === 0) return <p className="text-center text-muted-foreground py-8">No items found.</p>;
  return <div className="space-y-2">{items.map(renderItem)}</div>;
}

function UserItem({ user, onBan, onGrantGold, onToggleBeta, onRename, onReport }: { user: User; onBan: (user: User) => void; onGrantGold: (user: User) => void; onToggleBeta: (userId: string, current: boolean) => void; onRename: (user: User) => void; onReport: (user: User) => void; }) {
  const isProtectedUser = user.username === '@Infinite' || user.username === '@InfiniteBot';
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-4 rounded-xl border p-3 bg-card/50">
      <UserAvatarWithStatus user={user} />
      <div className="flex-1 truncate">
        <div className="font-semibold flex items-center gap-2">{user.isDeleted ? t('deleted_account') : user.name} {isProtectedUser && <VerifiedBadge />}</div>
        <p className="text-sm text-muted-foreground">{user.username}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl p-1">
          <DropdownMenuItem onSelect={() => onReport(user)} className="font-bold h-11 rounded-lg focus:bg-primary/10">
            <Sparkles className="h-4 w-4 mr-3 text-primary" /> ИИ-Донос
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onRename(user)}>Rename Handle</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onGrantGold(user)}>Grant Gold</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onToggleBeta(user.id, !!user.isBetaTester)}>Toggle Beta</DropdownMenuItem>
          {!isProtectedUser && <DropdownMenuItem onSelect={() => onBan(user)} className="text-destructive">Ban User</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ChatItem({ chat, onDelete, onRename }: { chat: Chat; onDelete: (id: string) => void; onRename: (chat: Chat) => void; }) {
  const Icon = chat.type === 'group' ? Users : Megaphone;
  return (
    <div className="flex items-center gap-4 rounded-xl border p-3 bg-card/50">
      <Avatar><AvatarFallback><Icon className="h-5 w-5" /></AvatarFallback></Avatar>
      <div className="flex-1 truncate"><div className="font-semibold">{chat.name}</div><p className="text-xs text-muted-foreground">{chat.link}</p></div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onRename(chat)}>Rename Link</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDelete(chat.id)} className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default AdminPage;
