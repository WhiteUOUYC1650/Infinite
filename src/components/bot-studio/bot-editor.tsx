
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import type { CustomBot, BotBlock, BotBlockType, BotScript } from '@/types';
import { useLanguage } from '@/context/language-context';
import { ArrowLeft, Save, Plus, Trash2, Play, MousePointer2, MessageSquare, Clock, Ghost, Code2, ChevronDown, Wand2, Split, Database, Image as ImageIcon, Check, Zap, Pencil, Bot, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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
  
  const [scripts, setScripts] = useState<BotScript[]>(bot.scripts || []);
  const [botAvatar, setBotAvatar] = useState<string | undefined>(bot.avatar);
  const [botName, setBotName] = useState(bot.name);
  const [botDescription, setBotDescription] = useState(bot.description || '');
  const [isSaving, setIsSaving] = useState(false);

  // Bot Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Avatar Edit State
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
        
        const updateData = { 
            scripts, 
            avatar: botAvatar || null,
            name: botName,
            description: botDescription
        };
        
        await updateDoc(botRef, updateData);
        await updateDoc(userRef, { 
            avatar: botAvatar || null,
            name: botName,
            statusMessage: botDescription
        });
        
        toast({ title: t('dm_success'), description: t('chat_update_success') });
    } catch (e: any) { 
        console.error(e); 
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
    finally { setIsSaving(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'Error', description: 'Image too large (max 2MB)' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setImageToCrop(reader.result?.toString() || '');
      reader.readAsDataURL(file);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  };

  const handleCropConfirm = async () => {
    if (!completedCrop || !imgRef.current) return;
    setIsCropping(true);
    try {
      const cropped = await getCroppedImg(imgRef.current, completedCrop);
      setBotAvatar(cropped);
      setImageToCrop('');
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Cropping failed' });
    } finally {
      setIsCropping(false);
    }
  };

  const addStack = (type: BotBlockType) => {
    const newBlock: BotBlock = { id: Math.random().toString(36).substr(2, 9), type, params: {} };
    setScripts([...scripts, { id: Math.random().toString(36).substr(2, 9), blocks: [newBlock] }]);
  };

  const addBlockToStack = (stackIndex: number, type: BotBlockType) => {
    const newBlock: BotBlock = { id: Math.random().toString(36).substr(2, 9), type, params: {} };
    const newScripts = [...scripts];
    newScripts[stackIndex].blocks = [...newScripts[stackIndex].blocks, newBlock];
    setScripts(newScripts);
  };

  const handlePaletteClick = (type: BotBlockType) => {
      if (type.startsWith('event_')) {
          addStack(type);
      } else if (scripts.length > 0) {
          addBlockToStack(scripts.length - 1, type);
      } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Start with an event block first.' });
      }
  };

  const updateBlockParam = (stackIndex: number, blockIndex: number, key: string, value: any) => {
    const newScripts = [...scripts];
    newScripts[stackIndex].blocks[blockIndex].params = { ...newScripts[stackIndex].blocks[blockIndex].params, [key]: value };
    setScripts(newScripts);
  };

  const removeBlock = (stackIndex: number, blockIndex: number) => {
    const newScripts = [...scripts];
    newScripts[stackIndex].blocks.splice(blockIndex, 1);
    if (newScripts[stackIndex].blocks.length === 0) {
        newScripts.splice(stackIndex, 1);
    }
    setScripts(newScripts);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b px-4 bg-card shrink-0 z-10">
        <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-3 min-w-0">
                <div className="relative group/avatar cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
                    <Avatar className="h-10 w-10 border-2 border-primary/20 transition-all group-hover/avatar:border-primary/50">
                        <AvatarImage src={botAvatar} className="object-cover" />
                        <AvatarFallback className="bg-muted">
                            <Bot className="h-5 w-5 text-muted-foreground" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1 border-2 border-background shadow-sm scale-75 opacity-0 group-hover/avatar:opacity-100 transition-all">
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
        
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="rounded-xl h-10 w-10">
                <Settings className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="rounded-xl gap-2 font-bold bg-green-600 hover:bg-green-700 h-10 px-6 shadow-lg shadow-green-600/20">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="hidden sm:inline">{t('save')}</span>
            </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Toolbox */}
        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r bg-muted/20 p-4 shrink-0 overflow-y-auto">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Palette</h3>
            <div className="space-y-2">
                <BlockDraft type="event_start" label={t('block_event_start')} onClick={() => handlePaletteClick('event_start')} />
                <BlockDraft type="event_message" label={t('block_event_received')} onClick={() => handlePaletteClick('event_message')} />
                <div className="h-px bg-border my-2" />
                <BlockDraft type="action_send" label={t('block_action_send')} onClick={() => handlePaletteClick('action_send')} />
                <BlockDraft type="action_reply" label={t('block_action_reply')} onClick={() => handlePaletteClick('action_reply')} />
                <BlockDraft type="action_send_image" label={t('block_action_send_image' as any) || 'Send Image'} onClick={() => handlePaletteClick('action_send_image')} />
                <div className="h-px bg-border my-2" />
                <BlockDraft type="logic_if" label={t('block_logic_if' as any) || 'If'} onClick={() => handlePaletteClick('logic_if')} />
                <BlockDraft type="logic_else" label={t('block_logic_else' as any) || 'Else'} onClick={() => handlePaletteClick('logic_else')} />
                <BlockDraft type="logic_end_if" label={t('block_logic_end_if' as any) || 'End If'} onClick={() => handlePaletteClick('logic_end_if')} />
                <div className="h-px bg-border my-2" />
                <BlockDraft type="variable_set" label={t('block_variable_set' as any) || 'Set Variable'} onClick={() => handlePaletteClick('variable_set')} />
                <BlockDraft type="action_wait" label={t('block_action_wait').replace('{seconds}', '1')} onClick={() => handlePaletteClick('action_wait')} />
            </div>
            <div className="mt-6 p-4 rounded-2xl border bg-card/50 text-[10px] text-muted-foreground leading-relaxed italic">
                Tip: Use <span className="font-bold text-primary">{'{msg_text}'}</span> in variables or conditions to capture message content.
            </div>
        </aside>

        {/* Workspace */}
        <main className="flex-1 bg-muted/10 overflow-auto p-4 md:p-12 relative">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
            
            <div className="max-w-3xl mx-auto space-y-16">
                {scripts.map((script, sIdx) => (
                    <div key={script.id} className="relative animate-in slide-in-from-bottom-4 duration-300">
                        <div className="absolute -top-6 left-4 bg-muted px-2 py-0.5 rounded-t-lg text-[8px] font-black uppercase tracking-widest text-muted-foreground">Script #{sIdx + 1}</div>
                        
                        <div className="flex flex-col items-center">
                            {script.blocks.map((block, bIdx) => (
                                <React.Fragment key={block.id}>
                                    <BotBlockComponent 
                                        block={block} 
                                        stackIndex={sIdx} 
                                        blockIndex={bIdx}
                                        onUpdate={updateBlockParam}
                                        onDelete={removeBlock}
                                    />
                                    {bIdx < script.blocks.length - 1 && (
                                        <div className="w-2 h-4 bg-muted/40" />
                                    )}
                                </React.Fragment>
                            ))}

                            <div className="w-2 h-4 bg-muted/40" />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="w-12 h-8 bg-card border-2 border-dashed rounded-lg flex items-center justify-center hover:border-primary/50 transition-colors">
                                        <Plus className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="rounded-xl w-56">
                                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Add Block</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'action_send')}>
                                        <MessageSquare className="h-4 w-4 mr-2 text-blue-500" /> {t('block_action_send')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'action_reply')}>
                                        <Wand2 className="h-4 w-4 mr-2 text-indigo-500" /> {t('block_action_reply')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'action_send_image')}>
                                        <ImageIcon className="h-4 w-4 mr-2 text-cyan-500" /> Image
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'logic_if')}>
                                        <Split className="h-4 w-4 mr-2 text-purple-500" /> {t('block_logic_if' as any) || 'If'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'logic_else')}>
                                        <Split className="h-4 w-4 mr-2 text-purple-500" /> {t('block_logic_else' as any) || 'Else'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'logic_end_if')}>
                                        <Check className="h-4 w-4 mr-2 text-purple-500" /> {t('block_logic_end_if' as any) || 'End If'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'variable_set')}>
                                        <Database className="h-4 w-4 mr-2 text-rose-500" /> {t('block_variable_set' as any) || 'Variable'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'action_wait')}>
                                        <Clock className="h-4 w-4 mr-2 text-amber-500" /> {t('block_action_wait').replace('{seconds}', '1')}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}

                {scripts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
                        <div className="w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center">
                            <MousePointer2 className="h-8 w-8 opacity-20" />
                        </div>
                        <p className="font-bold text-sm uppercase tracking-widest opacity-40">Choose an event block to start</p>
                    </div>
                )}
            </div>
        </main>
      </div>

      {/* Bot Details Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-md rounded-3xl border-none shadow-2xl">
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
                      <Input 
                        value={botName} 
                        onChange={e => setBotName(e.target.value)} 
                        className="rounded-xl h-12 bg-muted/50 border-none focus-visible:ring-primary font-bold"
                        placeholder="My Awesome Bot"
                      />
                  </div>
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">About Bot / Status</Label>
                      <Textarea 
                        value={botDescription} 
                        onChange={e => setBotDescription(e.target.value)} 
                        className="rounded-xl bg-muted/50 border-none focus-visible:ring-primary resize-none min-h-[100px]"
                        placeholder="What does this bot do?"
                      />
                  </div>
              </div>

              <DialogFooter className="gap-2">
                  <Button variant="ghost" onClick={() => setIsSettingsOpen(false)} className="rounded-xl flex-1">{t('cancel')}</Button>
                  <Button onClick={() => setIsSettingsOpen(false)} className="rounded-xl flex-[2] font-bold">Apply Changes</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={!!imageToCrop} onOpenChange={(open) => !open && setImageToCrop('')}>
        <DialogContent className="max-w-md rounded-3xl overflow-hidden p-6">
            <DialogHeader>
                <DialogTitle>Crop Bot Avatar</DialogTitle>
                <DialogDescription>Adjust the frame to set your bot's look.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center my-4 overflow-hidden">
                <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={c => setCompletedCrop(c)} aspect={1}>
                    <img ref={imgRef} src={imageToCrop} alt="Crop" onLoad={onImageLoad} className="max-h-[50vh] object-contain" />
                </ReactCrop>
            </div>
            <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setImageToCrop('')} className="rounded-xl">{t('cancel')}</Button>
                <Button onClick={handleCropConfirm} disabled={isCropping} className="rounded-xl font-bold">
                    {isCropping && <Clock className="mr-2 h-4 w-4 animate-spin" />}
                    Set Avatar
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlockDraft({ type, label, onClick }: { type: BotBlockType, label: string, onClick: () => void }) {
    const Icon = BLOCK_ICONS[type];
    return (
        <button 
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            }}
            className={cn(
                "w-full p-2.5 rounded-xl border-b-4 text-white text-[11px] font-bold flex items-center gap-3 shadow-sm transition-all active:scale-95 hover:brightness-110 text-left", 
                BLOCK_COLORS[type]
            )}
        >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
        </button>
    );
}

function BotBlockComponent({ 
    block, 
    stackIndex, 
    blockIndex, 
    onUpdate, 
    onDelete 
}: { 
    block: BotBlock, 
    stackIndex: number, 
    blockIndex: number,
    onUpdate: (s: number, b: number, k: string, v: any) => void,
    onDelete: (s: number, b: number) => void
}) {
    const { t } = useLanguage();
    const Icon = BLOCK_ICONS[block.type];

    const renderParams = () => {
        switch (block.type) {
            case 'action_send':
            case 'action_reply':
                return (
                    <Input 
                        placeholder={t('message_placeholder')}
                        value={block.params?.text || ''}
                        onChange={e => onUpdate(stackIndex, blockIndex, 'text', e.target.value)}
                        className="h-8 bg-black/10 border-none text-white placeholder:text-white/40 focus-visible:ring-white/20 mt-1 font-bold text-xs"
                    />
                );
            case 'action_send_image':
                return (
                    <Input 
                        placeholder="Image URL or Base64"
                        value={block.params?.imageUrl || ''}
                        onChange={e => onUpdate(stackIndex, blockIndex, 'imageUrl', e.target.value)}
                        className="h-8 bg-black/10 border-none text-white placeholder:text-white/40 focus-visible:ring-white/20 mt-1 font-bold text-xs"
                    />
                );
            case 'logic_if':
                return (
                    <div className="space-y-2 mt-1">
                        <Input 
                            placeholder="Condition (e.g. {msg_text} == start)"
                            value={block.params?.condition || ''}
                            onChange={e => onUpdate(stackIndex, blockIndex, 'condition', e.target.value)}
                            className="h-8 bg-black/10 border-none text-white placeholder:text-white/40 focus-visible:ring-white/20 font-bold text-xs"
                        />
                    </div>
                );
            case 'variable_set':
                return (
                    <div className="flex gap-2 mt-1">
                        <Input 
                            placeholder="Name"
                            value={block.params?.name || ''}
                            onChange={e => onUpdate(stackIndex, blockIndex, 'name', e.target.value)}
                            className="h-8 flex-1 bg-black/10 border-none text-white placeholder:text-white/40 focus-visible:ring-white/20 font-bold text-xs"
                        />
                        <Input 
                            placeholder="Value (e.g. {msg_text})"
                            value={block.params?.value || ''}
                            onChange={e => onUpdate(stackIndex, blockIndex, 'value', e.target.value)}
                            className="h-8 flex-1 bg-black/10 border-none text-white placeholder:text-white/40 focus-visible:ring-white/20 font-bold text-xs"
                        />
                    </div>
                );
            case 'action_wait':
                return (
                    <Input 
                        type="number"
                        min="1"
                        max="60"
                        value={block.params?.seconds || 1}
                        onChange={e => onUpdate(stackIndex, blockIndex, 'seconds', parseInt(e.target.value))}
                        className="w-20 h-8 bg-black/10 border-none text-white focus-visible:ring-white/20 mt-1 font-bold text-xs"
                    />
                );
            default:
                return null;
        }
    };

    const getLabel = () => {
        if (block.type === 'event_message') return t('block_event_received');
        if (block.type === 'event_start') return t('block_event_start');
        
        const key = `block_${block.type.replace('action_', '').replace('event_', '').replace('condition_', '').replace('logic_', '').replace('variable_', '')}` as any;
        return t(key) || block.type;
    };

    return (
        <div className={cn(
            "w-full max-w-[320px] p-4 rounded-2xl border-b-4 text-white shadow-lg relative group",
            BLOCK_COLORS[block.type]
        )}>
            <button 
                onClick={() => onDelete(stackIndex, blockIndex)}
                className="absolute -right-2 -top-2 bg-background text-foreground border h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:text-destructive"
            >
                <XIcon className="h-3 w-3" />
            </button>

            <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 bg-black/10 rounded-lg">
                    <Icon className="h-4 w-4" />
                </div>
                <span className="font-black uppercase tracking-widest text-[10px]">
                    {getLabel()}
                </span>
            </div>

            {renderParams()}
        </div>
    );
}

function XIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6L6 18M6 6l12 12" />
        </svg>
    );
}
