'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, onSnapshot, collection, setDoc, serverTimestamp, runTransaction, getDoc } from 'firebase/firestore';
import type { CustomGame, BotBlock, BotBlockType, BotScript } from '@/types';
import { useLanguage } from '@/context/language-context';
import { ArrowLeft, Save, Plus, Trash2, Clock, Code2, ChevronDown, ChevronUp, Split, Database, Check, Zap, Pencil, Settings, Loader2, ListTree, X, PlusCircle, MinusCircle, Ban, LayoutGrid, MousePointer2, Dice5, CircleHelp, Type, Minus, Trophy, Coins, Globe, Share2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const BLOCK_COLORS: Record<string, string> = {
  event_game_start: 'bg-indigo-600 border-indigo-700',
  event_game_click: 'bg-indigo-500 border-indigo-600',
  action_game_win: 'bg-green-600 border-green-700',
  action_game_lose: 'bg-red-600 border-red-700',
  logic_if: 'bg-purple-600 border-purple-700',
  logic_else: 'bg-purple-500 border-purple-600',
  logic_end_if: 'bg-purple-400 border-purple-500',
  variable_set: 'bg-rose-500 border-rose-600',
  variable_math: 'bg-rose-600 border-rose-700',
  variable_clear: 'bg-rose-400 border-rose-500',
  variable_random: 'bg-rose-700 border-rose-800',
  action_wait: 'bg-amber-500 border-amber-600',
  ui_header: 'bg-teal-600 border-teal-700',
  ui_text: 'bg-teal-500 border-teal-600',
  ui_button: 'bg-blue-600 border-blue-700',
  ui_separator: 'bg-gray-500 border-gray-600',
};

const BLOCK_ICONS: Record<string, any> = {
  event_game_start: Zap,
  event_game_click: MousePointer2,
  action_game_win: Trophy,
  action_game_lose: Ban,
  logic_if: Split,
  logic_else: Split,
  logic_end_if: Check,
  variable_set: Database,
  variable_math: PlusCircle,
  variable_clear: MinusCircle,
  variable_random: Dice5,
  action_wait: Clock,
  ui_header: Type,
  ui_text: Type,
  ui_button: MousePointer2,
  ui_separator: Minus,
};

const generateRandomLink = (length: number): string => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

export function GameEditor({ game, onBack }: { game: CustomGame, onBack: () => void }) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [scripts, setScripts] = useState<BotScript[]>(game.scripts || []);
  const [gameName, setGameName] = useState(game.name);
  const [gameDescription, setGameDescription] = useState(game.description || '');
  const [gameVersion, setGameVersion] = useState(game.version || '1.0');
  const [gameLink, setGameLink] = useState(game.link || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [blockSelectorOpen, setBlockSelectorOpen] = useState(false);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, 'customGames', game.id), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setScripts(data.scripts || []);
            setGameName(data.name);
            setGameDescription(data.description || '');
            setGameVersion(data.version || '1.0');
            setGameLink(data.link || '');
        }
    });
  }, [game.id, db]);

  const handleSave = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
        const gameRef = doc(db, 'customGames', game.id);
        await updateDoc(gameRef, { 
            scripts, 
            name: gameName, 
            description: gameDescription,
            version: gameVersion,
            updatedAt: serverTimestamp()
        });
        toast({ title: t('dm_success'), description: "Game saved!" });
    } catch (e: any) { 
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setIsSaving(false); }
  };

  const handlePublish = async () => {
      if (!db || isPublishing) return;
      setIsPublishing(true);
      try {
          const randomSuffix = generateRandomLink(8);
          const fullLink = '/IG/' + randomSuffix;

          await runTransaction(db, async (tx) => {
              const linkRef = doc(db, 'gameLinks', encodeURIComponent(fullLink));
              const linkSnap = await tx.get(linkRef);
              if (linkSnap.exists()) throw new Error("Generated link conflict. Try again.");
              
              const gameRef = doc(db, 'customGames', game.id);
              tx.update(gameRef, { link: fullLink, updatedAt: serverTimestamp() });
              tx.set(linkRef, { gameId: game.id, ownerId: game.ownerId });
          });

          setGameLink(fullLink);
          toast({ title: t('dm_success'), description: "Game published! Link generated." });
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
      } finally {
          setIsPublishing(false);
      }
  };

  const onAddBlock = (type: BotBlockType) => {
      const isEvent = type.startsWith('event_');
      const newBlock: BotBlock = { id: Math.random().toString(36).substr(2, 9), type, params: {} };

      if (isEvent || scripts.length === 0) {
          setScripts([...scripts, { id: Math.random().toString(36).substr(2, 9), blocks: [newBlock] }]);
      } else {
          const lastIdx = scripts.length - 1;
          const newScripts = [...scripts];
          newScripts[lastIdx] = { ...newScripts[lastIdx], blocks: [...newScripts[lastIdx].blocks, newBlock] };
          setScripts(newScripts);
      }
      setBlockSelectorOpen(false);
  };

  const updateBlockParam = (sIdx: number, bIdx: number, key: string, value: any) => {
    const newScripts = [...scripts];
    newScripts[sIdx].blocks[bIdx].params = { ...newScripts[sIdx].blocks[bIdx].params, [key]: value };
    setScripts(newScripts);
  };

  const removeBlock = (sIdx: number, bIdx: number) => {
    const newScripts = [...scripts];
    newScripts[sIdx].blocks.splice(bIdx, 1);
    if (newScripts[sIdx].blocks.length === 0) newScripts.splice(sIdx, 1);
    setScripts(newScripts);
  };

  const moveBlock = (sIdx: number, bIdx: number, direction: 'up' | 'down') => {
    const newScripts = [...scripts];
    const blocks = [...newScripts[sIdx].blocks];
    if (bIdx === 0) return;
    const targetIdx = direction === 'up' ? bIdx - 1 : bIdx + 1;
    if (targetIdx >= 1 && targetIdx < blocks.length) {
        const temp = blocks[bIdx];
        blocks[bIdx] = blocks[targetIdx];
        blocks[targetIdx] = temp;
        newScripts[sIdx].blocks = blocks;
        setScripts(newScripts);
    }
  };

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      <header className="flex-shrink-0 flex items-center p-4 border-b z-20 pt-[calc(1rem+env(safe-area-inset-top))] bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-base font-black font-headline truncate leading-tight uppercase tracking-tighter">{gameName}</h1>
                    <Badge variant="outline" className="text-[8px] font-black h-4 px-1 leading-none border-primary/20 text-primary">{gameVersion}</Badge>
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{gameLink || 'Logic Draft'}</p>
            </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="rounded-xl h-10 w-10">
                <Settings className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="rounded-xl gap-2 font-bold bg-indigo-600 hover:bg-indigo-700 h-10 px-6 shadow-lg shadow-indigo-600/20">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="hidden sm:inline">{t('save')}</span>
            </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative bg-muted/5">
            <div className="w-full px-4 py-8 md:px-8 md:py-16 space-y-12 pb-32 animate-in fade-in slide-in-from-right-4 duration-500">
                {scripts.map((script, sIdx) => (
                    <div key={script.id} className="relative flex flex-col items-stretch bg-card/30 rounded-3xl p-3 sm:p-6 border-2 border-dashed border-muted-foreground/10 w-full">
                        <div className="absolute -top-3 left-6 bg-muted px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest text-muted-foreground">Script #{sIdx + 1}</div>
                        <div className="w-full flex flex-col items-stretch gap-3">
                            {script.blocks.map((block, bIdx) => (
                                <GameBlockComponent 
                                    key={block.id}
                                    block={block} 
                                    sIdx={sIdx} 
                                    bIdx={bIdx}
                                    isFirst={bIdx === 1}
                                    isLast={bIdx === script.blocks.length - 1}
                                    onUpdate={updateBlockParam}
                                    onDelete={removeBlock}
                                    onMove={moveBlock}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                {scripts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4 opacity-40">
                        <ListTree className="h-16 w-16" />
                        <p className="font-bold text-sm uppercase tracking-[0.2em]">Рабочее поле пусто</p>
                    </div>
                )}
            </div>
      </main>

      <div className="absolute bottom-8 right-8 z-[30]">
          <Button onClick={() => setBlockSelectorOpen(true)} className="h-16 w-16 rounded-full font-black shadow-2xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all p-0 flex items-center justify-center bg-indigo-600 text-white">
            <Plus className="h-8 w-8" strokeWidth={3} />
          </Button>
      </div>

      <Dialog open={blockSelectorOpen} onOpenChange={setBlockSelectorOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden flex flex-col h-[70vh] border-none shadow-2xl">
              <DialogHeader className="p-8 pb-4 border-b bg-muted/20"><DialogTitle className="text-2xl font-black font-headline text-center uppercase tracking-tighter">Добавить блок</DialogTitle></DialogHeader>
              <Tabs defaultValue="events" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="mx-8 mt-4 grid grid-cols-4 bg-muted/50 p-1 rounded-xl">
                      <TabsTrigger value="events" className="rounded-lg text-[9px] uppercase font-black px-1">События</TabsTrigger>
                      <TabsTrigger value="actions" className="rounded-lg text-[9px] uppercase font-black px-1">Действия</TabsTrigger>
                      <TabsTrigger value="logic" className="rounded-lg text-[9px] uppercase font-black px-1">Логика</TabsTrigger>
                      <TabsTrigger value="ui" className="rounded-lg text-[9px] uppercase font-black px-1">UI</TabsTrigger>
                  </TabsList>
                  <ScrollArea className="flex-1 p-6">
                      <TabsContent value="events" className="mt-0 space-y-2">
                          <PaletteItem type="event_game_start" label={t('block_event_game_start')} onClick={onAddBlock} />
                          <PaletteItem type="event_game_click" label={t('block_event_game_click')} onClick={onAddBlock} />
                      </TabsContent>
                      <TabsContent value="actions" className="mt-0 space-y-2">
                          <PaletteItem type="action_game_win" label={t('block_action_game_win')} onClick={onAddBlock} />
                          <PaletteItem type="action_game_lose" label={t('block_action_game_lose')} onClick={onAddBlock} />
                          <PaletteItem type="action_wait" label="Подождать" onClick={onAddBlock} />
                          <PaletteItem type="variable_set" label="Записать в память" onClick={onAddBlock} />
                          <PaletteItem type="variable_math" label="Математика" onClick={onAddBlock} />
                      </TabsContent>
                      <TabsContent value="logic" className="mt-0 space-y-2">
                          <PaletteItem type="logic_if" label={t('block_if')} onClick={onAddBlock} />
                          <PaletteItem type="logic_else" label={t('block_else')} onClick={onAddBlock} />
                          <PaletteItem type="logic_end_if" label={t('block_end_if')} onClick={onAddBlock} />
                      </TabsContent>
                      <TabsContent value="ui" className="mt-0 space-y-2">
                          <PaletteItem type="ui_header" label={t('block_ui_header')} onClick={onAddBlock} />
                          <PaletteItem type="ui_text" label={t('block_ui_text')} onClick={onAddBlock} />
                          <PaletteItem type="ui_button" label={t('block_ui_button')} onClick={onAddBlock} />
                          <PaletteItem type="ui_separator" label={t('block_ui_separator')} onClick={onAddBlock} />
                      </TabsContent>
                  </ScrollArea>
              </Tabs>
          </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden flex flex-col h-[85vh]">
              <DialogHeader className="items-center text-center p-10 pb-6 border-b bg-muted/10 shrink-0">
                <div className="w-20 h-20 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-4 shadow-inner">
                    <Settings className="h-10 w-10" />
                </div>
                <DialogTitle className="text-3xl font-black font-headline uppercase tracking-tighter">Настройки игры</DialogTitle>
                <DialogDescription className="font-bold text-[11px] uppercase tracking-[0.2em] text-muted-foreground mt-2 opacity-60">Manage your InfGame project</DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="flex-1 bg-background">
                <div className="p-10 space-y-8 pb-20">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">{t('game_name_label')}</Label>
                        <Input 
                            value={gameName} 
                            onChange={e => setGameName(e.target.value)} 
                            className="rounded-2xl h-16 bg-muted/50 border-none focus-visible:ring-primary font-bold text-xl px-8 shadow-inner" 
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Версия игры</Label>
                            <Input 
                                value={gameVersion} 
                                onChange={e => setGameVersion(e.target.value)} 
                                placeholder="1.0" 
                                className="rounded-2xl h-16 bg-muted/50 border-none focus-visible:ring-primary font-bold text-center px-6 shadow-inner text-lg" 
                            />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">ID Проекта</Label>
                            <div className="h-16 rounded-2xl bg-muted/20 flex items-center justify-center font-mono text-xs opacity-50 px-6 border-2 border-dashed">
                                #{game.id.substring(0,12)}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">{t('game_desc_label')}</Label>
                        <Textarea 
                            value={gameDescription} 
                            onChange={e => setGameDescription(e.target.value)} 
                            className="rounded-3xl bg-muted/50 border-none focus-visible:ring-primary min-h-[160px] p-8 text-base shadow-inner resize-none font-medium leading-relaxed" 
                        />
                    </div>

                    <div className="pt-6 space-y-6">
                        <Separator className="opacity-10" />
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="space-y-1 text-center sm:text-left">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Статус публикации</Label>
                                <p className="text-sm font-bold text-muted-foreground">{gameLink ? 'Игра видна всем по ссылке' : 'Проект еще не опубликован'}</p>
                            </div>
                            <Button variant={gameLink ? "outline" : "default"} className="rounded-2xl h-14 px-10 font-black uppercase tracking-widest text-xs" onClick={handlePublish} disabled={isPublishing}>
                                {isPublishing ? <Loader2 className="animate-spin h-5 w-5" /> : (gameLink ? <RefreshCw className="h-5 w-5 mr-2" /> : <Globe className="h-5 w-5 mr-2" />)}
                                {gameLink ? 'Обновить' : 'Опубликовать'}
                            </Button>
                        </div>
                        
                        {gameLink && (
                            <div className="p-6 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in zoom-in duration-300">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-2">Адрес вашей игры</p>
                                    <code className="text-lg font-black truncate block text-indigo-700 bg-indigo-500/10 px-4 py-1 rounded-lg w-fit">{gameLink}</code>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="lg" 
                                    onClick={() => { navigator.clipboard.writeText(gameLink); toast({ title: 'Ссылка скопирована' }); }} 
                                    className="text-indigo-600 hover:bg-indigo-500/10 rounded-2xl h-14 px-6 font-bold"
                                >
                                    <Share2 className="h-5 w-5 mr-2" /> Копировать
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
              </ScrollArea>
              
              <DialogFooter className="p-10 border-t bg-muted/20 shrink-0">
                <Button onClick={() => setIsSettingsOpen(false)} className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-2xl shadow-primary/20 uppercase tracking-widest active:scale-95 transition-all">Применить</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

function PaletteItem({ type, label, onClick }: { type: string, label: string, onClick: (t: BotBlockType) => void }) {
    const Icon = BLOCK_ICONS[type] || CircleHelp;
    return (
        <button onClick={() => onClick(type as any)} className={cn("w-full p-4 rounded-2xl border-b-4 text-white font-black flex items-center gap-4 transition-all active:scale-95 hover:brightness-110 shadow-md uppercase tracking-widest text-[10px]", BLOCK_COLORS[type])}>
            <div className="p-2 bg-black/10 rounded-xl shrink-0"><Icon className="h-5 w-5" /></div>
            <span className="truncate">{label}</span>
        </button>
    );
}

function GameBlockComponent({ block, sIdx, bIdx, isFirst, isLast, onUpdate, onDelete, onMove }: { block: BotBlock, sIdx: number, bIdx: number, isFirst: boolean, isLast: boolean, onUpdate: any, onDelete: any, onMove: any }) {
    const { t } = useLanguage();
    const Icon = BLOCK_ICONS[block.type] || CircleHelp;
    const isTrigger = bIdx === 0;

    const renderParams = () => {
        switch (block.type) {
            case 'action_game_win':
                return (
                    <div className="space-y-2 mt-1 w-full">
                        <Label className="text-[9px] font-black uppercase opacity-60 ml-1">{t('reward_amount_label')}</Label>
                        <div className="relative">
                            <Input type="number" min="1" max="100" value={block.params?.reward || 1} onChange={e => onUpdate(sIdx, bIdx, 'reward', parseInt(e.target.value))} className="h-10 rounded-xl bg-black/10 border-none text-white font-bold pl-10" />
                            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                        </div>
                        <p className="text-[9px] opacity-60 italic px-1">{t('reward_help')}</p>
                    </div>
                );
            case 'ui_header':
            case 'ui_text':
            case 'ui_button':
                return (
                    <div className="space-y-2 mt-1 w-full">
                        <Textarea placeholder="Текст..." value={block.params?.text || ''} onChange={e => onUpdate(sIdx, bIdx, 'text', e.target.value)} className="min-h-[60px] bg-black/10 border-none text-white placeholder:text-white/40 font-bold text-xs" rows={2} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />
                        {block.type === 'ui_button' && <div className="space-y-1"><Label className="text-[8px] font-black uppercase opacity-50 ml-1">{t('button_id_label')}</Label><Input placeholder="btn_action" value={block.params?.buttonId || ''} onChange={e => onUpdate(sIdx, bIdx, 'buttonId', e.target.value.toLowerCase().replace(/\s/g, '_'))} className="h-8 bg-black/10 border-none text-white placeholder:text-white/40 font-mono text-[10px]" /></div>}
                    </div>
                );
            case 'logic_if':
                return <Textarea placeholder="Условие (напр. {score} == 10)" value={block.params?.condition || ''} onChange={e => onUpdate(sIdx, bIdx, 'condition', e.target.value)} className="min-h-[40px] bg-black/10 border-none text-white font-bold text-xs mt-1" rows={1} onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />;
            case 'variable_set':
            case 'variable_random':
                return (
                    <div className="flex flex-col gap-2 mt-1 w-full">
                        <Input placeholder="Имя переменной" value={block.params?.name || ''} onChange={e => onUpdate(sIdx, bIdx, 'name', e.target.value)} className="h-9 bg-black/10 border-none text-white font-bold text-xs" />
                        <Input placeholder={block.type === 'variable_random' ? "Макс. число" : "Значение"} value={block.params?.value || ''} onChange={e => onUpdate(sIdx, bIdx, 'value', e.target.value)} className="h-9 bg-black/10 border-none text-white font-bold text-xs" />
                    </div>
                );
            case 'variable_math':
                return (
                    <div className="flex flex-col gap-2 mt-1 w-full">
                        <Input placeholder="Имя переменной" value={block.params?.name || ''} onChange={e => onUpdate(sIdx, bIdx, 'name', e.target.value)} className="h-9 bg-black/10 border-none text-white font-bold text-xs" />
                        <div className="flex gap-2">
                            <select onChange={(e) => onUpdate(sIdx, bIdx, 'op', e.target.value)} value={block.params?.op || 'add'} className="h-9 bg-black/20 border-none rounded-lg text-white text-[10px] font-bold px-2 outline-none"><option value="add">+</option><option value="sub">-</option><option value="mul">*</option></select>
                            <Input placeholder="Число" value={block.params?.value || ''} onChange={e => onUpdate(sIdx, bIdx, 'value', e.target.value)} className="h-9 flex-1 bg-black/10 border-none text-white font-bold text-xs" />
                        </div>
                    </div>
                );
            case 'action_wait':
                return <div className="flex items-center gap-2 mt-1"><Input type="number" min="1" max="60" value={block.params?.seconds || 1} onChange={e => onUpdate(sIdx, bIdx, 'seconds', parseInt(e.target.value))} className="w-20 h-9 bg-black/10 border-none text-white font-bold text-xs" /><span className="text-[10px] font-bold opacity-60">секунд</span></div>;
            default: return null;
        }
    };

    return (
        <div className={cn("w-full p-4 rounded-[1.5rem] border-b-4 text-white shadow-lg relative group transition-all", isTrigger ? "" : "active:scale-[0.98]", BLOCK_COLORS[block.type])}>
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="p-1.5 bg-black/10 rounded-xl shrink-0"><Icon className="h-4 w-4" /></div>
                    <span className="font-black uppercase tracking-widest text-[9px] truncate">{t(`block_${block.type}` as any) || block.type}</span>
                </div>
                {!isTrigger && (
                    <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" disabled={isFirst} onClick={() => onMove(sIdx, bIdx, 'up')} className="h-7 w-7 rounded-lg bg-black/10 hover:bg-black/20 text-white disabled:opacity-20"><ChevronUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" disabled={isLast} onClick={() => onMove(sIdx, bIdx, 'down')} className="h-7 w-7 rounded-lg bg-black/10 hover:bg-black/20 text-white disabled:opacity-20"><ChevronDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(sIdx, bIdx)} className="h-7 w-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-white ml-2"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                )}
            </div>
            <div className="w-full whitespace-pre-wrap">{renderParams()}</div>
        </div>
    );
}