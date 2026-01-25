'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { UpdatePromptDialog } from '@/components/update-prompt-dialog';

interface UpdatePromptContextType {
  promptUpdate: () => void;
}

const UpdatePromptContext = createContext<UpdatePromptContextType | undefined>(undefined);

export function UpdatePromptProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const promptUpdate = useCallback(() => {
    setIsOpen(true);
  }, []);

  const value = {
    promptUpdate,
  };

  return (
    <UpdatePromptContext.Provider value={value}>
        {children}
        <UpdatePromptDialog open={isOpen} onOpenChange={setIsOpen} />
    </UpdatePromptContext.Provider>
  );
}

export function useUpdatePrompt() {
  const context = useContext(UpdatePromptContext);
  if (context === undefined) {
    throw new Error('useUpdatePrompt must be used within a UpdatePromptProvider');
  }
  return context;
}
