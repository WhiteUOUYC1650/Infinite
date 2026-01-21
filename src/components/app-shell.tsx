"use client";

import { useState } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from "@/components/ui/sidebar";
import { SidebarContent } from "@/components/sidebar-content";
import { ChatView } from "@/components/chat/chat-view";
import type { ChatItem } from "@/types";
import { MessageCircle } from "lucide-react";

export function AppShell() {
  const [selectedItem, setSelectedItem] = useState<ChatItem | null>(null);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent onSelect={setSelectedItem} selectedId={selectedItem?.id} />
      </Sidebar>
      <SidebarInset>
        {selectedItem ? (
          <ChatView item={selectedItem} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-background p-4">
            <div className="flex flex-col items-center text-center">
                <MessageCircle className="h-24 w-24 mb-4 text-primary/50" strokeWidth={1} />
                <h2 className="text-2xl font-bold tracking-tight font-headline">
                  Welcome to Infinite
                </h2>
                <p className="text-muted-foreground mt-2 max-w-sm">
                  Your new hub for seamless communication. Select a conversation from the sidebar to get started.
                </p>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
