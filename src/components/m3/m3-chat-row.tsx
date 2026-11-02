'use client';

/**
 * Material 3 chat list row (used by the Material 3 edition only).
 */

import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { BadgeCheck, BellOff, Image as ImageIcon, ListTodo, Mic, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chat, User } from '@/types';
import { M3Avatar } from './m3-surfaces';

export function M3ChatRow({
  chat,
  otherUser,
  currentUserId,
  isSelected,
  savedMessagesLabel,
  yesterdayLabel,
  onClick,
}: {
  chat: Chat;
  otherUser?: User | null;
  currentUserId: string;
  isSelected?: boolean;
  savedMessagesLabel: string;
  yesterdayLabel: string;
  onClick: () => void;
}) {
  const isSavedMessages = chat.type === 'dm' && !otherUser;
  const unread = chat.unreadCounts?.[currentUserId] || 0;

  const title = isSavedMessages
    ? savedMessagesLabel
    : chat.type === 'dm'
      ? otherUser?.name || otherUser?.username || '…'
      : chat.name || '…';

  const avatarSrc = chat.type === 'dm' ? otherUser?.avatar : chat.avatar;
  const online = chat.type === 'dm' ? otherUser?.status === 'online' : false;

  const last = chat.lastMessage;
  const date = last?.timestamp?.toDate?.();
  const time = date
    ? isToday(date)
      ? format(date, 'HH:mm')
      : isYesterday(date)
        ? yesterdayLabel
        : format(date, 'dd.MM')
    : '';

  const preview = (() => {
    if (!last) return '';
    if (last.content) return last.content;
    if (last.imageUrl) return 'Фото';
    if (last.videoMimeType) return 'Видео';
    if (last.musicMimeType) return 'Аудио';
    if (last.fileStatus) return 'Файл';
    if (last.voiceStatus) return 'Голосовое';
    if (last.poll) return 'Опрос';
    return '';
  })();

  const previewIcon = (() => {
    if (!last) return null;
    if (!last.content && last.imageUrl) return <ImageIcon className="h-3 w-3 shrink-0" />;
    if (!last.content && last.fileStatus) return <Paperclip className="h-3 w-3 shrink-0" />;
    if (!last.content && last.voiceStatus) return <Mic className="h-3 w-3 shrink-0" />;
    if (!last.content && last.poll) return <ListTodo className="h-3 w-3 shrink-0" />;
    return null;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-[1.5rem] px-3 py-2.5 text-left transition-colors',
        isSelected ? 'bg-primary/12' : 'hover:bg-foreground/[0.04]'
      )}
    >
      <M3Avatar
        name={title}
        src={avatarSrc}
        size={52}
        online={online}
        className={chat.type !== 'dm' ? 'rounded-[1.1rem]' : undefined}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-[15px] font-medium leading-tight">{title}</span>
          {(otherUser?.username === '@Infinite' || (otherUser as any)?.isAdmin) && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          {chat.type === 'channel' && (
            <span className="ml-1 shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-primary">
              канал
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[12.5px] leading-tight text-muted-foreground">
          {previewIcon}
          <span className="truncate">{preview || '—'}</span>
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[10.5px] font-medium text-muted-foreground">{time}</span>
        {unread > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : (
          <span className="h-5" />
        )}
      </span>
    </button>
  );
}
