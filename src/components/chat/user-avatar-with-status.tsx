"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import { Bookmark } from "lucide-react";

interface UserAvatarWithStatusProps {
  user: User;
  className?: string;
  isSavedMessages?: boolean;
}

const statusColors = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  offline: "bg-gray-400",
};

export function UserAvatarWithStatus({ user, className, isSavedMessages }: UserAvatarWithStatusProps) {
  if (isSavedMessages) {
    return (
      <Avatar className={cn("h-10 w-10", className)}>
        <div className="flex h-full w-full items-center justify-center bg-secondary">
          <Bookmark className="h-6 w-6 text-secondary-foreground" />
        </div>
      </Avatar>
    );
  }
  
  return (
    <div className={cn("relative", className)}>
      <Avatar>
        {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
      </Avatar>
      {user.status && (
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
