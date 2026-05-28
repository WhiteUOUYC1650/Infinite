'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import type { CustomBot, BotBlock, BotBlockType, BotScript } from '@/types';
import { useLanguage } from '@/context/language-context';
import { ArrowLeft, Save, Plus, Trash2, MessageSquare, Clock, Ghost, Code2, ChevronDown, ChevronUp, Wand2, Split, Database, Image as ImageIcon, Check, Zap, Pencil, Bot, Settings, Loader2, ListTree, X, Video, Music, FileText, Upload } from 'lucide-react';
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
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useTheme } from '@/context/theme-context';

const BLOCK_COLORS: Record<BotBlockType, string> = {
  event_start: 'bg-orange-600 border-orange-700',
  event_message: 'bg-orange-500 border-orange-600',
  action_send: 'bg-blue-500 border-blue-600',
  action_reply: 'bg-indigo-500 border-indigo-600',
  action_wait: 'bg-amber-500 border-amber-600',
  condition_if_text: 'bg-emerald-500 border-emerald-600',
  action_reaction: 'bg-pink-500 border-pink-600',
  logic_if: 'bg-purple-600 border-purple-700',
  logic_else: 'bg-purple-500 border-purple-600',
  logic_end_if: 'bg-purple-400 border-purple-500',
  variable_set: 'bg-rose-500 border-rose-600',
  action_send_image: 'bg-cyan-500 border-cyan-600',
  action_send_video: 'bg-slate-500 border-slate-600',
  action_send_music: 'bg-green-600 border-green-700',
  action_send_file: 'bg-zinc-600 border-zinc-700',
};

const BLOCK_ICONS: Record<BotBlockType, any> = {
  event_start: Zap,
  event_message: MessageSquare,
  action_send: MessageSquare,
  action_reply: Wand2,
  action_wait: Clock,
  condition_if_text: Code2,
  action_reaction: Ghost,
  logic_if: Split,
  logic_else: Split,
  logic_end_if: Check,
  variable_set: Database,
  action_send_image: ImageIcon,
  action_send_video: Video,
  action_send_music: Music,
  action_send_file: FileText,
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
  
  const [scripts, setScripts] = useState<BotScript[]>(bot.scripts || []);
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
        const updateData = { scripts, avatar: botAvatar || null, name: botName, description: botDescription };
        await updateDoc(botRef, updateData);
        await updateDoc(userRef, { avatar: botAvatar || null, name: botName, statusMessage: botDescription });
        toast({ title: t('dm_success'), description: t('chat_update_success') });
    } catch (e: any) { 
        console.error(e); 
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setIsSaving(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => setImageToCrop(reader.result?.toString() || '');
      reader.readAsDataURL(file);
    }
  };

  const onAddFromFab = (type: BotBlockType) => {
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
    const script = { ...newScripts[sIdx] };
    const blocks = [...script.blocks];
    
    // Don't move trigger blocks (index 0)
    if (bIdx === 0) return;

    if (direction === 'up') {
        if (bIdx > 1) {
            // Standard swap within script
            const temp = blocks[bIdx];
            blocks[bIdx] = blocks[bIdx - 1];
            blocks[bIdx - 1] = temp;
            newScripts[sIdx] = { ...script, blocks };
        } else if (sIdx > 0) {
            // Move to end of previous script
            const prevScript = { ...newScripts[sIdx - 1] };
            const prevBlocks = [...prevScript.blocks];
            const blockToMove = blocks.splice(bIdx, 1)[0];
            prevBlocks.push(blockToMove);
            
            newScripts[sIdx - 1] = { ...prevScript, blocks: prevBlocks };
            newScripts[sIdx] = { ...script, blocks };
        }
    } else { // direction === 'down'
        if (bIdx < blocks.length - 1) {
            // Standard swap within script
            const temp = blocks[bIdx];
            blocks[bIdx] = blocks[bIdx + 1];
            blocks[bIdx + 1] = temp;
            newScripts[sIdx] = { ...script, blocks };
        } else if (sIdx < newScripts.length - 1) {
            // Move to start (after trigger) of next script
            const nextScript = { ...newScripts[sIdx + 1] };
            const nextBlocks = [...nextScript.blocks];
            const blockToMove = blocks.splice(bIdx, 1)[0];
            nextBlocks.splice(1, 0, blockToMove);
            
            newScripts[sIdx + 1] = { ...nextScript, blocks: nextBlocks };
            newScripts[sIdx] = { ...script, blocks };
        }
    }
    setScripts(newScripts);
  };

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      <header className={cn(
          "flex-shrink-0 flex items-center p-4 border-b z-20 pt-[calc(1rem+env(safe-area-inset-top))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]",
          colorTheme === 'frutiger' ? 'bg-white/85 dark:bg-black/80 backdrop-blur-2xl' : 'bg-background/95 backdrop-blur-md'
      )}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={onBack}>
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
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                <div className="min-w-0">
                    <h1 className="text-base font-black font-headline truncate leading-tight">{botName}</h1>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Bot Editor</p>
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
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
        
        <div className="w-full px-4 py-8 md:px-8 md:py-16 space-y-12 pb-32">
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
                                isFirst={bIdx === 1 && sIdx === 0}
                                isLast={bIdx === script.blocks.length - 1 && sIdx === scripts.length - 1}
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
      </main>

      {/* Floating Action Button */}
      <div className="absolute bottom-8 right-8 z-[30]">
          <Button 
            onClick={() => setBlockSelectorOpen(true)}
            className="h-16 w-16 rounded-full font-black shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all p-0 flex items-center justify-center"
          >
            <Plus className="h-8 w-8" strokeWidth={3} />
          </Button>
      </div>

      <Dialog open={blockSelectorOpen} onOpenChange={setBlockSelectorOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl p-0 overflow-hidden flex flex-col h-[70vh]">
              <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
                  <DialogTitle className="text-xl font-bold font-headline">Добавить блок</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="events" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="mx-6 mt-4 grid grid-cols-4 bg-muted/50 p-1 rounded-xl">
                      <TabsTrigger value="events" className="rounded-lg text-[10px] uppercase font-bold px-1">События</TabsTrigger>
                      <TabsTrigger value="actions" className="rounded-lg text-[10px] uppercase font-bold px-1">Действия</TabsTrigger>
                      <TabsTrigger value="logic" className="rounded-lg text-[10px] uppercase font-bold px-1">Логика</TabsTrigger>
                      <TabsTrigger value="vars" className="rounded-lg text-[10px] uppercase font-bold px-1">Память</TabsTrigger>
                  </TabsList>
                  <ScrollArea className="flex-1 p-4 sm:p-6">
                      <TabsContent value="events" className="mt-0 space-y-2">
                          <PaletteItem type="event_start" label={t('block_event_start')} onClick={onAddFromFab} />
                          <PaletteItem type="event_message" label={t('block_event_received')} onClick={onAddFromFab} />
                      </TabsContent>
                      <TabsContent value="actions" className="mt-0 space-y-2">
                          <PaletteItem type="action_send" label={t('block_action_send')} onClick={onAddFromFab} />
                          <PaletteItem type="action_reply" label={t('block_action_reply')} onClick={onAddFromFab} />
                          <PaletteItem type="action_send_image" label="Отправить фото" onClick={onAddFromFab} />
                          <PaletteItem type="action_send_video" label={t('action_send_video')} onClick={onAddFromFab} />
                          <PaletteItem type="action_send_music" label={t('action_send_music')} onClick={onAddFromFab} />
                          <PaletteItem type="action_send_file" label={t('action_send_file')} onClick={onAddFromFab} />
                      </TabsContent>
                      <TabsContent value="logic" className="mt-0 space-y-2">
                          <PaletteItem type="logic_if" label="Если" onClick={onAddFromFab} />
                          <PaletteItem type="logic_else" label="Иначе" onClick={onAddFromFab} />
                          <PaletteItem type="logic_end_if" label="Конец если" onClick={onAddFromFab} />
                          <PaletteItem type="action_wait" label="Подождать" onClick={onAddFromFab} />
                      </TabsContent>
                      <TabsContent value="vars" className="mt-0 space-y-2">
                          <PaletteItem type="variable_set" label="Установить переменную" onClick={onAddFromFab} />
                      </TabsContent>
                  </ScrollArea>
              </Tabs>
          </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-none shadow-2xl">
              <DialogHeader className="items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Settings className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                      <DialogTitle className="text-2xl font-bold font-headline">Bot Settings</DialogTitle>
                      <DialogDescription>Manage your bot's public identity.</DialogDescription>
                  </div>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t('bot_name_label')}</Label>
                      <Input value={botName} onChange={e => setBotName(e.target.value)} className="rounded-xl h-12 bg-muted/50 border-none focus-visible:ring-primary font-bold" />
                  </div>
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">About Bot / Status</Label>
                      <Textarea value={botDescription} onChange={e => setBotDescription(e.target.value)} className="rounded-xl bg-muted/50 border-none focus-visible:ring-primary min-h-[100px]" />
                  </div>
              </div>
              <DialogFooter className="gap-2">
                  <Button variant="ghost" onClick={() => setIsSettingsOpen(false)} className="rounded-xl flex-1">{t('cancel')}</Button>
                  <Button onClick={() => setIsSettingsOpen(false)} className="rounded-xl flex-[2] font-bold">Apply Changes</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={!!imageToCrop} onOpenChange={(open) => !open && setImageToCrop('')}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] sm:max-w-md rounded-3xl overflow-hidden p-6 flex flex-col">
            <DialogHeader>
                <DialogTitle>Crop Bot Avatar</DialogTitle>
                <DialogDescription>Adjust the frame to set your bot's look.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 flex justify-center my-4 overflow-hidden min-h-0">
                <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={c => setCompletedCrop(c)} aspect={1}>
                    <img ref={imgRef} src={imageToCrop} alt="Crop" onLoad={onImageLoad} className="max-h-[50vh] object-contain" />
                </ReactCrop>
            </div>
            <DialogFooter className="gap-2 pt-4">
                <Button variant="ghost" onClick={() => setImageToCrop('')} className="rounded-xl">{t('cancel')}</Button>
                <Button onClick={handleCropConfirm} disabled={isCropping} className="rounded-xl font-bold">
                    {isCropping && <Clock className="mr-2 h-4 w-4 animate-spin" />} Set Avatar
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function handleCropConfirm() {
    if (!completedCrop || !imgRef.current) return;
    setIsCropping(true);
    getCroppedImg(imgRef.current, completedCrop).then(c => {
        setBotAvatar(c);
        setImageToCrop('');
    }).finally(() => setIsCropping(false));
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }
}

function PaletteItem({ type, label, onClick }: { type: BotBlockType, label: string, onClick: (t: BotBlockType) => void }) {
    const Icon = BLOCK_ICONS[type];
    return (
        <button 
            onClick={() => onClick(type)}
            className={cn(
                "w-full p-3 rounded-2xl border-b-4 text-white font-bold flex items-center gap-4 transition-all active:scale-95 hover:brightness-110 shadow-md",
                BLOCK_COLORS[type]
            )}
        >
            <div className="p-2 bg-black/10 rounded-xl shrink-0"><Icon className="h-5 w-5" /></div>
            <span className="text-sm truncate">{label}</span>
        </button>
    );
}

function BotBlockComponent({ block, sIdx, bIdx, isFirst, isLast, onUpdate, onDelete, onMove, db, botId }: { block: BotBlock, sIdx: number, bIdx: number, isFirst: boolean, isLast: boolean, onUpdate: any, onDelete: any, onMove: any, db: any, botId: string }) {
    const { t } = useLanguage();
    const Icon = BLOCK_ICONS[block.type];
    const isTrigger = bIdx === 0;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                if (block.type === 'action_send_image') {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => {
                        onUpdate(sIdx, bIdx, 'imageUrl', reader.result);
                        onUpdate(sIdx, bIdx, 'fileName', file.name);
                        setIsUploading(false);
                    };
                } else {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = async () => {
                        try {
                            const base64 = (reader.result as string).split(',')[1];
                            const CHUNK_SIZE = 900 * 1024;
                            const chunkIds: string[] = [];
                            const typePrefix = block.type.replace('action_send_', '');
                            const col = typePrefix === 'video' ? 'videoChunks' : typePrefix === 'music' ? 'musicChunks' : 'fileChunks';
                            
                            for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
                                const cref = doc(collection(db, col));
                                await setDoc(cref, { data: base64.substring(i, i + CHUNK_SIZE), part: i/CHUNK_SIZE, senderId: botId });
                                chunkIds.push(cref.id);
                            }
                            
                            onUpdate(sIdx, bIdx, `${typePrefix}ChunkIds`, chunkIds);
                            onUpdate(sIdx, bIdx, `${typePrefix}MimeType`, file.type);
                            onUpdate(sIdx, bIdx, `${typePrefix}Status`, 'complete');
                            onUpdate(sIdx, bIdx, 'fileName', file.name);
                        } catch (err) {
                            console.error("Bot media upload failed:", err);
                        } finally {
                            setIsUploading(false);
                        }
                    };
                }
            } catch (err) {
                console.error(err);
                setIsUploading(false);
            }
        }
    };

    const renderParams = () => {
        const typePrefix = block.type.replace('action_send_', '');
        const chunkIds = block.params?.[`${typePrefix}ChunkIds`];

        switch (block.type) {
            case 'action_send':
            case 'action_reply':
                return <Input placeholder="Введите сообщение..." value={block.params?.text || ''} onChange={e => onUpdate(sIdx, bIdx, 'text', e.target.value)} className="h-9 bg-black/10 border-none text-white placeholder:text-white/40 font-bold text-xs mt-1" />;
            case 'action_send_image':
            case 'action_send_video':
            case 'action_send_music':
            case 'action_send_file':
                return (
                    <div className="space-y-2 mt-1">
                        <div className="flex gap-2">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                disabled={isUploading}
                                className="h-9 flex-1 bg-black/10 hover:bg-black/20 text-white font-bold text-xs rounded-xl"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {isUploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
                                {block.params?.fileName ? t('file_selected') : t('choose_file')}
                            </Button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept={block.type === 'action_send_image' ? "image/*" : block.type === 'action_send_video' ? "video/*" : block.type === 'action_send_music' ? "audio/*" : "*/*"} 
                                onChange={handleFileSelect} 
                            />
                        </div>
                        {block.params?.fileName && (
                            <p className="text-[9px] font-bold opacity-60 truncate px-2">{block.params.fileName}</p>
                        )}
                        {chunkIds && (
                             <div className="px-2 py-1 bg-black/20 rounded-lg border border-white/10 mt-1">
                                <p className="text-[7px] font-mono opacity-50 truncate uppercase">Chunks: {chunkIds.slice(0, 2).join(', ')}...</p>
                             </div>
                        )}
                        <Input placeholder="Описание (необязательно)..." value={block.params?.text || ''} onChange={e => onUpdate(sIdx, bIdx, 'text', e.target.value)} className="h-9 bg-black/10 border-none text-white placeholder:text-white/40 font-bold text-xs mt-1" />
                    </div>
                );
            case 'logic_if':
                return <Input placeholder="Условие (напр. {msg_text} == старт)" value={block.params?.condition || ''} onChange={e => onUpdate(sIdx, bIdx, 'condition', e.target.value)} className="h-9 bg-black/10 border-none text-white placeholder:text-white/40 font-bold text-xs mt-1" />;
            case 'variable_set':
                return (
                    <div className="flex flex-col sm:flex-row gap-2 mt-1">
                        <Input placeholder="Имя" value={block.params?.name || ''} onChange={e => onUpdate(sIdx, bIdx, 'name', e.target.value)} className="h-9 flex-1 bg-black/10 border-none text-white placeholder:text-white/40 font-bold text-xs" />
                        <Input placeholder="Значение" value={block.params?.value || ''} onChange={e => onUpdate(sIdx, bIdx, 'value', e.target.value)} className="h-9 flex-1 bg-black/10 border-none text-white placeholder:text-white/40 font-bold text-xs" />
                    </div>
                );
            case 'action_wait':
                return <Input type="number" min="1" max="60" value={block.params?.seconds || 1} onChange={e => onUpdate(sIdx, bIdx, 'seconds', parseInt(e.target.value))} className="w-20 h-9 bg-black/10 border-none text-white font-bold text-xs mt-1" />;
            default: return null;
        }
    };

    return (
        <div className={cn("w-full p-4 rounded-3xl border-b-4 text-white shadow-xl relative group transition-all", isTrigger ? "" : "active:scale-[0.98]", BLOCK_COLORS[block.type])}>
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-black/10 rounded-xl shrink-0"><Icon className="h-4 w-4" /></div>
                    <span className="font-black uppercase tracking-widest text-[10px] truncate">{t(`block_${block.type.replace('action_', '').replace('event_', '').replace('logic_', '')}` as any) || block.type}</span>
                </div>
                
                {!isTrigger && (
                    <div className="flex items-center gap-1 shrink-0">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={isFirst} 
                            onClick={() => onMove(sIdx, bIdx, 'up')}
                            className="h-7 w-7 rounded-lg bg-black/10 hover:bg-black/20 text-white disabled:opacity-20"
                        >
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={isLast} 
                            onClick={() => onMove(sIdx, bIdx, 'down')}
                            className="h-7 w-7 rounded-lg bg-black/10 hover:bg-black/20 text-white disabled:opacity-20"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onDelete(sIdx, bIdx)}
                            className="h-7 w-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-white ml-1 sm:ml-2"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
            {renderParams()}
        </div>
    );
}
