
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { currentUser, getUserById } from "@/lib/data";
import type { ChatItem, Message } from "@/types";
import { Paperclip, Phone, Send, Video, X } from "lucide-react";
import { UserAvatarWithStatus } from "./user-avatar-with-status";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


export function ChatView({ item, onClose }: { item: ChatItem, onClose: () => void }) {
  const getChatName = () => {
    if (item.type === "dm") {
      const otherUserId = item.members.find((id) => id !== currentUser.id);
      return otherUserId ? getUserById(otherUserId)?.name : "Direct Message";
    }
    return item.name;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Header */}
      <header className="flex items-center p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onClose} className="mr-2 md:hidden">
            <X className="h-5 w-5" />
        </Button>
        {item.type === "dm" ? (
          <UserAvatarWithStatus
            user={getUserById(item.members.find((id) => id !== currentUser.id)!)!}
          />
        ) : (
          item.icon && <item.icon className="h-8 w-8 mr-3 text-muted-foreground" />
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold font-headline">{getChatName()}</h2>
          <p className="text-sm text-muted-foreground">
            {item.type === "dm"
              ? getUserById(item.members.find((id) => id !== currentUser.id)!)?.status
              : `${item.members?.length || 0} members`}
          </p>
        </div>
        {item.type === 'dm' && (
            <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
                <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
                <Video className="h-5 w-5" />
            </Button>
            </div>
        )}
      </header>

      {/* Message List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {item.messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>

      {/* Message Input */}
      {item.type !== 'channel' && (
        <footer className="p-4 border-t">
            <div className="relative">
            <Textarea
                placeholder="Type a message..."
                className="pr-24 py-3 resize-none"
                rows={1}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="icon">
                    <Paperclip className="h-5 w-5" />
                </Button>
                <Button size="icon">
                <Send className="h-5 w-5" />
                </Button>
            </div>
            </div>
        </footer>
      )}
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isCurrentUser = message.senderId === currentUser.id;

  return (
    <div className={cn("flex items-end gap-3", isCurrentUser && "flex-row-reverse")}>
      {!isCurrentUser && (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Avatar className="h-8 w-8">
                        {message.sender?.avatar && <AvatarImage src={message.sender.avatar} alt={message.sender.name} />}
                        <AvatarFallback>{message.sender?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{message.sender?.name}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      )}
      <div
        className={cn(
          "max-w-xs lg:max-w-md p-3 rounded-lg",
          isCurrentUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-secondary text-secondary-foreground rounded-bl-none"
        )}
      >
        <p className="text-sm">{message.content}</p>
        <p className="text-xs opacity-70 mt-1 text-right">{message.timestamp}</p>
      </div>
    </div>
  );
}
