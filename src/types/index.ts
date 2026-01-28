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
  lastSeen?: Timestamp;
};

export type AuthenticatedUser = FirebaseUser & Partial<User> & { isAdmin?: boolean };

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: Timestamp;
  sender?: User; // hydrated sender
  senderName?: string;
  senderAvatar?: string;
  type?: 'user' | 'announcement';
};

export type Chat = {
  id: string;
  type: "dm" | "group" | "channel";
  name?: string;
  members: string[]; // user ids
  ownerId?: string;
  lastMessage?: Omit<Message, 'id' | 'sender'> & { senderName?: string };
  unreadCounts?: { [userId: string]: number };
  icon?: string;
  description?: string;
  link?: string;
};

export type Channel = Chat & {
    type: "channel";
    description: string;
};

export type ChatItem = Chat | Channel;

export type PopulatedChat = Chat & {
    iconComponent?: LucideIcon;
};
