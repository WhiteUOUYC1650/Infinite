'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ShieldCheck, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from './ui/scroll-area';

interface LegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'tos' | 'privacy';
}

export function LegalDialog({ open, onOpenChange, type }: LegalDialogProps) {
  const { t } = useLanguage();
  const db = useFirestore();
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && db) {
      const fetchLegal = async () => {
        setIsLoading(true);
        try {
          const snap = await getDoc(doc(db, 'config', 'legal'));
          if (snap.exists()) {
            setContent(type === 'tos' ? snap.data().tos : snap.data().privacy);
          }
        } catch (e) {
          console.error("Legal fetch error:", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchLegal();
    }
  }, [open, type, db]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 flex flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {type === 'tos' ? <FileText className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <DialogTitle className="text-xl font-bold font-headline">
            {type === 'tos' ? t('terms_of_service') : t('privacy_policy')}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 p-8 bg-muted/5">
          {isLoading ? (
            <div className="flex h-full items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-headline">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-20 opacity-50">
              <p>No content available.</p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-6 border-t shrink-0">
          <Button onClick={() => onOpenChange(false)} className="w-full h-12 rounded-xl font-bold">
            {t('ok')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
