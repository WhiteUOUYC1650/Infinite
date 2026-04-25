
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import { Bookmark, Ghost, User as UserIcon } from "lucide-react";
import { useState, useEffect, useLayoutEffect } from "react";
import { fetchAndCacheImage, getCachedFile } from "@/lib/cache-utils";

interface UserAvatarWithStatusProps {
  user?: User | null;
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
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useLayoutEffect(() => {
    if (!user?.avatar || isSavedMessages) {
        setImgSrc(null);
        return;
    }

    let isMounted = true;

    const loadAvatar = async () => {
      // 1. Check cache
      const cached = await getCachedFile(`avatar-${user.id}`);
      if (cached && isMounted) {
        setImgSrc(cached);
        return;
      }

      // 2. Fetch and cache if not found
      if (user.avatar && isMounted) {
        const url = await fetchAndCacheImage(`avatar-${user.id}`, user.avatar);
        if (url && isMounted) {
            setImgSrc(url);
        } else if (isMounted) {
            setImgSrc(user.avatar);
        }
      }
    };

    loadAvatar();
    return () => { isMounted = false; };
  }, [user?.avatar, user?.id, isSavedMessages]);

  if (!user && !isSavedMessages) {
    return (
      <Avatar className={cn("h-10 w-10 shrink-0", className)}>
        <AvatarFallback className={cn(isSelected && "bg-sidebar-primary text-sidebar-primary-foreground")}>
            <UserIcon className="h-5 w-5 opacity-20" />
        </AvatarFallback>
      </Avatar>
    );
  }

  if (user?.isDeleted) {
    return (
      <Avatar className={cn("h-10 w-10 shrink-0", className)}>
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
      <Avatar className={cn("h-10 w-10 shrink-0", className)}>
        <div className={cn(
            "flex h-full w-full items-center justify-center bg-secondary rounded-full",
             isSelected && "bg-sidebar-primary text-sidebar-primary-foreground"
        )}>
          <Bookmark className="h-6 w-6" />
        </div>
      </Avatar>
    );
  }
  
  return (
    <div className={cn("relative h-10 w-10 shrink-0", className)}>
      <Avatar className="h-full w-full text-inherit overflow-hidden">
        {imgSrc && (
            <AvatarImage 
                src={imgSrc} 
                alt={user?.name || 'User'} 
                onLoadingStatusChange={(status) => {
                    if (status === 'loaded') setIsReady(true);
                }}
                className={cn(
                    "transition-opacity duration-300",
                    isReady ? "opacity-100" : "opacity-0"
                )}
            />
        )}
        <AvatarFallback className={cn(
            "transition-opacity duration-300 absolute inset-0 flex items-center justify-center",
            isSelected && "bg-sidebar-primary text-sidebar-primary-foreground",
            isReady ? "opacity-0" : "opacity-100"
        )}>
            {user?.name?.charAt(0) || '?'}
        </AvatarFallback>
      </Avatar>
      {user?.status && !user.isBot && (
        <span
            className={cn(
            "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background z-10",
            statusColors[user.status]
            )}
        />
      )}
    </div>
  );
}
