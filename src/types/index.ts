
'use client';

import type { LucideIcon } from "lucide-react";
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export type User = {
  id: string;
  name: string;
  username: string;
  email?: string;
  avatar?: string;
  status: "online" | "away" | "offline";
  statusMessage?: string;
  hasSetNickname?: boolean;
  isBot?: boolean;
  lastSeen?: Timestamp;
  isDeleted?: boolean;
  infGoldBalance?: number;
  subscriptionTier?: 'none' | 'super' | 'mega' | 'prem' | 'giga' | 'ultra';
  lastDailyBonusClaimed?: Timestamp;
  loginProtectionEnabled?: boolean;
  subscriptions?: string[]; // Array of user IDs the user is subscribed to
  subscriberCount?: number;
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
  musicMimeType?: string;
  musicStatus?: 'uploading' | 'complete' | 'failed';
  musicChunkIds?: string[];
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  fileStatus?: 'uploading' | 'complete' | 'failed';
  fileChunkIds?: string[];
  timestamp: Timestamp;
  sender?: User; // hydrated sender
  senderName?: string;
  senderAvatar?: string;
  type?: 'user' | 'announcement';
  readBy?: string[];
  replyTo?: ReplyInfo;
  editedAt?: Timestamp;
  reactions?: Record<string, string[]>; // emoji -> array of user IDs
};

export type VideoChunk = {
  chatId?: string;
  messageId?: string;
  videoId?: string;
  data: string;
  part: number;
  senderId: string;
};

export type MusicChunk = {
  chatId: string;
  messageId: string;
  data: string;
  part: number;
  senderId: string;
};

export type FileChunk = {
  data: string;
  part: number;
  senderId: string;
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

export type SharedVideo = {
  id: string;
  title: string;
  description?: string;
  senderId: string;
  timestamp: Timestamp;
  videoMimeType: string;
  videoStatus: 'uploading' | 'complete' | 'failed';
  videoChunkIds?: string[];
  thumbnailUrl?: string;
  views?: number;
  likedBy?: string[]; // Array of user IDs who liked the video
};

export type Channel = Chat & {
    type: "channel";
    description: string;
};

export type ChatItem = Chat | Channel;

export type PopulatedChat = Chat & {
    iconComponent?: LucideIcon;
};
