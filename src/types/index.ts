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
  voiceMimeType?: string;
  voiceStatus?: 'uploading' | 'complete' | 'failed';
  voiceChunkIds?: string[];
  voiceDuration?: number;
  circleMimeType?: string;
  circleStatus?: 'uploading' | 'complete' | 'failed';
  circleChunkIds?: string[];
  circleDuration?: number;
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

export type VoiceChunk = {
  data: string;
  part: number;
  senderId: string;
};

export type CircleChunk = {
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
  allowedReactions?: string[]; // List of allowed emojis
  typingStatus?: Record<string, boolean>; // uid -> typing boolean
};

export type CallParticipant = {
  uid: string;
  name: string;
  avatar?: string;
  joinedAt: Timestamp;
  isSpeaking?: boolean;
};

export type Call = {
  id: string;
  callerId: string;
  calleeId?: string; // Optional for group calls
  status: 'calling' | 'active' | 'ended';
  isGroupCall?: boolean;
  isVideo?: boolean; // New: indicates if it's a video call
  callType?: 'video_chat' | 'broadcast';
  participants?: CallParticipant[];
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
