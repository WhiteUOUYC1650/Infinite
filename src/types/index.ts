import type { LucideIcon } from "lucide-react";

export type User = {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "away" | "offline";
  statusMessage?: string;
};

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  sender?: User; // hydrated sender
};

export type Chat = {
  id: string;
  type: "dm" | "group";
  name?: string;
  members: string[]; // user ids
  messages: Message[];
  unreadCount?: number;
  icon?: LucideIcon;
};

export type Channel = {
  id: string;
  type: "channel";
  name: string;
  description: string;
  messages: Message[];
  unreadCount?: number;
  icon?: LucideIcon;
};

export type ChatItem = Chat | Channel;
