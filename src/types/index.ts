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
  showPremBadge?: boolean;
  lastDailyBonusClaimed?: Timestamp;
  loginProtectionEnabled?: boolean;
  storyExpirationDuration?: number; // in hours, 0 for never
  subscriptions?: string[]; // Array of user IDs the user is subscribed to
  subscriberCount?: number;
  isBetaTester?: boolean;
  isCustomBot?: boolean;
  botOwnerId?: string;
  activeSessionId?: string | null;
  birthday?: {
    day: number;
    month: number;
    year?: number;
  };
};

export type AuthenticatedUser = FirebaseUser & Partial<User> & { isAdmin?: boolean };

export type ReplyInfo = {
    messageId: string;
    content: string;
    senderName: string;
};

export type PollOption = {
  text: string;
  votes: string[]; // user IDs
};

export type Poll = {
  question: string;
  options: PollOption[];
  isAnonymous: boolean;
  isMultipleChoice: boolean;
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
  poll?: Poll;
  fromChannelId?: string;
};

// Bot Logic Types
export type BotBlockType = 
  | 'event_start' 
  | 'event_message'
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
  | 'action_stop'
  | 'action_send_image'
  | 'action_send_video'
  | 'action_send_music'
  | 'action_send_file';

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
  url: string;
  icon?: string;
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

export type VideoComment = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  timestamp: Timestamp;
  likedBy?: string[];
  parentId?: string; // ID of the comment this is a reply to
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
