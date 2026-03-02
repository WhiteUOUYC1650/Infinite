
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UpdatePromptDialog } from '@/components/update-prompt-dialog';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

const CURRENT_APP_VERSION = "0.3.0 Beta";

interface UpdatePromptContextType {
  promptUpdate: () => void;
  isUpdateAvailable: boolean;
}

const UpdatePromptContext = createContext<UpdatePromptContextType | undefined>(undefined);

export function UpdatePromptProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const db = useFirestore();

  useEffect(() => {
    const checkVersion = async () => {
        if (!db) return;
        try {
            // Check the 'info/ver' path as requested
            const verDocRef = doc(db, 'info', 'ver');
            const verSnap = await getDoc(verDocRef);
            if (verSnap.exists()) {
                const latestVersion = verSnap.data()?.latest;
                // If versions don't match, an update is available
                if (latestVersion && latestVersion !== CURRENT_APP_VERSION) {
                    setIsUpdateAvailable(true);
                }
            } else {
                console.log("Version document 'info/ver' not found in Firestore.");
            }
        } catch (error) {
            console.error("Error checking app version:", error);
        }
    };
    checkVersion();
  }, [db]);

  const promptUpdate = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  const value = {
    promptUpdate,
    isUpdateAvailable,
  };

  return (
    <UpdatePromptContext.Provider value={value}>
        {children}
        <UpdatePromptDialog 
            open={isOpen} 
            onOpenChange={handleClose}
            isUpdateAvailable={isUpdateAvailable} 
        />
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
