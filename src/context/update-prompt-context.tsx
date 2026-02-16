'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UpdatePromptDialog } from '@/components/update-prompt-dialog';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

const CURRENT_APP_VERSION = "0.3";

interface UpdatePromptContextType {
  promptUpdate: () => void;
}

const UpdatePromptContext = createContext<UpdatePromptContextType | undefined>(undefined);

export function UpdatePromptProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFeatureUpdate, setIsFeatureUpdate] = useState(false);
  const [isVersionUpdate, setIsVersionUpdate] = useState(false);
  const db = useFirestore();

  useEffect(() => {
    const checkVersion = async () => {
        if (!db) return;
        try {
            const versionDocRef = doc(db, 'config', 'version');
            const versionSnap = await getDoc(versionDocRef);
            if (versionSnap.exists()) {
                const latestVersion = versionSnap.data()?.latest;
                if (latestVersion && latestVersion > CURRENT_APP_VERSION) {
                    setIsVersionUpdate(true);
                    setIsOpen(true);
                }
            } else {
                // You might want to create the version document if it doesn't exist.
                // For now, we'll just log it.
                console.log("Version document not found in Firestore.");
            }
        } catch (error) {
            console.error("Error checking app version:", error);
        }
    };
    checkVersion();
  }, [db]);

  const promptUpdate = useCallback(() => {
    setIsFeatureUpdate(true);
    setIsOpen(true);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // Reset flags after dialog closes
    setIsFeatureUpdate(false);
    setIsVersionUpdate(false);
  };

  const value = {
    promptUpdate,
  };

  return (
    <UpdatePromptContext.Provider value={value}>
        {children}
        <UpdatePromptDialog 
            open={isOpen} 
            onOpenChange={handleClose}
            isUpdateAvailable={isVersionUpdate} 
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
