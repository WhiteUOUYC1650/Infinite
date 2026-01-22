
"use client";

import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarFooter,
  SidebarHeader,
  SidebarContent as SidebarBody,
  useSidebar,
} from "@/components/ui/sidebar";
import { chats, channels, currentUser, getUserById } from "@/lib/data";
import type { ChatItem, Chat } from "@/types";
import { UserAvatarWithStatus } from "@/components/chat/user-avatar-with-status";
import { Badge } from "@/components/ui/badge";
import { Cog, Moon, Plus, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarContentProps {
  onSelect: (item: ChatItem) => void;
  selectedId?: string;
}

export function SidebarContent({ onSelect, selectedId }: SidebarContentProps) {
  const directMessages = chats.filter((chat) => chat.type === "dm");
  const groupDiscussions = chats.filter((chat) => chat.type === "group");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const initialTheme =
      storedTheme === "dark" ||
      (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", newTheme);
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };
  
  const handleSelect = (item: ChatItem) => {
    onSelect(item);
    setOpenMobile(false);
  };


  return (
    <>
      <SidebarHeader className="p-4">
        <h1 className="text-2xl font-bold font-headline text-primary">
          Infinite
        </h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-8" />
        </div>
      </SidebarHeader>

      <ScrollArea className="flex-1">
        <SidebarBody>
          <Accordion
            type="multiple"
            defaultValue={["direct-messages", "groups", "channels"]}
            className="w-full px-2"
          >
            <AccordionItem value="direct-messages">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-2">
                Direct Messages
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <div className="space-y-1">
                  {directMessages.map((chat) => {
                    const otherUserId = chat.members.find(
                      (id) => id !== currentUser.id
                    );
                    const otherUser = otherUserId
                      ? getUserById(otherUserId)
                      : null;
                    const lastMessage = chat.messages[chat.messages.length - 1];

                    return (
                      <Button
                        key={chat.id}
                        variant="ghost"
                        onClick={() => handleSelect(chat)}
                        className={cn("w-full justify-start h-auto p-2 text-left", selectedId === chat.id && 'bg-accent')}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {otherUser && (
                            <UserAvatarWithStatus user={otherUser} />
                          )}
                          <div className="flex-1 truncate">
                            <p className="font-semibold">{otherUser?.name}</p>
                            {lastMessage && <p className="text-xs text-muted-foreground truncate">{lastMessage.content}</p>}
                          </div>
                          {chat.unreadCount && chat.unreadCount > 0 && (
                             <Badge className="bg-primary">{chat.unreadCount}</Badge>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="groups">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-2">
                Group Discussions
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {groupDiscussions.map((chat) => (
                    <ChatItemComponent key={chat.id} item={chat} onSelect={handleSelect} selectedId={selectedId} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="channels">
              <AccordionTrigger className="hover:no-underline text-sm font-semibold text-muted-foreground px-2">
                Broadcast Channels
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {channels.map((channel) => (
                     <ChatItemComponent key={channel.id} item={channel} onSelect={handleSelect} selectedId={selectedId} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </SidebarBody>
      </ScrollArea>
      
      <Separator />

      <SidebarFooter className="p-2">
        <div className="flex items-center gap-2 p-2">
          <UserAvatarWithStatus user={currentUser} />
          <div className="flex-1 truncate">
            <p className="font-semibold">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{currentUser.status}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "light" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Cog className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end">
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span>Notifications</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span>Appearance</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </>
  );
}

function ChatItemComponent({ item, onSelect, selectedId }: { item: ChatItem, onSelect: (item: ChatItem) => void, selectedId?: string }) {
  const lastMessage = item.messages[item.messages.length - 1];
  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(item)}
      className={cn("w-full justify-start h-auto p-2 text-left", selectedId === item.id && 'bg-accent')}
    >
      <div className="flex items-center gap-3 w-full">
        {item.icon && <item.icon className="h-5 w-5 text-muted-foreground" />}
        <div className="flex-1 truncate">
          <p className="font-semibold">{item.name}</p>
          {lastMessage && <p className="text-xs text-muted-foreground truncate">{`${lastMessage.sender?.name.split(' ')[0]}: ${lastMessage.content}`}</p>}
        </div>
        {item.unreadCount && item.unreadCount > 0 && (
            <Badge className="bg-primary">{item.unreadCount}</Badge>
        )}
      </div>
    </Button>
  );
}
