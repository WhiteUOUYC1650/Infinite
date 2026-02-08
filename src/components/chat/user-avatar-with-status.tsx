"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import { Bookmark, Ghost } from "lucide-react";

interface UserAvatarWithStatusProps {
  user: User;
  className?: string;
  isSavedMessages?: boolean;
  isSelected?: boolean;
}

const statusColors = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  offline: "bg-gray-400",
};

export function UserAvatarWithStatus({ user, className, isSavedMessages, isSelected }: UserAvatarWithStatusProps) {
  if (user?.isDeleted) {
    return (
      <Avatar className={cn("h-10 w-10", className)}>
        <div className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-muted",
             isSelected && "bg-sidebar-primary text-sidebar-primary-foreground"
        )}>
          <Ghost className="h-6 w-6" />
        </div>
      </Avatar>
    );
  }

  if (isSavedMessages) {
    return (
      <Avatar className={cn("h-10 w-10", className)}>
        <div className={cn(
            "flex h-full w-full items-center justify-center bg-secondary",
             isSelected && "bg-sidebar-primary text-sidebar-primary-foreground"
        )}>
          <Bookmark className="h-6 w-6" />
        </div>
      </Avatar>
    );
  }
  
  return (
    <div className={cn("relative", className)}>
      <Avatar>
        {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
        <AvatarFallback className={cn(isSelected && "bg-sidebar-primary text-sidebar-primary-foreground")}>
            {user.name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      {user.status && !user.isBot && (
        <span
            className={cn(
            "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background",
            statusColors[user.status]
            )}
        />
      )}
    </div>
  );
}
