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
  subscriptionStartedAt?: Timestamp;
  showPremBadge?: boolean;
  lastDailyBonusClaimed?: Timestamp;
  loginProtectionEnabled?: boolean;
  storyExpirationDuration?: number; 
  subscriptions?: string[];
  subscriberCount?: number;
  isBetaTester?: boolean;
  isCustomBot?: boolean;
  botOwnerId?: string;
  activeSessionId?: string | null;
  watchLater?: string[];
  activeGiftEmoji?: string | null;
  birthday?: {
    day: number;
    month: number;
    year?: number;
  };
};

export type Gift = {
    id: string;
    emoji: string;
    senderId: string;
    senderName: string;
    timestamp: Timestamp;
    price: number;
    message?: string;
};

export type AuthenticatedUser = FirebaseUser & Partial<User> & { isAdmin?: boolean };

export type ReplyInfo = {
    messageId: string;
    content: string;
    senderName: string;
};

export type PollOption = {
  text: string;
  votes: string[];
};

export type Poll = {
  question: string;
  options: PollOption[];
  isAnonymous: boolean;
  isMultipleChoice: boolean;
};

export type MessageAttachment = {
  id: string;
  type: 'image' | 'video' | 'music' | 'file';
  url?: string;
  fileName?: string;
  fileMimeType?: string;
  chunkIds?: string[];
  status?: 'complete' | 'failed';
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
  attachments?: MessageAttachment[]; 
  timestamp: Timestamp;
  sender?: User; 
  senderName?: string;
  senderAvatar?: string;
  type?: 'user' | 'announcement';
  readBy?: string[];
  replyTo?: ReplyInfo;
  editedAt?: Timestamp;
  reactions?: Record<string, string[]>; 
  poll?: Poll;
  fromChannelId?: string;
};

export type BotBlockType = 
  | 'event_start' 
  | 'event_message'
  | 'event_button_click'
  | 'action_send' 
  | 'action_reply' 
  | 'action_wait' 
  | 'condition_if_text' 
  | 'action_reaction'
  | 'logic_if'
  | 'logic_else'
  | 'logic_end_if'
  | 'variable_set'
  | 'variable_math'
  | 'variable_clear'
  | 'variable_random'
  | 'action_stop'
  | 'action_send_image'
  | 'action_send_video'
  | 'action_send_music'
  | 'action_send_file'
  | 'ui_header'
  | 'ui_text'
  | 'ui_button'
  | 'ui_separator';

export type BotBlock = {
  id: string;
  type: BotBlockType;
  params?: Record<string, any>;
};

export type BotScript = {
  id: string;
  blocks: BotBlock[];
};

export type BotMiniApp = {
  id: string;
  name: string;
  blocks: BotBlock[]; 
};

export type CustomBot = {
  id: string;
  name: string;
  username: string;
  ownerId: string;
  avatar?: string;
  description?: string;
  scripts: BotScript[]; 
  miniApps?: BotMiniApp[];
  isActive: boolean;
  createdAt: Timestamp;
};

export type BotMarketItem = {
  id: string;
  authorId: string;
  name: string;
  description: string;
  price: number;
  data: BotBlock[];
  installs: number;
  buyers: string[];
  type: 'script' | 'plugin';
};

export type Transfer = {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  timestamp: Timestamp;
  senderName?: string;
  receiverName?: string;
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

export type Chat = {
  id: string;
  type: "dm" | "group" | "channel";
  name?: string;
  members: string[]; 
  ownerId?: string;
  lastMessage?: Omit<Message, 'sender'>;
  unreadCounts?: { [userId: string]: number };
  icon?: string;
  avatar?: string;
  description?: string;
  link?: string;
  discussionChatId?: string;
  allowedReactions?: string[]; 
};

export type Call = {
  id: string;
  callerId: string;
  calleeId?: string; 
  status: 'calling' | 'active' | 'ended';
  isVideo?: boolean; 
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
  likedBy?: string[]; 
  isShort?: number; 
  isProcessed?: number; 
};

export type VideoComment = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  timestamp: Timestamp;
  likedBy?: string[];
  parentId?: string; 
  replyTo?: {
    userId: string;
    userName: string;
  };
};

export type Story = {
  id: string;
  userId: string;
  mediaUrl?: string;
  caption?: string;
  timestamp: Timestamp;
  expiresAt: Timestamp;
  viewedBy?: string[];
};

export type PopulatedChat = Chat & {
    iconComponent?: LucideIcon;
};
