'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, addDoc, updateDoc, Timestamp, setDoc, getDoc, query, orderBy, limit, increment, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { AuthenticatedUser, SharedVideo, User } from '@/types';
import { Loader2, Upload, Play, X, User as UserIcon, MessageSquare, Heart, Share2, MoreVertical, Search, PlusCircle, ArrowLeft, PlayCircle, Send, ThumbsUp } from 'lucide-react';
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
  const [selectedVideo, setSelectedVideo] = useState<SharedVideo | null>(null);

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
      <header className="flex h-16 items-center justify-between border-b px-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
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
                    className="pl-9 h-10 bg-muted/50 rounded-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        <Button onClick={() => setIsUploadOpen(true)} className="gap-2 rounded-full">
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{t('infvid_upload_title')}</span>
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/10">
        {videosLoading ? (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        ) : videos && videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                {videos.map((video) => (
                    <VideoCard 
                        key={video.id} 
                        video={video} 
                        sender={senders[video.senderId]} 
                        onClick={() => setSelectedVideo(video)}
                    />
                ))}
            </div>
        ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground text-center">
                <PlayCircle className="h-20 w-20 mb-4 opacity-20" />
                <h3 className="text-xl font-semibold">{t('infvid_no_videos')}</h3>
            </div>
        )}
      </main>

      {/* Video Player Modal */}
      {selectedVideo && (
          <VideoDetailOverlay 
            video={selectedVideo} 
            sender={senders[selectedVideo.senderId]} 
            onClose={() => setSelectedVideo(null)}
            currentUser={currentUser}
          />
      )}

      <UploadDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onUpload={handleUploadVideo}
        isUploading={isUploading}
      />
    </div>
  );
}

function VideoCard({ video, sender, onClick }: { video: SharedVideo, sender?: User, onClick: () => void }) {
    const { t, language } = useLanguage();
    const timeAgo = video.timestamp 
        ? formatDistanceToNow(video.timestamp.toDate(), { addSuffix: true, locale: language === 'ru' ? ru : enUS })
        : '';

    return (
        <div className="flex flex-col gap-3 group cursor-pointer" onClick={onClick}>
            {/* Thumbnail */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-sm transition-transform hover:scale-[1.02] duration-200">
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                    <Play className="h-12 w-12 text-white fill-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] text-white font-bold">
                    HD
                </div>
            </div>

            {/* Info */}
            <div className="flex gap-3">
                <Avatar className="h-9 w-9 shrink-0 border border-border/50">
                    <AvatarImage src={sender?.avatar} />
                    <AvatarFallback><UserIcon className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold line-clamp-2 leading-snug text-sm group-hover:text-primary transition-colors">{video.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 truncate font-medium">{sender?.name || '...'}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                        <span>{t('infvid_views', { count: video.views || 0 })}</span>
                        <span className='w-1 h-1 rounded-full bg-muted-foreground/30' />
                        <span>{timeAgo}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function VideoDetailOverlay({ video, sender, onClose, currentUser }: { video: SharedVideo, sender?: User, onClose: () => void, currentUser: AuthenticatedUser }) {
    const { t, language } = useLanguage();
    const db = useFirestore();
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [commentText, setAddCommentText] = useState('');
    const [comments, setComments] = useState<any[]>([]);
    const [isSubscribed, setIsSubscribed] = useState(false);

    // Assembly Logic
    useEffect(() => {
        if (!db || video.videoStatus !== 'complete' || !video.videoChunkIds) return;
        
        const load = async () => {
            setIsLoading(true);
            try {
                // Fetch chunks
                const chunkSnaps = await Promise.all(
                    video.videoChunkIds!.map(id => getDoc(doc(db, 'videoChunks', id)))
                );
                const chunksData = chunkSnaps.map(s => s.data() as { part: number, data: string });
                chunksData.sort((a, b) => a.part - b.part);
                const assembledBase64 = chunksData.map(c => c.data).join('');
                setVideoUrl(`data:${video.videoMimeType};base64,${assembledBase64}`);
                
                // Increment view
                const videoRef = doc(db, 'videos', video.id);
                updateDoc(videoRef, { views: increment(1) });
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [video.id, db]);

    // Comments Listener
    useEffect(() => {
        if (!db) return;
        const commentsQuery = query(
            collection(db, 'videos', video.id, 'comments'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
        return onSnapshot(commentsQuery, (snapshot) => {
            setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [db, video.id]);

    // Subscription Mock Check
    useEffect(() => {
        if (sender?.id === currentUser.uid) {
            setIsSubscribed(true);
            return;
        }
        // In a real app, you'd check a 'subscriptions' collection.
        // For prototype, we'll just use a local state.
    }, [sender?.id, currentUser.uid]);

    const handleAddComment = async () => {
        if (!db || !commentText.trim()) return;
        try {
            await addDoc(collection(db, 'videos', video.id, 'comments'), {
                userId: currentUser.uid,
                userName: currentUser.name || currentUser.username,
                userAvatar: currentUser.avatar || null,
                text: commentText.trim(),
                timestamp: Timestamp.now(),
            });
            setAddCommentText('');
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleSubscribe = () => {
        if (sender?.id === currentUser.uid) return;
        setIsSubscribed(!isSubscribed);
    };

    const timeAgo = video.timestamp 
        ? formatDistanceToNow(video.timestamp.toDate(), { addSuffix: true, locale: language === 'ru' ? ru : enUS })
        : '';

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-300">
            {/* Overlay Header */}
            <header className="h-14 flex items-center px-4 border-b shrink-0 bg-background/95 backdrop-blur-md">
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="ml-4 flex items-center gap-2">
                    <InfVidIcon className="h-6 w-6" />
                    <span className="font-bold font-headline">{video.title}</span>
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Main Player Area */}
                <div className="flex-1 bg-black flex flex-col min-h-0">
                    <div className="flex-1 relative flex items-center justify-center">
                        {isLoading ? (
                            <div className="text-center space-y-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                                <p className="text-white/60 text-sm font-medium animate-pulse">{t('infvid_uploading')}</p>
                            </div>
                        ) : videoUrl ? (
                            <video src={videoUrl} controls autoPlay className="max-w-full max-h-full aspect-video" />
                        ) : (
                            <p className="text-destructive font-bold">Assembly Failed</p>
                        )}
                    </div>
                    
                    {/* Video Info Below Player */}
                    <div className="bg-background p-4 lg:p-6 border-t">
                        <div className="max-w-5xl mx-auto space-y-4">
                            <h2 className="text-xl font-bold font-headline leading-tight">{video.title}</h2>
                            
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={sender?.avatar} />
                                        <AvatarFallback>{sender?.name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold text-sm leading-tight flex items-center gap-1">
                                            {sender?.name}
                                            {sender?.id === 'INFINITE_BOT' && <VerifiedBadge className='w-3 h-3' />}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground font-medium">1.2K {t('subscribers_count').split(' ')[1]}</p>
                                    </div>
                                    <Button 
                                        variant={isSubscribed ? "secondary" : "default"} 
                                        className={cn("ml-2 rounded-full h-9 px-6 font-bold", !isSubscribed && "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90")}
                                        onClick={handleToggleSubscribe}
                                    >
                                        {isSubscribed ? t('subscribed') : t('subscribe')}
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button variant="secondary" className="rounded-full gap-2 h-9 px-4">
                                        <ThumbsUp className="h-4 w-4" />
                                        <span className="text-xs font-bold">124</span>
                                    </Button>
                                    <Button variant="secondary" className="rounded-full gap-2 h-9 px-4">
                                        <Share2 className="h-4 w-4" />
                                        <span className="text-xs font-bold">{t('copy_text')}</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-muted/50 rounded-xl p-4 text-sm leading-relaxed">
                                <div className="flex items-center gap-2 font-bold mb-1">
                                    <span>{t('infvid_views', { count: video.views || 0 })}</span>
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                    <span>{timeAgo}</span>
                                </div>
                                <p className="text-muted-foreground whitespace-pre-wrap">{video.description || 'No description provided.'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Comments */}
                <aside className="w-full lg:w-96 border-l flex flex-col bg-background overflow-hidden">
                    <div className="p-4 border-b shrink-0 flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2">
                            {t('comments')}
                            <Badge variant="secondary" className="font-mono">{comments.length}</Badge>
                        </h3>
                    </div>
                    
                    <div className="p-4 border-b shrink-0">
                        <div className="flex gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={currentUser.avatar} />
                                <AvatarFallback>{currentUser.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-2">
                                <Textarea 
                                    placeholder={t('add_comment_placeholder')} 
                                    className="min-h-[40px] h-10 py-2.5 resize-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-muted/30 rounded-xl"
                                    value={commentText}
                                    onChange={(e) => setAddCommentText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAddComment())}
                                />
                                {commentText.trim() && (
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => setAddCommentText('')}>{t('cancel')}</Button>
                                        <Button size="sm" className="rounded-full px-4" onClick={handleAddComment}>{t('ok')}</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-6">
                            {comments.length > 0 ? comments.map((comment) => (
                                <div key={comment.id} className="flex gap-3">
                                    <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarImage src={comment.userAvatar} />
                                        <AvatarFallback>{comment.userName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs leading-none">@{comment.userName}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {comment.timestamp ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true, locale: language === 'ru' ? ru : enUS }) : ''}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-relaxed">{comment.text}</p>
                                        <div className="flex items-center gap-4 mt-1">
                                            <button className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                                                <ThumbsUp className="h-3 w-3" />
                                                <span className="text-[10px] font-bold">0</span>
                                            </button>
                                            <button className="text-[10px] font-bold text-muted-foreground hover:underline">{t('reply')}</button>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-12 text-center text-muted-foreground italic text-sm">
                                    {t('no_comments_yet')}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </aside>
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
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold font-headline">{t('infvid_upload_title')}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div 
                        className={cn(
                            "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all",
                            file ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30"
                        )}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="video/*" className="hidden" />
                        {file ? (
                            <div className="text-center">
                                <PlayCircle className="h-16 w-16 text-primary mx-auto mb-3" />
                                <p className="font-bold truncate max-w-[300px]">{file.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <Upload className="h-16 w-16 text-muted-foreground/40 mx-auto mb-3" />
                                <p className="font-bold text-muted-foreground">{t('video')}</p>
                                <p className="text-xs text-muted-foreground mt-1">MP4, WebM up to 10MB</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold ml-1">{t('infvid_video_title_label')}</label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter video title" disabled={isUploading} className="rounded-xl h-11 bg-muted/30 border-none focus-visible:ring-primary" />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold ml-1">{t('infvid_video_desc_label')}</label>
                        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell viewers about your video" className="resize-none rounded-xl bg-muted/30 border-none focus-visible:ring-primary" rows={3} disabled={isUploading} />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isUploading} className="rounded-full">{t('cancel')}</Button>
                    <Button onClick={handleSubmit} disabled={!file || !title.trim() || isUploading} className="rounded-full px-8 font-bold">
                        {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('creating')} </> : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
