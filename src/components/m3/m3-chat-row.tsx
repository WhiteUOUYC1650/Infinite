'use client';

/**
 * Material 3 conversation row (used by the Material 3 edition only).
 *
 * Flat list item — 72dp tall, tonal avatar, no card, no divider — as in the
 * Material 3 list spec and in the Infinite 3.0 Figma file.
 */

import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { BadgeCheck, BellOff, ImageIcon, ListTodo, Mic, Paperclip } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
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
  const { t } = useLanguage();
  const isSavedMessages = chat.type === 'dm' && !otherUser;
  const unread = chat.unreadCounts?.[currentUserId] || 0;

  const title = isSavedMessages
    ? savedMessagesLabel
    : chat.type === 'dm'
      ? otherUser?.name || otherUser?.username || '…'
      : chat.name || '…';

  const avatarSrc = chat.type === 'dm' ? otherUser?.avatar : chat.avatar;
  // bots are always "available", the green online dot is for people only
  const online = chat.type === 'dm' ? otherUser?.status === 'online' && !otherUser?.isBot && !otherUser?.isCustomBot : false;

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
    if (last.imageUrl) return t('photo');
    if (last.videoMimeType) return t('video');
    if (last.musicMimeType) return t('music');
    if (last.fileStatus) return t('file');
    if (last.voiceStatus) return t('voice_message');
    if (last.poll) return t('poll');
    return '';
  })();

  const previewIcon = (() => {
    if (!last) return null;
    if (!last.content && last.imageUrl) return <ImageIcon className="h-4 w-4 shrink-0" />;
    if (!last.content && last.fileStatus) return <Paperclip className="h-4 w-4 shrink-0" />;
    if (!last.content && last.voiceStatus) return <Mic className="h-4 w-4 shrink-0" />;
    if (!last.content && last.poll) return <ListTodo className="h-4 w-4 shrink-0" />;
    return null;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={isSelected ? 'true' : undefined}
      className="m3-list-item"
    >
      <M3Avatar
        name={title}
        src={avatarSrc}
        size={48}
        online={online}
        className={chat.type !== 'dm' ? 'rounded-2xl' : undefined}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15.5px] font-semibold leading-6 text-m3-on-surface">
            {title}
          </span>
          {(otherUser?.username === '@Infinite' || (otherUser as any)?.isAdmin) && (
            <BadgeCheck className="h-4 w-4 shrink-0 text-m3-primary" />
          )}
          {chat.type === 'channel' && (
            <span className="shrink-0 rounded bg-m3-surface-container-highest px-1.5 py-0.5 text-[10px] font-medium text-m3-on-surface-variant">
              {t('channels')}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13.5px] leading-5 text-m3-on-surface-variant">
          {previewIcon}
          <span className="truncate">{preview || '—'}</span>
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[11px] font-normal text-m3-on-surface-variant">{time}</span>
        {unread > 0 ? (
          <span className="m3-badge">{unread > 99 ? '99+' : unread}</span>
        ) : (
          <span className="h-5" />
        )}
      </span>
    </button>
  );
}

/**
 * The two "shortcut" rows at the top of the list (Saved messages / General
 * chat): tinted 48dp tile with an icon instead of an avatar.
 */
export function M3IconRow({
  icon: Icon,
  label,
  description,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description?: React.ReactNode;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="m3-list-item">
      <span className="m3-icon-tile">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15.5px] font-semibold leading-6 text-m3-on-surface">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-[13.5px] leading-5 text-m3-on-surface-variant">
            {description}
          </span>
        )}
      </span>
      {!!badge && badge > 0 ? (
        <span className="m3-badge">{badge > 99 ? '99+' : badge}</span>
      ) : null}
    </button>
  );
}
