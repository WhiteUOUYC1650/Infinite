'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import type { CustomBot, BotBlock, BotBlockType, BotScript, BotMiniApp } from '@/types';
import { useLanguage } from '@/context/language-context';
import { ArrowLeft, Save, Plus, Trash2, MessageSquare, Clock, Ghost, Code2, ChevronDown, ChevronUp, Wand2, Split, Database, Image as ImageIcon, Check, Zap, Pencil, Bot, Settings, Loader2, ListTree, X, Video, Music, FileText, Upload, PlusCircle, MinusCircle, Ban, Globe, LayoutGrid, ChevronRight, Sparkles, ExternalLink, Type, MousePointer2, Minus, HelpCircle, Dice5, CircleHelp, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useTheme } from '@/context/theme-context';

const BLOCK_COLORS: Record<BotBlockType, string> = {
  event_start: 'bg-orange-600 border-orange-700',
  event_message: 'bg-orange-500 border-orange-600',
  event_button_click: 'bg-orange-400 border-orange-500',
  action_send: 'bg-blue-500 border-blue-600',
  action_reply: 'bg-indigo-500 border-indigo-600',
  action_wait: 'bg-amber-500 border-amber-600',
  condition_if_text: 'bg-emerald-500 border-emerald-600',
  action_reaction: 'bg-pink-500 border-pink-600',
  logic_if: 'bg-purple-600 border-purple-700',
  logic_else: 'bg-purple-500 border-purple-600',
  logic_end_if: 'bg-purple-400 border-purple-500',
  variable_set: 'bg-rose-500 border-rose-600',
  variable_math: 'bg-rose-600 border-rose-700',
  variable_clear: 'bg-rose-400 border-rose-500',
  variable_random: 'bg-rose-700 border-rose-800',
  action_stop: 'bg-red-600 border-red-700',
  action_send_image: 'bg-cyan-500 border-cyan-600',
  action_send_video: 'bg-slate-500 border-slate-600',
  action_send_music: 'bg-green-600 border-green-700',
  action_send_file: 'bg-zinc-600 border-zinc-700',
  action_ai_prompt: 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-700',
  ui_header: 'bg-teal-600 border-teal-700',
  ui_text: 'bg-teal-500 border-teal-600',
  ui_button: 'bg-blue-600 border-blue-700',
  ui_separator: 'bg-gray-500 border-gray-600',
};

const BLOCK_ICONS: Record<BotBlockType, any> = {
  event_start: Zap,
  event_message: MessageSquare,
  event_button_click: MousePointer2,
  action_send: MessageSquare,
  action_reply: Wand2,
  action_wait: Clock,
  condition_if_text: Code2,
  action_reaction: Ghost,
  logic_if: Split,
  logic_else: Split,
  logic_end_if: Check,
  variable_set: Database,
  variable_math: PlusCircle,
  variable_clear: MinusCircle,
  variable_random: Dice5,
  action_stop: Ban,
  action_send_image: ImageIcon,
  action_send_video: Video,
  action_send_music: Music,
  action_send_file: FileText,
  action_ai_prompt: BrainCircuit,
  ui_header: Type,
  ui_text: Type,
  ui_button: MousePointer2,
  ui_separator: Minus,
};

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight), mediaWidth, mediaHeight);
}

async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, crop.width, crop.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas is empty')); return; }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    }, 'image/jpeg');
  });
}

export function BotEditor({ bot, onBack }: { bot: CustomBot, onBack: () => void }) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const { theme: colorTheme } = useTheme();
  
  const [view, setView] = useState<'menu' | 'scripts' | 'miniapps'>('menu');
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<BotScript[]>(bot.scripts || []);
  const [miniApps, setMiniApps] = useState<BotMiniApp[]>(bot.miniApps || []);
  const [botAvatar, setBotAvatar] = useState<string | undefined>(bot.avatar);
  const [botName, setBotName] = useState(bot.name);
  const [botDescription, setBotDescription] = useState(bot.description || '');
  const [isSaving, setIsSaving] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [blockSelectorOpen, setBlockSelectorOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageToCrop, setImageToCrop] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, 'customBots', bot.id), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setScripts(data.scripts || []);
            setMiniApps(data.miniApps || []);
            setBotAvatar(data.avatar);
            setBotName(data.name);
            setBotDescription(data.description || '');
        }
    });
  }, [bot.id, db]);

  const handleSave = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
        const botRef = doc(db, 'customBots', bot.id);
        const userRef = doc(db, 'users', bot.id);
        const updateData = { scripts, miniApps, avatar: botAvatar || null, name: botName, description: botDescription };
        await updateDoc(botRef, updateData);
        await updateDoc(userRef, { avatar: botAvatar || null, name: botName, statusMessage: botDescription });
        toast({ title: t('dm_success'), description: t('chat_update_success') });
    } catch (e: any) { 
        console.error(e); 
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setIsSaving(false); }
  };

  const handleBack = () => {
      if (editingAppId) {
          setEditingAppId(null);
      } else if (view !== 'menu') {
          setView('menu');
      } else {
          onBack();
      }
  };

  const onAddFromFab = (type: BotBlockType) => {
      const isEvent = type.startsWith('event_');
      const newBlock: BotBlock = { id: Math.random().toString(36).substr(2, 9), type, params: {} };

      if (editingAppId) {
          setMiniApps(miniApps.map(app => 
              app.id === editingAppId ? { ...app, blocks: [...(app.blocks || []), newBlock] } : app
          ));
      } else if (isEvent || scripts.length === 0) {
          setScripts([...scripts, { id: Math.random().toString(36).substr(2, 9), blocks: [newBlock] }]);
      } else {
          const lastIdx = scripts.length - 1;
          const newScripts = [...scripts];
          newScripts[lastIdx] = { ...newScripts[lastIdx], blocks: [...newScripts[lastIdx].blocks, newBlock] };
          setScripts(newScripts);
      }
      setBlockSelectorOpen(false);
  };

  const updateBlockParam = (sIdx: number, bIdx: number, key: string, value: any, isMiniApp = false) => {
    if (isMiniApp) {
        const newApps = [...miniApps];
        const appIdx = newApps.findIndex(a => a.id === editingAppId);
        if (appIdx !== -1) {
            newApps[appIdx].blocks[bIdx].params = { ...newApps[appIdx].blocks[bIdx].params, [key]: value };
            setMiniApps(newApps);
        }
    } else {
        const newScripts = [...scripts];
        newScripts[sIdx].blocks[bIdx].params = { ...newScripts[sIdx].blocks[bIdx].params, [key]: value };
        setScripts(newScripts);
    }
  };

  const removeBlock = (sIdx: number, bIdx: number, isMiniApp = false) => {
    if (isMiniApp) {
        const newApps = [...miniApps];
        const appIdx = newApps.findIndex(a => a.id === editingAppId);
        if (appIdx !== -1) {
            newApps[appIdx].blocks.splice(bIdx, 1);
            setMiniApps(newApps);
        }
    } else {
        const newScripts = [...scripts];
        newScripts[sIdx].blocks.splice(bIdx, 1);
        if (newScripts[sIdx].blocks.length === 0) newScripts.splice(sIdx, 1);
        setScripts(newScripts);
    }
  };

  const moveBlock = (sIdx: number, bIdx: number, direction: 'up' | 'down', isMiniApp = false) => {
    if (isMiniApp) {
        const newApps = [...miniApps];
        const appIdx = newApps.findIndex(a => a.id === editingAppId);
        if (appIdx !== -1) {
            const blocks = [...newApps[appIdx].blocks];
            const targetIdx = direction === 'up' ? bIdx - 1 : bIdx + 1;
            if (targetIdx >= 0 && targetIdx < blocks.length) {
                const temp = blocks[bIdx];
                blocks[bIdx] = blocks[targetIdx];
                blocks[targetIdx] = temp;
                newApps[appIdx].blocks = blocks;
                setMiniApps(newApps);
            }
        }
    } else {
        const newScripts = [...scripts];
        const script = { ...newScripts[sIdx] };
        const blocks = [...script.blocks];
        
        if (bIdx === 0) return;

        if (direction === 'up') {
            if (bIdx > 1) {
                const temp = blocks[bIdx];
                blocks[bIdx] = blocks[bIdx - 1];
                blocks[bIdx - 1] = temp;
                newScripts[sIdx] = { ...script, blocks };
            } else if (sIdx > 0) {
                const prevScript = { ...newScripts[sIdx - 1] };
                const prevBlocks = [...prevScript.blocks];
                const blockToMove = blocks.splice(bIdx, 1)[0];
                prevBlocks.push(blockToMove);
                newScripts[sIdx - 1] = { ...prevScript, blocks: prevBlocks };
                newScripts[sIdx] = { ...script, blocks };
            }
        } else {
            if (bIdx < blocks.length - 1) {
                const temp = blocks[bIdx];
                blocks[bIdx] = blocks[bIdx + 1];
                blocks[bIdx + 1] = temp;
                newScripts[sIdx] = { ...script, blocks };
            } else if (sIdx < newScripts.length - 1) {
                const nextScript = { ...newScripts[sIdx + 1] };
                const nextBlocks = [...nextScript.blocks];
                const blockToMove = blocks.splice(bIdx, 1)[0];
                nextBlocks.splice(1, 0, blockToMove);
                newScripts[sIdx + 1] = { ...nextScript, blocks: nextBlocks };
                newScripts[sIdx] = { ...script, blocks };
            }
        }
        setScripts(newScripts);
    }
  };

  const addMiniApp = () => {
    const newApp: BotMiniApp = { id: Math.random().toString(36).substr(2, 9), name: 'My Mini-app', blocks: [] };
    setMiniApps([...miniApps, newApp]);
  };

  const updateMiniApp = (id: string, key: keyof BotMiniApp, value: string) => {
    setMiniApps(miniApps.map(app => app.id === id ? { ...app, [key]: value } : app));
  };

  const removeMiniApp = (id: string) => {
    setMiniApps(miniApps.filter(app => app.id !== id));
  };

  const currentEditingApp = miniApps.find(a => a.id === editingAppId);

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      <header className="flex-shrink-0 flex items-center p-4 border-b z-20 pt-[calc(1rem+env(safe-area-inset-top))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative group/avatar cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                        <AvatarImage src={botAvatar} className="object-cover" />
                        <AvatarFallback><Bot className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1 border-2 border-background shadow-sm scale-75">
                        <Pencil className="h-3 w-3" />
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                        if (e.target.files?.[0]) {
                            const reader = new FileReader();
                            reader.onload = () => setImageToCrop(reader.result?.toString() || '');
                            reader.readAsDataURL(e.target.files[0]);
                        }
                    }} />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="text-base font-black font-headline truncate leading-tight">{botName}</h1>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Bot Editor 0.6.1</p>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="rounded-xl h-10 w-10">
                <Settings className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="rounded-xl gap-2 font-bold bg-green-600 hover:bg-green-700 h-10 px-6 shadow-lg shadow-green-600/20">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="hidden sm:inline">{t('save')}</span>
            </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative bg-muted/5">
        {view === 'menu' && (
            <div className="w-full max-w-lg mx-auto px-4 py-12 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-2 mb-8">
                    <h2 className="text-2xl font-black font-headline text-primary">{t('manage_bot')}</h2>
                    <p className="text-sm text-muted-foreground">{t('bot_studio_desc')}</p>
                </div>

                <button onClick={() => setView('scripts')} className="w-full p-6 bg-card border rounded-[2rem] shadow-sm hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-left group flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"><Code2 className="h-8 w-8" /></div>
                    <div className="flex-1 min-w-0"><h3 className="text-xl font-bold font-headline mb-1">{t('bot_logic')}</h3><p className="text-xs text-muted-foreground leading-relaxed">{t('bot_guide_intro').substring(0, 80)}...</p></div>
                    <ChevronRight className="h-6 w-6 text-muted-foreground/30" />
                </button>

                <button onClick={() => setView('miniapps')} className="w-full p-6 bg-card border rounded-[2rem] shadow-sm hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-left group flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform"><LayoutGrid className="h-8 w-8" /></div>
                    <div className="flex-1 min-w-0"><h3 className="text-xl font-bold font-headline mb-1">{t('mini_apps')}</h3><p className="text-xs text-muted-foreground leading-relaxed">{t('no_mini_apps')}</p></div>
                    <ChevronRight className="h-6 w-6 text-muted-foreground/30" />
                </button>
            </div>
        )}

        {view === 'scripts' && (
            <div className="w-full px-4 py-8 md:px-8 md:py-16 space-y-12 pb-32 animate-in fade-in slide-in-from-right-4 duration-500">
                {scripts.map((script, sIdx) => (
                    <div key={script.id} className="relative flex flex-col items-stretch bg-card/30 rounded-3xl p-3 sm:p-6 border-2 border-dashed border-muted-foreground/10 w-full">
                        <div className="absolute -top-3 left-6 bg-muted px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest text-muted-foreground">Script #{sIdx + 1}</div>
                        <div className="w-full flex flex-col items-stretch gap-3">
                            {script.blocks.map((block, bIdx) => (
                                <BotBlockComponent 
                                    key={block.id}
                                    block={block} 
                                    sIdx={sIdx} 
                                    bIdx={bIdx}
                                    isFirst={bIdx === 1}
                                    isLast={bIdx === script.blocks.length - 1}
                                    onUpdate={updateBlockParam}
                                    onDelete={removeBlock}
                                    onMove={moveBlock}
                                    db={db}
                                    botId={bot.id}
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
        )}

        {view === 'miniapps' && !editingAppId && (
            <div className="w-full max-w-lg mx-auto px-4 py-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-32">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black font-headline uppercase tracking-widest text-primary">{t('mini_apps')}</h2>
                    <Button variant="outline" size="sm" onClick={addMiniApp} className="rounded-xl font-bold h-10 border-primary/20 bg-primary/5 text-primary">
                        <Plus className="h-4 w-4 mr-2" /> {t('add_mini_app')}
                    </Button>
                </div>
                <div className="grid gap-4">
                    {miniApps.map(app => (
                        <div key={app.id} className="p-6 bg-card border rounded-3xl shadow-sm space-y-4 relative group animate-in zoom-in duration-300" onClick={() => setEditingAppId(app.id)}>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeMiniApp(app.id); }} className="absolute top-4 right-4 h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"><Trash2 className="h-4 w-4" /></Button>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><LayoutGrid className="h-6 w-6" /></div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 mb-1">{t('mini_app_name')}</p>
                                    <Input value={app.name} onChange={e => { e.stopPropagation(); updateMiniApp(app.id, 'name', e.target.value); }} className="h-11 bg-muted/50 border-none rounded-xl font-bold text-lg" onClick={e => e.stopPropagation()} />
                                </div>
                            </div>
                        </div>
                    ))}
                    {miniApps.length === 0 && (
                        <div className="text-center py-20 bg-card/40 rounded-[2.5rem] border-2 border-dashed opacity-40">
                            <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                            <p className="font-bold uppercase tracking-widest text-xs text-muted-foreground">{t('no_mini_apps')}</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {view === 'miniapps' && editingAppId && currentEditingApp && (
            <div className="w-full px-4 py-8 md:px-8 md:py-16 space-y-12 pb-32 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="max-w-2xl mx-auto space-y-8">
                    <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setEditingAppId(null)} className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
                            <div><h2 className="text-xl font-black font-headline text-primary">{currentEditingApp.name}</h2><p className="text-[10px] font-bold uppercase text-muted-foreground">UI Builder</p></div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setBlockSelectorOpen(true)} className="rounded-xl font-bold"><Plus className="h-4 w-4 mr-2" /> Add UI Component</Button>
                    </div>
                    <div className="space-y-4">
                        {currentEditingApp.blocks?.map((block, bIdx) => (
                            <BotBlockComponent 
                                key={block.id}
                                block={block} 
                                sIdx={0} 
                                bIdx={bIdx}
                                isFirst={bIdx === 0}
                                isLast={bIdx === currentEditingApp.blocks.length - 1}
                                onUpdate={(s: any, b: any, k: any, v: any) => updateBlockParam(s, b, k, v, true)}
                                onDelete={(s: any, b: any) => removeBlock(s, b, true)}
                                onMove={(s: any, b: any, d: any) => moveBlock(s, b, d, true)}
                                db={db}
                                botId={bot.id}
                                isMiniApp
                            />
                        ))}
                    </div>
                </div>
            </div>
        )}
      </main>

      {(view === 'scripts' || (view === 'miniapps' && editingAppId)) && (
          <div className="absolute bottom-8 right-8 z-[30]">
              <Button onClick={() => setBlockSelectorOpen(true)} className="h-16 w-16 rounded-full font-black shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all p-0 flex items-center justify-center">
                <Plus className="h-8 w-8" strokeWidth={3} />
              </Button>
          </div>
      )}

      <Dialog open={blockSelectorOpen} onOpenChange={setBlockSelectorOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl p-0 overflow-hidden flex flex-col h-[70vh]">
              <DialogHeader className="p-6 pb-2 border-b bg-muted/20"><DialogTitle className="text-xl font-bold font-headline">Добавить блок</DialogTitle></DialogHeader>
              <Tabs defaultValue={editingAppId ? "ui" : "events"} className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className={cn("mx-6 mt-4 grid bg-muted/50 p-1 rounded-xl", editingAppId ? "grid-cols-1" : "grid-cols-4")}>
                      {!editingAppId && (
                          <>
                            <TabsTrigger value="events" className="rounded-lg text-[10px] uppercase font-bold px-1">События</TabsTrigger>
                            <TabsTrigger value="actions" className="rounded-lg text-[10px] uppercase font-bold px-1">Действия</TabsTrigger>
                            <TabsTrigger value="logic" className="rounded-lg text-[10px] uppercase font-bold px-1">Логика</TabsTrigger>
                            <TabsTrigger value="vars" className="rounded-lg text-[10px] uppercase font-bold px-1">Память</TabsTrigger>
                          </>
                      )}
                      {editingAppId && <TabsTrigger value="ui" className="rounded-lg text-[10px] uppercase font-bold px-1">Интерфейс</TabsTrigger>}
                  </TabsList>
                  <ScrollArea className="flex-1 p-4 sm:p-6">
                      {!editingAppId && (
                          <>
                            <TabsContent value="events" className="mt-0 space-y-2">
                                <PaletteItem type="event_start" label={t('block_event_start')} onClick={onAddFromFab} />
                                <PaletteItem type="event_message" label={t('block_event_received')} onClick={onAddFromFab} />
                                <PaletteItem type="event_button_click" label={t('block_event_button_click')} onClick={onAddFromFab} />
                            </TabsContent>
                            <TabsContent value="actions" className="mt-0 space-y-2">
                                <PaletteItem type="action_send" label={t('block_action_send')} onClick={onAddFromFab} />
                                <PaletteItem type="action_reply" label={t('block_action_reply')} onClick={onAddFromFab} />
                                <PaletteItem type="action_ai_prompt" label="Ответ от ИИ" onClick={onAddFromFab} />
                                <PaletteItem type="action_send_image" label={t('action_send_image')} onClick={onAddFromFab} />
                                <PaletteItem type="action_send_video" label={t('action_send_video')} onClick={onAddFromFab} />
                                <PaletteItem type="action_send_music" label={t('action_send_music')} onClick={onAddFromFab} />
                                <PaletteItem type="action_send_file" label={t('action_send_file')} onClick={onAddFromFab} />
                                <PaletteItem type="action_stop" label={t('action_stop_script')} onClick={onAddFromFab} />
                            </TabsContent>
                            <TabsContent value="logic" className="mt-0 space-y-2">
                                <PaletteItem type="logic_if" label={t('block_if')} onClick={onAddFromFab} />
                                <PaletteItem type="logic_else" label={t('block_else')} onClick={onAddFromFab} />
                                <PaletteItem type="logic_end_if" label={t('block_end_if')} onClick={onAddFromFab} />
                                <PaletteItem type="action_wait" label={t('block_action_wait', { seconds: '' })} onClick={onAddFromFab} />
                            </TabsContent>
                            <TabsContent value="vars" className="mt-0 space-y-2">
                                <PaletteItem type="variable_set" label={t('block_variable_set')} onClick={onAddFromFab} />
                                <PaletteItem type="variable_math" label={t('block_math')} onClick={onAddFromFab} />
                                <PaletteItem type="variable_random" label={t('block_variable_random')} onClick={onAddFromFab} />
                                <PaletteItem type="variable_clear" label={t('block_clear')} onClick={onAddFromFab} />
                            </TabsContent>
                          </>
                      )}
                      {editingAppId && (
                          <TabsContent value="ui" className="mt-0 space-y-2">
                              <PaletteItem type="ui_header" label={t('block_ui_header')} onClick={onAddFromFab} />
                              <PaletteItem type="ui_text" label={t('block_ui_text')} onClick={onAddFromFab} />
                              <PaletteItem type="ui_button" label={t('block_ui_button')} onClick={onAddFromFab} />
                              <PaletteItem type="ui_separator" label={t('block_ui_separator')} onClick={onAddFromFab} />
                          </TabsContent>
                      )}
                  </ScrollArea>
              </Tabs>
          </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-none shadow-2xl p-0 overflow-hidden flex flex-col h-[60vh]">
              <DialogHeader className="items-center text-center p-6 border-b h-16"><DialogTitle className="text-xl font-bold font-headline">Bot Settings</DialogTitle></DialogHeader>
              <ScrollArea className="flex-1 p-6"><div className="space-y-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('bot_name_label')}</Label><Input value={botName} onChange={e => setBotName(e.target.value)} className="rounded-xl h-12 bg-muted/50 border-none focus-visible:ring-primary font-bold" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">About Bot / Status</Label><Textarea value={botDescription} onChange={e => setBotDescription(e.target.value)} className="rounded-xl bg-muted/50 border-none focus-visible:ring-primary min-h-[100px]" /></div></div></ScrollArea>
              <DialogFooter className="p-6 border-t bg-muted/20 shrink-0"><Button onClick={() => setIsSettingsOpen(false)} className="w-full h-12 rounded-xl font-bold">Apply Changes</Button></DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={!!imageToCrop} onOpenChange={(open) => !open && setImageToCrop('')}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] sm:max-w-md rounded-3xl overflow-hidden p-6 flex flex-col">
            <DialogHeader><DialogTitle>Crop Bot Avatar</DialogTitle><DialogDescription>Adjust the frame to set your bot's look.</DialogDescription></DialogHeader>
            <div className="flex-1 flex justify-center my-4 overflow-hidden min-h-0"><ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={c => setCompletedCrop(c)} aspect={1}><img ref={imgRef} src={imageToCrop} alt="Crop" onLoad={(e) => setCrop(centerAspectCrop(e.currentTarget.width, e.currentTarget.height, 1))} className="max-h-[50vh] object-contain" /></ReactCrop></div>
            <DialogFooter className="gap-2 pt-4"><Button variant="ghost" onClick={() => setImageToCrop('')} className="rounded-xl">{t('cancel')}</Button><Button onClick={() => { if (completedCrop && imgRef.current) { setIsCropping(true); getCroppedImg(imgRef.current, completedCrop).then(c => { setBotAvatar(c); setImageToCrop(''); }).finally(() => setIsCropping(false)); } }} disabled={isCropping} className="rounded-xl font-bold">{isCropping && <Clock className="mr-2 h-4 w-4 animate-spin" />} Set Avatar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaletteItem({ type, label, onClick }: { type: BotBlockType, label: string, onClick: (t: BotBlockType) => void }) {
    const Icon = BLOCK_ICONS[type] || CircleHelp;
    return (
        <button onClick={() => onClick(type)} className={cn("w-full p-3 rounded-2xl border-b-4 text-white font-bold flex items-center gap-4 transition-all active:scale-95 hover:brightness-110 shadow-md", BLOCK_COLORS[type])}>
            <div className="p-2 bg-black/10 rounded-xl shrink-0"><Icon className="h-5 w-5" /></div>
            <span className="text-sm truncate">{label}</span>
        </button>
    );
}

function BotBlockComponent({ block, sIdx, bIdx, isFirst, isLast, onUpdate, onDelete, onMove, db, botId, isMiniApp = false }: { block: BotBlock, sIdx: number, bIdx: number, isFirst: boolean, isLast: boolean, onUpdate: any, onDelete: any, onMove: any, db: any, botId: string, isMiniApp?: boolean }) {
    const { t } = useLanguage();
    const Icon = BLOCK_ICONS[block.type] || CircleHelp;
    const isTrigger = !isMiniApp && bIdx === 0;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = async () => {
                    if (block.type === 'action_send_image') {
                        onUpdate(sIdx, bIdx, 'imageUrl', reader.result);
                        onUpdate(sIdx, bIdx, 'fileName', file.name);
                        setIsUploading(false);
                    } else {
                        try {
                            const base64Data = (reader.result as string).split(',')[1];
                            const CHUNK_SIZE = 900 * 1024;
                            const chunkIds: string[] = [];
                            const typePrefix = block.type.replace('action_send_', '');
                            const col = typePrefix === 'video' ? 'videoChunks' : typePrefix === 'music' ? 'musicChunks' : 'fileChunks';
                            for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
                                const cref = doc(collection(db, col));
                                await setDoc(cref, { data: base64Data.substring(i, i + CHUNK_SIZE), part: i/CHUNK_SIZE, senderId: botId });
                                chunkIds.push(cref.id);
                            }
                            onUpdate(sIdx, bIdx, `${typePrefix}ChunkIds`, chunkIds);
                            onUpdate(sIdx, bIdx, `${typePrefix}MimeType`, file.type);
                            onUpdate(sIdx, bIdx, `${typePrefix}Status`, 'complete');
                            onUpdate(sIdx, bIdx, 'fileName', file.name);
                        } catch (err) { console.error(err); } finally { setIsUploading(false); }
                    }
                };
            } catch (err) { console.error(err); setIsUploading(false); }
        }
    };

    const renderParams = () => {
        const typePrefix = block.type.replace('action_send_', '');
        switch (block.type) {
            case 'action_send':
            case 'action_reply':
            case 'ui_header':
            case 'ui_text':
            case 'ui_button':
                return (
                    <div className="space-y-2 mt-1 w-full">
                        <Textarea placeholder={block.type === 'ui_button' ? "Текст кнопки..." : "Введите сообщение..."} value={block.params?.text || ''} onChange={e => onUpdate(sIdx, bIdx, 'text', e.target.value)} className="min-h-[60px] bg-black/10 border-none text-white placeholder:text-white/40 font-bold text-xs" rows={2} onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />
                        {block.type === 'ui_button' && <div className="space-y-1"><Label className="text-[8px] font-black uppercase opacity-50 ml-1">{t('button_id_label')}</Label><Textarea placeholder="main_menu_btn" value={block.params?.buttonId || ''} onChange={e => onUpdate(sIdx, bIdx, 'buttonId', e.target.value.toLowerCase().replace(/\s/g, '_'))} className="h-8 bg-black/10 border-none text-white placeholder:text-white/40 font-mono text-[10px]" rows={1} /></div>}
                    </div>
                );
            case 'action_ai_prompt':
                return (
                    <div className="space-y-1 mt-1 w-full">
                        <Label className="text-[8px] font-black uppercase opacity-50 ml-1">Системные инструкции (Промпт)</Label>
                        <Textarea placeholder="Пример: Ты саркастичный кот. Отвечай коротко." value={block.params?.prompt || ''} onChange={e => onUpdate(sIdx, bIdx, 'prompt', e.target.value)} className="min-h-[80px] bg-black/10 border-none text-white placeholder:text-white/40 font-bold text-xs" rows={3} />
                    </div>
                );
            case 'event_button_click':
                return (
                    <div className="space-y-1 mt-1 w-full">
                        <Label className="text-[8px] font-black uppercase opacity-50 ml-1">{t('button_id_label')}</Label>
                        <Textarea placeholder="my_button_id" value={block.params?.buttonId || ''} onChange={e => onUpdate(sIdx, bIdx, 'buttonId', e.target.value.toLowerCase().replace(/\s/g, '_'))} className="h-9 bg-black/10 border-none text-white placeholder:text-white/40 font-mono text-xs" rows={1} />
                    </div>
                );
            case 'action_send_image':
            case 'action_send_video':
            case 'action_send_music':
            case 'action_send_file':
                return (
                    <div className="space-y-2 mt-1 w-full overflow-hidden">
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" disabled={isUploading} className="h-9 flex-1 bg-black/10 hover:bg-black/20 text-white font-bold text-xs rounded-xl" onClick={() => fileInputRef.current?.click()}>
                                {isUploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
                                {block.params?.fileName ? t('file_selected') : t('choose_file')}
                            </Button>
                            <input type="file" ref={fileInputRef} className="hidden" accept={block.type === 'action_send_image' ? "image/*" : block.type === 'action_send_video' ? "video/*" : block.type === 'action_send_music' ? "audio/*" : "*/*"} onChange={handleFileSelect} />
                        </div>
                        {block.params?.fileName && <p className="text-[9px] font-bold opacity-60 truncate px-2">{block.params.fileName}</p>}
                        <Textarea placeholder="Описание (необязательно)..." value={block.params?.text || ''} onChange={e => onUpdate(sIdx, bIdx, 'text', e.target.value)} className="min-h-[40px] bg-black/10 border-none text-white placeholder:text-white/40 font-bold text-xs mt-1" rows={1} onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />
                    </div>
                );
            case 'logic_if':
                return <Textarea placeholder="Условие (напр. {msg_text} == привет)" value={block.params?.condition || ''} onChange={e => onUpdate(sIdx, bIdx, 'condition', e.target.value)} className="min-h-[40px] bg-black/10 border-none text-white font-bold text-xs mt-1" rows={1} onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} />;
            case 'variable_set':
            case 'variable_random':
                return (
                    <div className="flex flex-col gap-2 mt-1 w-full">
                        <Textarea placeholder="Имя переменной" value={block.params?.name || ''} onChange={e => onUpdate(sIdx, bIdx, 'name', e.target.value)} className="h-9 bg-black/10 border-none text-white font-bold text-xs" rows={1} />
                        <Textarea placeholder={block.type === 'variable_random' ? "Макс. число (напр. 100)" : "Значение"} value={block.params?.value || ''} onChange={e => onUpdate(sIdx, bIdx, 'value', e.target.value)} className="min-h-[40px] bg-black/10 border-none text-white font-bold text-xs" rows={1} />
                    </div>
                );
            case 'variable_math':
                return (
                    <div className="flex flex-col gap-2 mt-1 w-full">
                        <Textarea placeholder="Имя (напр. score)" value={block.params?.name || ''} onChange={e => onUpdate(sIdx, bIdx, 'name', e.target.value)} className="h-9 bg-black/10 border-none text-white font-bold text-xs" rows={1} />
                        <div className="flex gap-2">
                            <Select onValueChange={(v) => onUpdate(sIdx, bIdx, 'op', v)} value={block.params?.op || 'add'}>
                                <SelectTrigger className="h-9 bg-black/10 border-none text-white text-xs font-bold w-32"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-zinc-800 text-white border-none rounded-xl">
                                    <SelectItem value="add">Прибавить (+)</SelectItem>
                                    <SelectItem value="sub">Вычесть (-)</SelectItem>
                                    <SelectItem value="mul">Умножить (*)</SelectItem>
                                </SelectContent>
                            </Select>
                            <Textarea placeholder="Число" value={block.params?.value || ''} onChange={e => onUpdate(sIdx, bIdx, 'value', e.target.value)} className="h-9 flex-1 bg-black/10 border-none text-white font-bold text-xs" rows={1} />
                        </div>
                    </div>
                );
            case 'variable_clear':
                return <Textarea placeholder="Имя переменной для удаления" value={block.params?.name || ''} onChange={e => onUpdate(sIdx, bIdx, 'name', e.target.value)} className="h-9 bg-black/10 border-none text-white font-bold text-xs mt-1" rows={1} />;
            case 'action_wait':
                return <div className="flex items-center gap-2 mt-1"><Input type="number" min="1" max="60" value={block.params?.seconds || 1} onChange={e => onUpdate(sIdx, bIdx, 'seconds', parseInt(e.target.value))} className="w-20 h-9 bg-black/10 border-none text-white font-bold text-xs" /><span className="text-[10px] font-bold opacity-60">секунд</span></div>;
            case 'ui_separator':
                return <div className="h-px bg-white/20 w-full my-2" />;
            default: return null;
        }
    };

    return (
        <div className={cn("w-full p-4 rounded-3xl border-b-4 text-white shadow-xl relative group transition-all", isTrigger ? "" : "active:scale-[0.98]", BLOCK_COLORS[block.type])}>
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="p-1.5 bg-black/10 rounded-xl shrink-0"><Icon className="h-4 w-4" /></div>
                    <span className="font-black uppercase tracking-widest text-[10px] truncate">{t(`block_${block.type}` as any) || block.type}</span>
                </div>
                {!isTrigger && (
                    <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" disabled={isFirst} onClick={() => onMove(sIdx, bIdx, 'up', isMiniApp)} className="h-7 w-7 rounded-lg bg-black/10 hover:bg-black/20 text-white disabled:opacity-20"><ChevronUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" disabled={isLast} onClick={() => onMove(sIdx, bIdx, 'down', isMiniApp)} className="h-7 w-7 rounded-lg bg-black/10 hover:bg-black/20 text-white disabled:opacity-20"><ChevronDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(sIdx, bIdx, isMiniApp)} className="h-7 w-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-white ml-1 sm:ml-2"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                )}
            </div>
            <div className="w-full whitespace-pre-wrap">{renderParams()}</div>
        </div>
    );
}