
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import { Bookmark, Ghost, User as UserIcon } from "lucide-react";
import { useState, useLayoutEffect } from "react";
import { fetchAndCacheImage, getCachedFile, cacheFile } from "@/lib/cache-utils";

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

// Standard Infinite Logo for Fallbacks
export const InfiniteLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={cn("w-full h-full p-1.5 opacity-90", className)}>
    <path
        d="M 25 50 C 25 25, 40 25, 50 50 C 60 75, 75 75, 75 50 C 75 25, 60 25, 50 50 C 40 75, 25 75, 25 50 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
    />
    <path
        d="M 20 78 L 10 90 L 25 78"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
    />
     <path
        d="M 80 22 L 90 10 L 75 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
    />
  </svg>
);

export function UserAvatarWithStatus({ user, className, isSavedMessages, isSelected }: UserAvatarWithStatusProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useLayoutEffect(() => {
    if (!user?.avatar || isSavedMessages) {
        setImgSrc(null);
        setIsReady(false);
        return;
    }

    let isMounted = true;

    const loadAvatar = async () => {
      const cacheId = `avatar-${user.id}`;
      const cached = await getCachedFile(cacheId);
      if (cached && isMounted) {
        setImgSrc(cached);
        return;
      }

      if (user.avatar && isMounted) {
        // fetchAndCacheImage returns a Blob URL and ensures data is stored in IndexedDB
        const url = await fetchAndCacheImage(cacheId, user.avatar);
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
        <AvatarFallback className={cn("bg-muted text-foreground font-bold", isSelected && "bg-sidebar-primary text-sidebar-primary-foreground")}>
            ?
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
            "transition-opacity duration-300 flex items-center justify-center absolute inset-0 font-bold bg-muted text-foreground",
            isSelected && "bg-sidebar-primary text-sidebar-primary-foreground",
            isReady ? "opacity-0" : "opacity-100"
        )}>
            {user?.name?.charAt(0).toUpperCase() || user?.username?.charAt(1)?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      {user?.status && !user.isBot && !isSavedMessages && (
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

