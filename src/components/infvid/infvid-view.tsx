'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, addDoc, updateDoc, Timestamp, setDoc, getDoc, writeBatch, query, orderBy, limit } from 'firebase/firestore';
import type { AuthenticatedUser, SharedVideo, User } from '@/types';
import { Loader2, Upload, Play, X, User as UserIcon, MessageSquare, Heart, Share2, MoreVertical, Search, PlusCircle, ArrowLeft, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

// --- InfVid Icon ---
const InfVidIcon = ({ className }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    <svg viewBox="0 0 24 24" fill="#FF8C00" className="absolute w-full h-full">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative w-3/5 h-3/5">
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4z" />
    </svg>
  </div>
);

export function InfVidView({ currentUser, onClose }: { currentUser: AuthenticatedUser, onClose: () => void }) {
  const { t, language } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Fetch Videos ---
  const videosQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'videos'), orderBy('timestamp', 'desc'), limit(50));
  }, [db]);

  const { data: videos, loading: videosLoading } = useCollection<SharedVideo>(videosQuery);

  const senderIds = useMemo(() => Array.from(new Set(videos?.map(v => v.senderId) || [])), [videos]);
  const { users: senders } = useBatchUsers(senderIds);

  const handleUploadVideo = async (file: File, title: string, description: string) => {
    if (!db) return;
    setIsUploading(true);

    try {
        const videoDocRef = doc(collection(db, 'videos'));
        const timestamp = Timestamp.now();

        const videoData: Omit<SharedVideo, 'id'> = {
            title,
            description,
            senderId: currentUser.uid,
            timestamp,
            videoMimeType: file.type,
            videoStatus: 'uploading',
            views: 0,
        };

        await setDoc(videoDocRef, videoData);

        const videoBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (error) => reject(error);
        });

        const CHUNK_SIZE = 900 * 1024;
        const chunks: string[] = [];
        for (let i = 0; i < videoBase64.length; i += CHUNK_SIZE) {
            chunks.push(videoBase64.substring(i, i + CHUNK_SIZE));
        }

        const chunkIds: string[] = [];
        for (const [index, chunkData] of chunks.entries()) {
            const chunkDocRef = doc(collection(db, 'videoChunks'));
            await setDoc(chunkDocRef, {
                data: chunkData,
                part: index,
                senderId: currentUser.uid,
                videoId: videoDocRef.id,
            });
            chunkIds.push(chunkDocRef.id);
            await new Promise(res => setTimeout(res, 0));
        }

        await updateDoc(videoDocRef, {
            videoStatus: 'complete',
            videoChunkIds: chunkIds,
        });

        toast({ title: t('dm_success'), description: t('infvid_upload_success') });
        setIsUploadOpen(false);
    } catch (error) {
        console.error("Video upload failed:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload video.' });
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4 shrink-0">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
                <InfVidIcon className="h-8 w-8" />
                <h1 className="text-xl font-bold font-headline">{t('infvid_title')}</h1>
                <Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none">BETA</Badge>
            </div>
        </div>
        
        <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={t('search_placeholder')}
                    className="pl-9 h-10 bg-muted/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{t('infvid_upload_title')}</span>
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {videosLoading ? (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        ) : videos && videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map((video) => (
                    <VideoCard key={video.id} video={video} sender={senders[video.senderId]} />
                ))}
            </div>
        ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground text-center">
                <PlayCircle className="h-20 w-20 mb-4 opacity-20" />
                <h3 className="text-xl font-semibold">{t('infvid_no_videos')}</h3>
            </div>
        )}
      </main>

      <UploadDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onUpload={handleUploadVideo}
        isUploading={isUploading}
      />
    </div>
  );
}

function VideoCard({ video, sender }: { video: SharedVideo, sender?: User }) {
    const { t, language } = useLanguage();
    const db = useFirestore();
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const loadVideo = async () => {
        if (!db || video.videoStatus !== 'complete' || !video.videoChunkIds) return;
        setIsLoadingVideo(true);
        try {
            const chunkSnaps = await Promise.all(
                video.videoChunkIds.map(id => getDoc(doc(db, 'videoChunks', id)))
            );
            const chunksData = chunkSnaps.map(s => s.data() as { part: number, data: string });
            chunksData.sort((a, b) => a.part - b.part);
            const assembledBase64 = chunksData.map(c => c.data).join('');
            setVideoUrl(`data:${video.videoMimeType};base64,${assembledBase64}`);
            setIsPlaying(true);
        } catch (e) {
            console.error("Error loading InfVid video:", e);
        } finally {
            setIsLoadingVideo(false);
        }
    };

    const timeAgo = video.timestamp 
        ? formatDistanceToNow(video.timestamp.toDate(), { addSuffix: true, locale: language === 'ru' ? ru : enUS })
        : '';

    return (
        <div className="flex flex-col gap-3 group">
            {/* Thumbnail/Player Container */}
            <div className="relative aspect-video bg-muted rounded-xl overflow-hidden cursor-pointer bg-black" onClick={!isPlaying ? loadVideo : undefined}>
                {isPlaying && videoUrl ? (
                    <video src={videoUrl} controls autoPlay className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        {isLoadingVideo ? (
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="h-16 w-16 text-white fill-white" />
                            </div>
                        )}
                        <PlayCircle className="h-12 w-12 text-primary/40" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={sender?.avatar} />
                    <AvatarFallback><UserIcon className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold line-clamp-2 leading-tight">{video.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{sender?.name || '...'}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <span>{t('infvid_views', { count: video.views || 0 })}</span>
                        <span>•</span>
                        <span>{timeAgo}</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

function UploadDialog({ open, onOpenChange, onUpload, isUploading }: { open: boolean, onOpenChange: (open: boolean) => void, onUpload: (file: File, title: string, description: string) => Promise<void>, isUploading: boolean }) {
    const { t } = useLanguage();
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
            if (!title) setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
        }
    };

    const handleSubmit = async () => {
        if (!file || !title.trim()) return;
        await onUpload(file, title, description);
        setFile(null);
        setTitle('');
        setDescription('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t('infvid_upload_title')}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div 
                        className={cn(
                            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors",
                            file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                        )}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="video/*" className="hidden" />
                        {file ? (
                            <div className="text-center">
                                <PlayCircle className="h-12 w-12 text-primary mx-auto mb-2" />
                                <p className="font-medium truncate max-w-[300px]">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                <p className="font-medium">{t('video')}</p>
                                <p className="text-xs text-muted-foreground">MP4, WebM up to 10MB</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('infvid_video_title_label')}</label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter video title" disabled={isUploading} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('infvid_video_desc_label')}</label>
                        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell viewers about your video" className="resize-none" rows={3} disabled={isUploading} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isUploading}>{t('cancel')}</Button>
                    <Button onClick={handleSubmit} disabled={!file || !title.trim() || isUploading}>
                        {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('creating')} </> : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}