'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { UpdatePromptDialog } from '@/components/update-prompt-dialog';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';

const CURRENT_APP_VERSION = "1.0 Pre-Release 1";

interface UpdatePromptContextType {
  promptUpdate: () => void;
  isUpdateAvailable: boolean;
  updateInfo: any;
  downloadUpdate: () => Promise<void>;
  currentVersion: string;
}

const UpdatePromptContext = createContext<UpdatePromptContextType | undefined>(undefined);

export function UpdatePromptProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const db = useFirestore();
  const { user: authUser } = useUser();
  const { toast } = useToast();
  const checkPerformed = useRef(false);

  useEffect(() => {
    if (checkPerformed.current || !db) return;
    checkPerformed.current = true;

    const checkVersion = async () => {
        const launches = parseInt(localStorage.getItem('launch_count') || '0') + 1;
        localStorage.setItem('launch_count', launches.toString());

        try {
            // 1. Get user info to check beta status
            let isBetaTester = false;
            if (authUser) {
                const userSnap = await getDoc(doc(db, 'users', authUser.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    isBetaTester = userData.isBetaTester || userData.username === '@Infinite';
                }
            }

            // 2. Get version info
            const verDocRef = doc(db, 'info', 'ver');
            const verSnap = await getDoc(verDocRef);
            
            if (verSnap.exists()) {
                const data = verSnap.data();
                setUpdateInfo(data);

                // 3. Determine target version based on beta status
                const targetVersion = isBetaTester 
                    ? (data.latestClosedBeta || data.latest) 
                    : data.latest;

                if (targetVersion && targetVersion !== CURRENT_APP_VERSION) {
                    setIsUpdateAvailable(true);
                    // Show prompt every 10 launches if update is available
                    if (launches % 10 === 0) {
                        setIsOpen(true);
                    }
                }
            }
        } catch (error) {
            console.error("Error checking app version:", error);
        }
    };
    checkVersion();
  }, [db, authUser]);

  const downloadUpdate = async () => {
    if (!db || !updateInfo?.apkChunkIds || isDownloading) return;
    setIsDownloading(true);
    toast({ title: "Update", description: "Downloading APK file..." });

    try {
        const chunkIds = updateInfo.apkChunkIds;
        const chunkSnaps = await Promise.all(
            chunkIds.map((id: string) => getDoc(doc(db, 'apkChunks', id)))
        );

        const chunksData = chunkSnaps.filter(s => s.exists()).map(s => s.data() as { part: number, data: string });
        chunksData.sort((a, b) => a.part - b.part);

        const assembledBase64 = chunksData.map(c => c.data).join('');
        
        if (Capacitor.isNativePlatform()) {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const fileName = `infinite_update_${(updateInfo.latestClosedBeta || updateInfo.latest).replace(/\s+/g, '_')}.apk`;
          
          try {
            await Filesystem.mkdir({
              path: 'Infinite',
              directory: Directory.Documents,
              recursive: true,
            });
          } catch (e) {
          }

          await Filesystem.writeFile({
            path: `Infinite/${fileName}`,
            data: assembledBase64,
            directory: Directory.Documents,
          });
          
          toast({ title: "Success", description: "Update saved to Documents/Infinite. Please install it manually." });
        } else {
          const binaryString = window.atob(assembledBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }

          const blob = new Blob([bytes], { type: 'application/vnd.android.package-archive' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `infinite_update_${(updateInfo.latestClosedBeta || updateInfo.latest).replace(/\s+/g, '_')}.apk`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast({ title: "Success", description: "APK downloaded. Please open it to install." });
        }
        
        setIsOpen(false);
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: "Download Failed", description: e.message });
    } finally {
        setIsDownloading(false);
    }
  };

  const promptUpdate = useCallback(() => {
    setIsOpen(true);
  }, []);

  const value = {
    promptUpdate,
    isUpdateAvailable,
    updateInfo,
    downloadUpdate,
    currentVersion: CURRENT_APP_VERSION,
  };

  return (
    <UpdatePromptContext.Provider value={value}>
        {children}
        <UpdatePromptDialog 
            open={isOpen} 
            onOpenChange={setIsOpen}
            isUpdateAvailable={isUpdateAvailable}
            onUpdate={downloadUpdate}
            isDownloading={isDownloading}
            targetVersion={updateInfo ? (updateInfo.latestClosedBeta || updateInfo.latest) : undefined}
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
