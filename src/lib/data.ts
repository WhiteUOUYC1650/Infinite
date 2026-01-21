import type { User, Chat, Channel, Message } from "@/types";
import { Users, Megaphone, MessageSquare } from "lucide-react";

export const users: User[] = [
  {
    id: "user-1",
    name: "Alex Smith",
    avatar: "https://picsum.photos/seed/alex/100/100",
    status: "online",
    statusMessage: "Working on the new feature",
  },
  {
    id: "user-2",
    name: "Maria Garcia",
    avatar: "https://picsum.photos/seed/maria/100/100",
    status: "away",
  },
  {
    id: "user-3",
    name: "David Lee",
    avatar: "https://picsum.photos/seed/david/100/100",
    status: "online",
  },
  {
    id: "user-4",
    name: "Sophia Johnson",
    avatar: "https://picsum.photos/seed/sophia/100/100",
    status: "offline",
    statusMessage: "On vacation",
  },
  {
    id: "user-5",
    name: "Chris Williams",
    avatar: "https://picsum.photos/seed/chris/100/100",
    status: "online",
  },
];

export const currentUser: User = users[0];

const messages: Message[] = [
  { id: "msg-1", senderId: "user-2", content: "Hey! How's it going?", timestamp: "10:30 AM" },
  { id: "msg-2", senderId: "user-1", content: "Hey Maria! Pretty good, just wrapping up some work. You?", timestamp: "10:31 AM" },
  { id: "msg-3", senderId: "user-2", content: "Same here. Ready for the weekend though!", timestamp: "10:31 AM" },
  { id: "msg-4", senderId: "user-1", content: "You bet! Any fun plans?", timestamp: "10:32 AM" },
  { id: "msg-5", senderId: "user-3", content: "Project meeting in 5 minutes in the main conference room.", timestamp: "11:00 AM"},
  { id: "msg-6", senderId: "user-5", content: "Thanks for the heads up, David.", timestamp: "11:01 AM"},
  { id: "msg-7", senderId: "user-1", content: "On my way.", timestamp: "11:01 AM"},
  { id: "msg-8", senderId: "user-1", content: "New design concepts are ready for review.", timestamp: "2:00 PM"},
  { id: "msg-9", senderId: "user-4", content: "Hey everyone, reminder about the weekly sync tomorrow at 10 AM.", timestamp: "3:00 PM" },
];

export const chats: Chat[] = [
  {
    id: "chat-1",
    type: "dm",
    members: ["user-1", "user-2"],
    messages: messages.slice(0, 4),
    unreadCount: 2,
    icon: MessageSquare,
  },
  {
    id: "chat-2",
    type: "dm",
    members: ["user-1", "user-3"],
    messages: [],
    icon: MessageSquare,
  },
  {
    id: "chat-3",
    type: "group",
    name: "Project Phoenix",
    members: ["user-1", "user-3", "user-5"],
    messages: messages.slice(4, 7),
    unreadCount: 1,
    icon: Users,
  },
  {
    id: "chat-4",
    type: "group",
    name: "Design Team",
    members: ["user-1", "user-2", "user-4"],
    messages: [messages[7]],
    icon: Users,
  },
];

export const channels: Channel[] = [
  {
    id: "channel-1",
    type: "channel",
    name: "Announcements",
    description: "Company-wide announcements and updates.",
    messages: [messages[8]],
    unreadCount: 1,
    icon: Megaphone,
  },
  {
    id: "channel-2",
    type: "channel",
    name: "Random",
    description: "A place for fun and random thoughts.",
    messages: [],
    icon: Megaphone,
  },
];

// Function to get user by ID
export const getUserById = (id: string) => users.find(u => u.id === id);

// Hydrate messages with sender info
chats.forEach(chat => {
  chat.messages.forEach(message => {
    message.sender = getUserById(message.senderId);
  });
});

channels.forEach(channel => {
  channel.messages.forEach(message => {
    message.sender = getUserById(message.senderId);
  });
});
