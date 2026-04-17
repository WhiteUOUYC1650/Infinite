
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import type { CustomBot, BotBlock, BotBlockType } from '@/types';
import { useLanguage } from '@/context/language-context';
import { ArrowLeft, Save, Plus, Trash2, Play, MousePointer2, MessageSquare, Clock, Ghost, Code2, ChevronDown, MoveHorizontal, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const BLOCK_COLORS: Record<BotBlockType, string> = {
  event_start: 'bg-orange-500 border-orange-600',
  action_send: 'bg-blue-500 border-blue-600',
  action_reply: 'bg-indigo-500 border-indigo-600',
  action_wait: 'bg-amber-500 border-amber-600',
  condition_if_text: 'bg-emerald-500 border-emerald-600',
  action_reaction: 'bg-pink-500 border-pink-600',
};

const BLOCK_ICONS: Record<BotBlockType, any> = {
  event_start: Play,
  action_send: MessageSquare,
  action_reply: Wand2,
  action_wait: Clock,
  condition_if_text: Code2,
  action_reaction: Ghost,
};

export function BotEditor({ bot, onBack }: { bot: CustomBot, onBack: () => void }) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const [scripts, setScripts] = useState<BotBlock[][]>(bot.scripts || []);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, 'customBots', bot.id), (snap) => {
        if (snap.exists()) {
            setScripts(snap.data().scripts || []);
        }
    });
  }, [bot.id, db]);

  const handleSave = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
        await updateDoc(doc(db, 'customBots', bot.id), { scripts });
        toast({ title: t('dm_success'), description: t('chat_update_success') });
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  const addStack = (type: BotBlockType = 'event_start') => {
    const newBlock: BotBlock = { id: Math.random().toString(36).substr(2, 9), type, params: type === 'event_start' ? {} : { text: '' } };
    setScripts([...scripts, [newBlock]]);
  };

  const addBlockToStack = (stackIndex: number, type: BotBlockType) => {
    const newBlock: BotBlock = { id: Math.random().toString(36).substr(2, 9), type, params: { text: '' } };
    const newScripts = [...scripts];
    newScripts[stackIndex] = [...newScripts[stackIndex], newBlock];
    setScripts(newScripts);
  };

  const updateBlockParam = (stackIndex: number, blockIndex: number, key: string, value: any) => {
    const newScripts = [...scripts];
    newScripts[stackIndex][blockIndex].params = { ...newScripts[stackIndex][blockIndex].params, [key]: value };
    setScripts(newScripts);
  };

  const removeBlock = (stackIndex: number, blockIndex: number) => {
    const newScripts = [...scripts];
    newScripts[stackIndex].splice(blockIndex, 1);
    if (newScripts[stackIndex].length === 0) {
        newScripts.splice(stackIndex, 1);
    }
    setScripts(newScripts);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b px-4 bg-card shrink-0 z-10">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
                <h1 className="text-lg font-bold font-headline truncate">{bot.name}</h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bot Editor</p>
            </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="rounded-xl gap-2 font-bold bg-green-600 hover:bg-green-700 h-10">
            <Save className="h-4 w-4" />
            <span>{t('save')}</span>
        </Button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Toolbox */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-muted/20 p-4 shrink-0 overflow-y-auto">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Palette</h3>
            <div className="space-y-3">
                <BlockDraft type="event_start" label={t('block_event_received')} />
                <div className="h-px bg-border my-4" />
                <BlockDraft type="action_send" label={t('block_action_send')} />
                <BlockDraft type="action_reply" label={t('block_action_reply')} />
                <BlockDraft type="action_wait" label={t('block_action_wait').replace('{seconds}', '1')} />
                <BlockDraft type="condition_if_text" label={t('block_condition_if').replace('{text}', '...')} />
            </div>
            <Button onClick={() => addStack()} className="w-full mt-8 rounded-2xl h-14 border-2 border-dashed border-primary/40 bg-transparent text-primary hover:bg-primary/5 font-black uppercase tracking-widest text-[10px]">
                <Plus className="mr-2 h-4 w-4" /> New Script
            </Button>
        </aside>

        {/* Workspace */}
        <main className="flex-1 bg-muted/10 overflow-auto p-4 md:p-12 relative">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
            
            <div className="max-w-3xl mx-auto space-y-16">
                {scripts.map((stack, sIdx) => (
                    <div key={sIdx} className="relative animate-in slide-in-from-bottom-4 duration-300">
                        {/* Stack Header */}
                        <div className="absolute -top-6 left-4 bg-muted px-2 py-0.5 rounded-t-lg text-[8px] font-black uppercase tracking-widest text-muted-foreground">Script #{sIdx + 1}</div>
                        
                        <div className="flex flex-col items-center">
                            {stack.map((block, bIdx) => (
                                <React.Fragment key={block.id}>
                                    <BotBlockComponent 
                                        block={block} 
                                        stackIndex={sIdx} 
                                        blockIndex={bIdx}
                                        onUpdate={updateBlockParam}
                                        onDelete={removeBlock}
                                    />
                                    {bIdx < stack.length - 1 && (
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
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'action_wait')}>
                                        <Clock className="h-4 w-4 mr-2 text-amber-500" /> {t('block_action_wait').replace('{seconds}', '1')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addBlockToStack(sIdx, 'condition_if_text')}>
                                        <Code2 className="h-4 w-4 mr-2 text-emerald-500" /> {t('block_condition_if').replace('{text}', '...')}
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
                        <p className="font-bold text-sm uppercase tracking-widest opacity-40">Drop a block to start scripting</p>
                    </div>
                )}
            </div>
        </main>
      </div>
    </div>
  );
}

function BlockDraft({ type, label }: { type: BotBlockType, label: string }) {
    const Icon = BLOCK_ICONS[type];
    return (
        <div className={cn("p-3 rounded-xl border-b-4 text-white text-xs font-bold flex items-center gap-3 shadow-sm", BLOCK_COLORS[type])}>
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
        </div>
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
            case 'condition_if_text':
                return (
                    <div className="space-y-1 mt-1">
                        <Input 
                            placeholder="word or phrase"
                            value={block.params?.text || ''}
                            onChange={e => onUpdate(stackIndex, blockIndex, 'text', e.target.value)}
                            className="h-8 bg-black/10 border-none text-white placeholder:text-white/40 focus-visible:ring-white/20 font-bold text-xs"
                        />
                        <div className="flex items-center gap-1 text-[8px] opacity-60 uppercase font-black tracking-tighter">
                            <ChevronDown className="h-3 w-3" /> Execute next if matches
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className={cn(
            "w-full max-w-[280px] p-4 rounded-2xl border-b-4 text-white shadow-lg relative group",
            BLOCK_COLORS[block.type]
        )}>
            <button 
                onClick={() => onDelete(stackIndex, blockIndex)}
                className="absolute -right-2 -top-2 bg-background text-foreground border h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:text-destructive"
            >
                <X className="h-3 w-3" />
            </button>

            <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 bg-black/10 rounded-lg">
                    <Icon className="h-4 w-4" />
                </div>
                <span className="font-black uppercase tracking-widest text-[10px]">
                    {t(`block_${block.type.replace('action_', '').replace('event_', '').replace('condition_', '')}` as any) || block.type}
                </span>
            </div>

            {renderParams()}
        </div>
    );
}

function X({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6L6 18M6 6l12 12" />
        </svg>
    );
}
