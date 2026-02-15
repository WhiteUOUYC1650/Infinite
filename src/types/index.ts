'use client';

import type { LucideIcon } from "lucide-react";
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export type User = {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  status: "online" | "away" | "offline";
  statusMessage?: string;
  hasSetNickname?: boolean;
  isBot?: boolean;
  lastSeen?: Timestamp;
  isDeleted?: boolean;
};

export type AuthenticatedUser = FirebaseUser & Partial<User> & { isAdmin?: boolean };

export type ReplyInfo = {
    messageId: string;
    content: string;
    senderName: string;
};

export type Message = {
  id:string;
  senderId: string;
  content: string;
  imageUrl?: string;
  videoMimeType?: string;
  videoStatus?: 'uploading' | 'complete' | 'failed';
  videoChunkIds?: string[];
  timestamp: Timestamp;
  sender?: User; // hydrated sender
  senderName?: string;
  senderAvatar?: string;
  type?: 'user' | 'announcement';
  readBy?: string[];
  replyTo?: ReplyInfo;
  editedAt?: Timestamp;
};

export type VideoChunk = {
  data: string;
  messageId: string;
  chatId: string;
  senderId: string;
  part: number;
};

export type Chat = {
  id: string;
  type: "dm" | "group" | "channel";
  name?: string;
  members: string[]; // user ids
  ownerId?: string;
  lastMessage?: Omit<Message, 'sender'>;
  unreadCounts?: { [userId: string]: number };
  icon?: string;
  avatar?: string;
  description?: string;
  link?: string;
  discussionChatId?: string;
};

export type Call = {
  id: string;
  callerId: string;
  calleeId: string;
  status: 'calling' | 'active' | 'ended';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  callerCandidates?: RTCIceCandidateInit[];
  calleeCandidates?: RTCIceCandidateInit[];
};

export type Channel = Chat & {
    type: "channel";
    description: string;
};

export type ChatItem = Chat | Channel;

export type PopulatedChat = Chat & {
    iconComponent?: LucideIcon;
};
