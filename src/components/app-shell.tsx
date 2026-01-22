"use client";

import { useState } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarContent } from "@/components/sidebar-content";
import { ChatView } from "@/components/chat/chat-view";
import type { ChatItem } from "@/types";
import { MessageCircle } from "lucide-react";

function ChatUI() {
  const [selectedItem, setSelectedItem] = useState<ChatItem | null>(null);
  const { isMobile } = useSidebar();

  const handleSelect = (item: ChatItem) => {
    setSelectedItem(item);
  };

  return (
    <>
      <Sidebar>
        <SidebarContent onSelect={handleSelect} selectedId={selectedItem?.id} />
      </Sidebar>
      <SidebarInset>
        {selectedItem ? (
          <ChatView item={selectedItem} onClose={() => setSelectedItem(null)} />
        ) : (
          <div className="relative flex h-full flex-col items-center justify-center bg-background p-4">
            {isMobile && (
              <header className="absolute top-0 left-0 right-0 flex items-center p-4">
                <SidebarTrigger />
              </header>
            )}
            <div className="flex flex-col items-center text-center">
                <MessageCircle className="h-24 w-24 mb-4 text-primary/50" strokeWidth={1} />
                <h2 className="text-2xl font-bold tracking-tight font-headline">
                  Chat not selected
                </h2>
            </div>
          </div>
        )}
      </SidebarInset>
    </>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <ChatUI />
    </SidebarProvider>
  );
}
