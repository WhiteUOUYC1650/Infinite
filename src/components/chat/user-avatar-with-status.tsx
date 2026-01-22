"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/types";
import { cn } from "@/lib/utils";

interface UserAvatarWithStatusProps {
  user: User;
  className?: string;
}

const statusColors = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  offline: "bg-gray-400",
};

export function UserAvatarWithStatus({ user, className }: UserAvatarWithStatusProps) {
  return (
    <div className={cn("relative", className)}>
      <Avatar>
        <AvatarImage src={user.avatar} alt={user.name} />
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
