
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, doc, setDoc, deleteDoc, Timestamp, runTransaction, updateDoc } from 'firebase/firestore';
import type { AuthenticatedUser, CustomBot } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Cpu, Plus, ArrowLeft, Loader2, Bot, Pencil, Trash2, Play, Pause, ChevronRight, Code2, Ghost, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BotEditor } from './bot-editor';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';

export function BotStudioView({ currentUser, onClose }: { currentUser: AuthenticatedUser, onClose: () => void }) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const { theme: colorTheme } = useTheme();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotHandle, setNewBotHandle] = useState('');
  const [selectedBot, setSelectedBot] = useState<CustomBot | null>(null);

  const botsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'customBots'), where('ownerId', '==', currentUser.uid));
  }, [db, currentUser.uid]);

  const { data: myBots, loading } = useCollection<CustomBot>(botsQuery);

  // --- System Back Button Support ---
  useEffect(() => {
    const handleSystemBack = () => {
      if (selectedBot) {
        setSelectedBot(null);
      } else if (isCreateOpen) {
        setIsCreateOpen(false);
      } else {
        onClose();
      }
    };

    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        backListener = App.addListener('backButton', handleSystemBack);
      });
    }

    return () => {
      if (backListener) {
        backListener.then((l: any) => l.remove());
      }
    };
  }, [selectedBot, isCreateOpen, onClose]);

  const handleCreateBot = async () => {
    if (!db || !newBotName.trim() || !newBotHandle.trim()) return;

    const englishOnlyRegex = /^[a-zA-Z0-9_]+$/;
    const cleanHandle = newBotHandle.replace('@', '').trim();

    if (!englishOnlyRegex.test(cleanHandle)) {
        toast({ variant: 'destructive', title: 'Error', description: 'Bot handle must contain only English letters, numbers and underscores.' });
        return;
    }

    setIsCreating(true);
    const fullHandle = '@' + cleanHandle;

    try {
        await runTransaction(db, async (transaction) => {
            const usernameRef = doc(db, 'usernames', fullHandle);
            const userSnap = await transaction.get(usernameRef);
            if (userSnap.exists()) {
                throw new Error(t('username_taken_error'));
            }

            const botId = doc(collection(db, 'users')).id;
            const botUserRef = doc(db, 'users', botId);
            const botStudioRef = doc(db, 'customBots', botId);
            const botLinkRef = doc(db, 'botLinks', encodeURIComponent('/B/' + fullHandle.substring(1)));

            const botData: CustomBot = {
                id: botId,
                name: newBotName.trim(),
                username: fullHandle,
                ownerId: currentUser.uid,
                scripts: [],
                isActive: true,
                createdAt: Timestamp.now(),
            };

            transaction.set(botStudioRef, botData);
            transaction.set(botUserRef, {
                id: botId,
                name: botData.name,
                username: botData.username,
                isBot: true,
                isCustomBot: true,
                botOwnerId: currentUser.uid,
                status: 'online',
                statusMessage: 'Custom bot created with Bot Studio.',
            });
            transaction.set(usernameRef, { uid: botId });
            transaction.set(botLinkRef, { botId: botId });
        });

        toast({ title: t('dm_success') });
        setIsCreateOpen(false);
        setNewBotName('');
        setNewBotHandle('');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsCreating(false);
    }
  };

  const handleToggleActive = async (bot: CustomBot) => {
    if (!db) return;
    try {
        await updateDoc(doc(db, 'customBots', bot.id), { isActive: !bot.isActive });
    } catch (e) { console.error(e); }
  };

  const handleDeleteBot = async (bot: CustomBot) => {
    if (!db || !window.confirm(t('delete_chat_confirm'))) return;
    try {
        await deleteDoc(doc(db, 'customBots', bot.id));
        await deleteDoc(doc(db, 'users', bot.id));
        await deleteDoc(doc(db, 'usernames', bot.username));
        toast({ title: t('dm_success') });
    } catch (e) { console.error(e); }
  };

  if (selectedBot) {
      return <BotEditor bot={selectedBot} onBack={() => setSelectedBot(null)} />;
  }

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      <header className={cn(
          "flex-shrink-0 flex items-center p-4 border-b z-20 pt-[calc(1rem+env(safe-area-inset-top))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]",
          colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background/95 backdrop-blur-md'
      )}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 overflow-hidden">
                <Cpu className="h-7 w-7 text-primary shrink-0" />
                <h1 className="text-xl font-bold font-headline truncate">{t('bot_studio_title')}</h1>
            </div>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-full gap-2 font-bold shadow-lg shadow-primary/20 h-10 px-4 shrink-0">
            <Plus className="h-4 w-4" />
            <span>{t('create_bot')}</span>
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="w-full mx-auto p-4 md:p-8 bg-muted/5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="bg-primary/10 rounded-3xl p-8 border border-primary/20 flex flex-col md:flex-row items-center gap-8 shadow-inner animate-in fade-in zoom-in duration-500 mb-8 w-full">
                <div className="w-20 h-20 rounded-[2rem] bg-background flex items-center justify-center shadow-xl shrink-0">
                    <Code2 className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center md:text-left space-y-2 flex-1">
                    <h2 className="text-2xl font-black font-headline text-primary">{t('bot_studio_title')}</h2>
                    <p className="text-muted-foreground">{t('bot_studio_desc')}</p>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">{t('my_bots')}</h3>
                
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
                ) : myBots && myBots.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myBots.map(bot => (
                            <Card key={bot.id} className="rounded-3xl border-none shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden bg-card">
                                <CardHeader className="flex flex-row items-center gap-4 pb-4">
                                    <Avatar className="w-14 h-14 rounded-2xl border bg-muted flex items-center justify-center shrink-0">
                                        <AvatarImage src={bot.avatar} />
                                        <AvatarFallback><Bot className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" /></AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate font-bold text-lg">{bot.name}</CardTitle>
                                        <CardDescription className="truncate font-medium">{bot.username}</CardDescription>
                                        <p className="text-[10px] text-primary font-bold">/B/{bot.username.substring(1)}</p>
                                    </div>
                                    <Badge variant={bot.isActive ? "default" : "secondary"} className="rounded-full text-[10px] h-5">
                                        {bot.isActive ? t('bot_active') : t('bot_inactive')}
                                    </Badge>
                                </CardHeader>
                                <CardFooter className="bg-muted/30 gap-2 p-4">
                                    <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-none bg-background hover:bg-primary/5" onClick={() => setSelectedBot(bot)}>
                                        <Pencil className="h-4 w-4 mr-2" /> {t('edit_logic')}
                                    </Button>
                                    <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-none bg-background hover:bg-primary/5" onClick={() => handleToggleActive(bot)}>
                                        {bot.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-none bg-background hover:text-destructive hover:bg-destructive/5" onClick={() => handleDeleteBot(bot)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-card rounded-3xl border-2 border-dashed opacity-40">
                        <Bot className="h-16 w-16 mx-auto mb-4" />
                        <p className="font-bold uppercase tracking-widest text-xs">{t('no_studio_bots')}</p>
                    </div>
                )}
            </div>
        </div>
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent hideCloseButton className="max-w-sm rounded-[2rem] p-0 border-none shadow-2xl overflow-hidden">
              <DialogHeader className="relative flex-row items-center justify-center p-4 border-b shrink-0 h-16">
                  <Button variant="ghost" size="icon" onClick={() => setIsCreateOpen(false)} className="absolute left-2 top-1/2 -translate-y-1/2">
                      <ArrowLeft />
                  </Button>
                  <DialogTitle>{t('create_bot')}</DialogTitle>
                  <Button variant="ghost" size="icon" onClick={() => setIsCreateOpen(false)} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X />
                  </Button>
              </DialogHeader>
              <div className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
                      <Bot className="h-10 w-10 text-primary" />
                  </div>
                  <DialogDescription>
                      Создайте уникального бота с собственной логикой.
                  </DialogDescription>
              </div>
              <div className="px-8 space-y-4 pb-4">
                  <div className="space-y-2">
                      <Label htmlFor="bot-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{t('bot_name_label')}</Label>
                      <Input
                          id="bot-name"
                          value={newBotName}
                          onChange={(e) => setNewBotName(e.target.value)}
                          placeholder="Напр. Helper Bot"
                          className="h-12 rounded-xl bg-muted/50 border-none focus-visible:ring-primary font-bold"
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="bot-handle" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{t('bot_username_label')}</Label>
                      <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">@</span>
                          <Input
                              id="bot-handle"
                              value={newBotHandle}
                              onChange={(e) => setNewBotHandle(e.target.value.replace('@', '').replace(/\s/g, ''))}
                              placeholder="helper_bot"
                              className="h-12 pl-7 rounded-xl bg-muted/50 border-none focus-visible:ring-primary font-bold"
                          />
                      </div>
                  </div>
              </div>
              <DialogFooter className="p-8 pt-0 flex flex-col gap-2">
                  <Button onClick={handleCreateBot} disabled={isCreating || !newBotName.trim() || !newBotHandle.trim()} className="w-full h-12 rounded-xl font-bold">
                      {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      {t('create_bot')}
                  </Button>
                  <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="w-full h-12 rounded-xl font-medium text-muted-foreground">
                      {t('cancel')}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
