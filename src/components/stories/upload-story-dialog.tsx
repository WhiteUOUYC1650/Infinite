'use client';

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/language-context';
import { useFirestore } from '@/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { AuthenticatedUser } from '@/types';
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function UploadStoryDialog({ open, onOpenChange, currentUser }: { open: boolean, onOpenChange: (open: boolean) => void, currentUser: AuthenticatedUser }) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({ variant: 'destructive', title: t('image_too_large'), description: t('select_smaller_image_5mb') });
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleUpload = async () => {
    if (!db || !file) return;
    setIsUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
      });

      const now = Timestamp.now();
      const expiresAt = new Timestamp(now.seconds + 24 * 60 * 60, 0);

      await addDoc(collection(db, 'stories'), {
        userId: currentUser.uid,
        mediaUrl: base64,
        caption: caption.trim(),
        timestamp: now,
        expiresAt: expiresAt,
        viewedBy: []
      });

      toast({ title: t('dm_success'), description: t('story_upload_success') });
      onOpenChange(false);
      setFile(null);
      setPreview(null);
      setCaption('');
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: t('unexpected_error') });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden p-0 gap-0">
        <div className="bg-primary/5 p-6 border-b">
          <DialogTitle className="text-xl font-bold font-headline">{t('upload_story')}</DialogTitle>
        </div>
        
        <div className="p-6 space-y-6">
          <div 
            className={cn(
              "w-full h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden bg-muted relative",
              preview ? "border-solid border-primary" : "hover:border-primary/50"
            )}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center space-y-1 p-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-1">
                  <ImageIcon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-bold text-muted-foreground text-sm">{t('photo')}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{t('select_an_image')}</p>
              </div>
            )}
          </div>

          <Input 
            placeholder={t('story_caption_placeholder')} 
            value={caption} 
            onChange={e => setCaption(e.target.value)} 
            disabled={isUploading}
            className="rounded-xl h-12 bg-muted/50 border-none focus-visible:ring-primary"
          />
        </div>

        <DialogFooter className="p-6 pt-0 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isUploading} className="rounded-xl flex-1">{t('cancel')}</Button>
          <Button onClick={handleUpload} disabled={!file || isUploading} className="rounded-xl flex-[2] font-bold">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
