import type { LucideIcon } from "lucide-react";
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export type User = {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "away" | "offline";
  statusMessage?: string;
};

export type AuthenticatedUser = FirebaseUser & User;

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: Timestamp;
  sender?: User; // hydrated sender
};

export type Chat = {
  id: string;
  type: "dm" | "group" | "channel";
  name?: string;
  members: string[]; // user ids
  lastMessage?: Omit<Message, 'id' | 'sender'> & { senderName?: string };
  unreadCount?: number;
  icon?: string;
  description?: string;
};

export type Channel = Chat & {
    type: "channel";
    description: string;
};

export type ChatItem = Chat | Channel;

export type PopulatedChat = Chat & {
    iconComponent?: LucideIcon;
};
