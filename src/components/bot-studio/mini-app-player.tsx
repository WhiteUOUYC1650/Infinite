'use client';

/**
 * Mini-app runtime for custom bots.
 *
 * A mini app is a list of UI blocks (header / text / separator / button) plus
 * the bot's scripts: pressing a button runs the script that starts with
 * `event_button_click` and matches the button id, and every `action_send` /
 * `action_reply` block becomes a bot message inside the app.
 */

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { BotBlock, BotMiniApp, BotScript } from '@/types';
import { cn } from '@/lib/utils';

const resolveVars = (text: string = '', vars: Record<string, any>) =>
  String(text).replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? String(vars[key]) : match));

/** Runs the scripts matching the trigger and returns the produced messages. */
function runScripts(
  scripts: BotScript[] | undefined,
  trigger: 'event_start' | 'event_button_click',
  options: { buttonId?: string; vars: Record<string, any> }
): { outputs: string[]; vars: Record<string, any> } {
  const outputs: string[] = [];
  const vars = { ...options.vars };
  if (!scripts || scripts.length === 0) return { outputs, vars };

  for (const script of scripts) {
    const blocks = script.blocks || [];
    if (!blocks.length || blocks[0].type !== trigger) continue;
    if (trigger === 'event_button_click') {
      const triggerId = String(blocks[0].params?.buttonId || '').trim().toLowerCase();
      if (triggerId !== String(options.buttonId || '').trim().toLowerCase()) continue;
    }

    const ifStack: boolean[] = [];
    let stop = false;
    for (let i = 1; i < blocks.length && !stop; i += 1) {
      const block = blocks[i] as BotBlock;
      const params = block.params || {};

      if (block.type === 'logic_end_if') { ifStack.pop(); continue; }
      if (block.type === 'logic_else') {
        if (ifStack.length) ifStack[ifStack.length - 1] = !ifStack[ifStack.length - 1];
        continue;
      }
      if (ifStack.some((value) => value === false)) {
        if (block.type === 'logic_if') ifStack.push(false);
        continue;
      }

      switch (block.type) {
        case 'logic_if': {
          const condition = resolveVars(params.condition, vars);
          if (condition.includes('!=')) {
            const [left, right] = condition.split('!=').map((part) => part.trim());
            ifStack.push(String(left) !== String(right));
          } else if (condition.includes('==')) {
            const [left, right] = condition.split('==').map((part) => part.trim());
            ifStack.push(String(left) === String(right));
          } else {
            ifStack.push(Boolean(condition));
          }
          break;
        }
        case 'action_send':
        case 'action_reply':
        case 'ui_text':
        case 'ui_header':
          if (params.text) outputs.push(resolveVars(params.text, vars));
          break;
        case 'variable_set':
          if (params.name) vars[params.name] = resolveVars(params.value, vars);
          break;
        case 'variable_math': {
          const name = params.name;
          if (!name) break;
          const left = Number(vars[name] || 0);
          const right = Number(resolveVars(params.value, vars) || 0);
          const op = params.operation || '+';
          vars[name] = op === '-' ? left - right : op === '*' ? left * right : op === '/' ? (right === 0 ? 0 : left / right) : left + right;
          break;
        }
        case 'variable_random': {
          const name = params.name;
          if (!name) break;
          const min = Number(params.min ?? 0);
          const max = Number(params.max ?? 100);
          vars[name] = Math.floor(Math.random() * (max - min + 1)) + min;
          break;
        }
        case 'variable_clear':
          if (params.name) delete vars[params.name];
          break;
        case 'action_stop':
          stop = true;
          break;
        default:
          break;
      }
    }
    if (stop) break;
  }

  return { outputs, vars };
}

export function MiniAppPlayer({
  app,
  open,
  onOpenChange,
  botName,
  botAvatar,
  scripts,
}: {
  app: BotMiniApp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  botName: string;
  botAvatar?: string | null;
  scripts?: BotScript[];
}) {
  const [messages, setMessages] = useState<string[]>([]);
  const [vars, setVars] = useState<Record<string, any>>({});

  const uiBlocks = useMemo(() => app?.blocks || [], [app]);

  const reset = () => {
    setMessages([]);
    setVars({});
  };

  React.useEffect(() => {
    if (!open || !app) return;
    // run the app's start script once per opening
    const result = runScripts(scripts, 'event_start', { vars: {} });
    setVars(result.vars);
    setMessages(result.outputs);
  }, [open, app, scripts]);

  const pressButton = (block: BotBlock) => {
    const result = runScripts(scripts, 'event_button_click', {
      buttonId: block.params?.buttonId,
      vars,
    });
    setVars(result.vars);
    if (result.outputs.length) setMessages((prev) => [...prev, ...result.outputs]);
    else setMessages((prev) => [...prev, `«${block.params?.text || ''}»`]);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <SheetContent
        side="bottom"
        hideCloseButton
        className="flex h-[85vh] max-h-[85vh] flex-col gap-0 border-0 bg-background p-0"
      >
        <SheetHeader className="flex shrink-0 flex-row items-center gap-3 border-b border-border/60 px-3 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
            {botAvatar ? (
              <img src={botAvatar} alt={botName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-medium">{(botName || 'B').charAt(0).toUpperCase()}</span>
            )}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <SheetTitle className="truncate text-[15px] font-semibold text-foreground">
              {app?.name || botName}
            </SheetTitle>
            <p className="truncate text-[11px] text-foreground-variant">{botName}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={() => { reset(); onOpenChange(false); }}
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            {uiBlocks.map((block) => {
              if (block.type === 'ui_header') {
                return (
                  <h2 key={block.id} className="pt-1 text-lg font-semibold text-foreground">
                    {resolveVars(block.params?.text, vars)}
                  </h2>
                );
              }
              if (block.type === 'ui_text') {
                return (
                  <p key={block.id} className="whitespace-pre-wrap text-[15px] leading-6 text-foreground-variant">
                    {resolveVars(block.params?.text, vars)}
                  </p>
                );
              }
              if (block.type === 'ui_separator') {
                return <div key={block.id} className="h-px w-full bg-border" />;
              }
              if (block.type === 'ui_button') {
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => pressButton(block)}
                    className={cn(
                      'flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.99]'
                    )}
                  >
                    {resolveVars(block.params?.text, vars) || 'Кнопка'}
                  </button>
                );
              }
              return null;
            })}

            {messages.length > 0 && (
              <div className="space-y-2 pt-2">
                {messages.map((message, index) => (
                  <div
                    key={`${index}-${message.slice(0, 12)}`}
                    className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-[15px] leading-5 text-foreground"
                  >
                    {message}
                  </div>
                ))}
              </div>
            )}

            {uiBlocks.length === 0 && messages.length === 0 && (
              <p className="py-10 text-center text-sm text-foreground-variant">
                В этом мини-приложении пока нет блоков.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
