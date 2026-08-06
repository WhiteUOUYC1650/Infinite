
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, addDoc, updateDoc, Timestamp, setDoc, getDoc, query, orderBy, limit, onSnapshot, arrayUnion, arrayRemove, writeBatch, where, deleteDoc, increment, serverTimestamp } from 'firebase/firestore';
import type { AuthenticatedUser, SharedVideo, User, VideoComment } from '@/types';
import { Loader2, Upload, Play, X, User as UserIcon, Share2, MoreVertical, Search, PlusCircle, ArrowLeft, PlayCircle, Send, ThumbsUp, ImageIcon, ChevronDown, ChevronUp, AlertCircle, Zap, Clock, Trash2, Pencil, RefreshCw, MessageSquare, Download, Heart, MessageCircle, Bookmark } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useBatchUsers } from '@/hooks/use-batch-users';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from '../ui/verified-badge';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '@/context/theme-context';
import { getCachedFile, cacheFile } from '@/lib/cache-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const compressImage = (file: File, quality = 0.7, maxDimension = 600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) { if (width > maxDimension) { height *= maxDimension / width; width = maxDimension; } } else { if (height > maxDimension) { width *= maxDimension / height; height = maxDimension; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context error'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (error) => reject(error);
  });
};

const InfVidIcon = ({ className }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    <svg viewBox="0 0 24 24" fill="#FF8C00" className="absolute w-full h-full"><path d="M5 3l14 9-14 9V3z" /></svg>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative w-3/5 h-3/5"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4z" /></svg>
  </div>
);

export function InfVidView({ currentUser, onClose, initialVideoId }: { currentUser: AuthenticatedUser, onClose: () => void, initialVideoId?: string }) {
  const { t } = useLanguage(); const db = useFirestore(); const { toast } = useToast(); const { theme: colorTheme } = useTheme();
  const [isUploadOpen, setIsUploadOpen] = useState(false); const [isUploading, setIsUploading] = useState(false); const [searchQuery, setSearchQuery] = useState(''); const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null); const [fetchedExternalVideo, setFetchedExternalVideo] = useState<SharedVideo | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'shorts' | 'watch_later'>('all');
  const [retryVideoId, setRetryVideoId] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<SharedVideo | null>(null);
  const [isShortsPlayerOpen, setIsShortsPlayerOpen] = useState(false);
  const isPrem = currentUser.subscriptionTier === 'prem'; const maxSizeText = isPrem ? '4GB' : '1GB'; const maxSizeInBytes = isPrem ? 4 * 1024 * 1024 * 1024 : 1 * 1024 * 1024 * 1024;

  const videosQuery = useMemo(() => { 
    if (!db) return null; 
    return query(collection(db, 'videos'), orderBy('timestamp', 'desc'), limit(100)); 
  }, [db]);
  const { data: videos, loading: videosLoading } = useCollection<SharedVideo>(videosQuery);
  const senderIds = useMemo(() => { const ids = new Set(videos?.map(v => v.senderId) || []); if (fetchedExternalVideo) ids.add(fetchedExternalVideo.senderId); return Array.from(ids); }, [videos, fetchedExternalVideo]);
  const { users: senders } = useBatchUsers(senderIds);

  const filteredVideos = useMemo(() => {
      if (!videos) return [];
      let list = videos;
      if (activeTab === 'shorts') list = list.filter(v => v.isShort === 1);
      else if (activeTab === 'watch_later') {
          const watchLaterIds = currentUser.watchLater || [];
          list = list.filter(v => watchLaterIds.includes(v.id));
      } else {
          list = list.filter(v => !v.isShort || v.isShort !== 1);
      }
      
      const q = searchQuery.toLowerCase().trim();
      if (!q) return list;
      return list.filter(v => v.title.toLowerCase().includes(q) || (senders[v.senderId]?.name || '').toLowerCase().includes(q));
  }, [videos, searchQuery, senders, activeTab, currentUser.watchLater]);

  useEffect(() => {
    const handleSystemBack = () => { 
        if (isShortsPlayerOpen) {
            setIsShortsPlayerOpen(false);
            setSelectedVideoId(null);
        } else if (selectedVideoId) { 
            setSelectedVideoId(null); 
            setFetchedExternalVideo(null); 
        } else if (isUploadOpen) { 
            setIsUploadOpen(false); 
            setRetryVideoId(null); 
        } else if (editingVideo) { 
            setEditingVideo(null); 
        } else { 
            onClose(); 
        } 
    };
    let backListener: any; if (Capacitor.isNativePlatform()) { import('@capacitor/app').then(({ App }) => { backListener = App.addListener('backButton', handleSystemBack); }); }
    return () => { if (backListener) { backListener.then((l: any) => l.remove()); } };
  }, [selectedVideoId, isUploadOpen, onClose, editingVideo, isShortsPlayerOpen]);

  useEffect(() => {
    if (!initialVideoId || !db) return;
    const checkAndLoadVideo = async () => {
        const foundInList = videos?.find(v => v.id === initialVideoId);
        if (foundInList) { 
            const video = foundInList;
            if (video.isShort === 1) {
                setIsShortsPlayerOpen(true);
            }
            setSelectedVideoId(initialVideoId); 
            return; 
        }
        try {
            const videoSnap = await getDoc(doc(db, 'videos', initialVideoId));
            if (videoSnap.exists()) { 
                const videoData = { id: videoSnap.id, ...videoSnap.data() } as SharedVideo; 
                setFetchedExternalVideo(videoData); 
                if (videoData.isShort === 1) {
                    setIsShortsPlayerOpen(true);
                }
                setSelectedVideoId(initialVideoId); 
            }
            else { toast({ variant: 'destructive', title: t('video_not_found') }); }
        } catch (e) { console.error("Error loading initial video:", e); }
    };
    if (!videosLoading) { checkAndLoadVideo(); }
  }, [initialVideoId, db, videosLoading, videos, t, toast]);

  const uploadVideoData = async (videoId: string, file: File, senderId: string) => {
      const CHUNK_SIZE = 384 * 1024; // 384KB - Multiple of 3 for Base64 integrity
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const chunkIds: string[] = [];

      for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.readAsDataURL(chunk);
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
          });

          const chunkRef = doc(collection(db!, 'videoChunks'));
          await setDoc(chunkRef, { 
              data: base64, 
              part: i, 
              senderId: senderId, 
              videoId: videoId,
              timestamp: serverTimestamp()
          });
          chunkIds.push(chunkRef.id);
          
          if (i % 5 === 0) await new Promise(res => setTimeout(res, 100));
      }
      
      await updateDoc(doc(db!, 'videos', videoId), { 
          videoStatus: 'complete', 
          videoChunkIds: chunkIds, 
          isProcessed: 1 
      });
  };

  const handleUploadVideo = async (file: File, thumbnailFile: File | null, title: string, description: string, isShort: number) => {
    if (!db) return; setIsUploading(true);
    try {
        const videoDocRef = retryVideoId ? doc(db, 'videos', retryVideoId) : doc(collection(db, 'videos')); 
        const timestamp = Timestamp.now();
        let thumbnailUrl = ''; if (thumbnailFile) { thumbnailUrl = await compressImage(thumbnailFile); }
        const videoData: any = { title, description, senderId: currentUser.uid, timestamp, videoMimeType: file.type, videoStatus: 'uploading', views: 0, likedBy: [], thumbnailUrl, isShort, isProcessed: 0 };
        
        if (retryVideoId) { await updateDoc(videoDocRef, videoData); } else { await setDoc(videoDocRef, videoData); }
        await uploadVideoData(videoDocRef.id, file, currentUser.uid);
        toast({ title: t('dm_success'), description: t('infvid_upload_success') }); 
        setIsUploadOpen(false); setRetryVideoId(null);
    } catch (error) { 
        console.error("Video upload failed:", error); 
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload video.' }); 
    } finally { setIsUploading(false); }
  };

  const selectedVideo = useMemo(() => { if (!selectedVideoId) return null; return videos?.find(v => v.id === selectedVideoId) || (fetchedExternalVideo?.id === selectedVideoId ? fetchedExternalVideo : null); }, [selectedVideoId, videos, fetchedExternalVideo]);

  const toggleWatchLater = async (vidId: string) => {
      if (!db || !currentUser.uid) return;
      const userRef = doc(db, 'users', currentUser.uid);
      const isSaved = currentUser.watchLater?.includes(vidId);
      try {
          await updateDoc(userRef, { watchLater: isSaved ? arrayRemove(vidId) : arrayUnion(vidId) });
          toast({ title: t('dm_success'), description: isSaved ? t('remove_from_watch_later') : t('add_to_watch_later') });
      } catch(e) { console.error(e); }
  };

  const handleDeleteVideo = async (vidId: string) => {
    if (!db || !window.confirm(t('delete_chat_confirm'))) return;
    try {
        await deleteDoc(doc(db, 'videos', vidId));
        toast({ title: t('dm_success'), description: t('video_deleted') });
        if (selectedVideoId === vidId) setSelectedVideoId(null);
    } catch(e) { 
        console.error("Video deletion error:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete video.' });
    }
  };

  const handleRetryUpload = (vidId: string) => {
      setRetryVideoId(vidId);
      setIsUploadOpen(true);
      setSelectedVideoId(null); 
  };

  const handleVideoClick = (video: SharedVideo) => {
      setSelectedVideoId(video.id);
      if (video.isShort === 1) {
          setIsShortsPlayerOpen(true);
      }
  };

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      {!isUploadOpen ? (
          <>
            <header className="flex-shrink-0 flex flex-col border-b z-20 pt-[calc(1rem+env(safe-area-inset-top))] bg-background">
                <div className="flex items-center p-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <InfVidIcon className="h-8 w-8 shrink-0" /><h1 className="text-xl font-bold font-headline truncate">{t('infvid_title')}</h1><Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none shrink-0">BETA</Badge>
                        </div>
                    </div>
                    <div className="flex-1 max-w-sm mx-4 hidden md:block"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder={t('search_placeholder')} className="pl-9 h-10 bg-muted/50 rounded-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
                    <div className="flex items-center gap-2 shrink-0"><Button onClick={() => setIsUploadOpen(true)} className="gap-2 rounded-full h-10 px-4"><PlusCircle className="h-4 w-4" /><span className="hidden sm:inline">{t('infvid_upload_title')}</span></Button></div>
                </div>
                <div className="px-4 pb-2">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                        <TabsList className="bg-muted/50 p-1 rounded-xl">
                            <TabsTrigger value="all" className="rounded-lg font-bold text-xs uppercase tracking-widest">{t('all_videos')}</TabsTrigger>
                            <TabsTrigger value="shorts" className="rounded-lg font-bold text-xs uppercase tracking-widest gap-2 flex items-center">
                                <Zap className="h-3.5 w-3.5 text-primary fill-primary" /> {t('infshorts_title')}
                            </TabsTrigger>
                            <TabsTrigger value="watch_later" className="rounded-lg font-bold text-xs uppercase tracking-widest gap-2 flex items-center">
                                <Clock className="h-3.5 w-3.5" /> {t('watch_later')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-6 bg-muted/10 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    {videosLoading ? (
                        <div className="flex h-full items-center justify-center py-20">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    ) : filteredVideos.length > 0 ? (
                        <div className={cn(
                            "grid gap-6 max-w-7xl mx-auto",
                            activeTab === 'shorts' 
                                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" 
                                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        )}>
                            {filteredVideos.map((video) => (
                                <VideoCard 
                                    key={video.id} 
                                    video={video} 
                                    sender={senders[video.senderId]} 
                                    onClick={() => handleVideoClick(video)} 
                                    isShortMode={activeTab === 'shorts'}
                                    currentUser={currentUser} 
                                    onToggleWatchLater={() => toggleWatchLater(video.id)} 
                                    onDelete={() => handleDeleteVideo(video.id)} 
                                    onRetry={() => handleRetryUpload(video.id)} 
                                    onEdit={() => setEditingVideo(video)} 
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center text-muted-foreground text-center py-20">
                            <PlayCircle className="h-20 w-20 mb-4 opacity-20" />
                            <h3 className="text-xl font-semibold">
                                {activeTab === 'watch_later' ? 'Список пуст.' : activeTab === 'shorts' ? 'Нет коротких видео.' : t('infvid_no_videos')}
                            </h3>
                        </div>
                    )}
                </div>
            </main>
          </>
      ) : (
          <UploadView 
            onClose={() => { setIsUploadOpen(false); setRetryVideoId(null); }} 
            onUpload={handleUploadVideo} 
            isUploading={isUploading} 
            maxSizeText={maxSizeText} 
            maxSizeInBytes={maxSizeInBytes}
            t={t}
            retryVideoId={retryVideoId}
          />
      )}
      
      {isShortsPlayerOpen && (
          <div className="fixed inset-0 z-[110] bg-black flex flex-col animate-in fade-in zoom-in duration-300">
              <header className="absolute top-0 left-0 right-0 h-14 flex items-center px-4 z-[120] bg-gradient-to-b from-black/60 to-transparent pt-[calc(0.5rem+env(safe-area-inset-top))]">
                  <Button variant="ghost" size="icon" onClick={() => { setIsShortsPlayerOpen(false); setSelectedVideoId(null); }} className="text-white hover:bg-white/10 rounded-full">
                      <ArrowLeft className="h-6 w-6" />
                  </Button>
                  <div className="ml-4">
                      <p className="text-white font-black uppercase tracking-widest text-xs">{t('infshorts_title')}</p>
                  </div>
              </header>
              <InfShortsPlayer 
                  videos={filteredVideos} 
                  senders={senders} 
                  currentUser={currentUser} 
                  onToggleWatchLater={toggleWatchLater}
                  initialVideoId={selectedVideoId || undefined}
              />
          </div>
      )}

      {selectedVideo && !isShortsPlayerOpen && (
          <VideoDetailOverlay 
            key={selectedVideo.id} 
            video={selectedVideo} 
            sender={senders[selectedVideo.senderId]} 
            onClose={() => { setSelectedVideoId(null); setFetchedExternalVideo(null); }} 
            currentUser={currentUser} 
            onDelete={() => handleDeleteVideo(selectedVideo.id)} 
            onRetry={handleRetryUpload} 
            onEdit={() => setEditingVideo(selectedVideo)} 
          />
      )}

      {editingVideo && (<VideoEditDialog video={editingVideo} onClose={() => setEditingVideo(null)} db={db!} t={t} />)}
    </div>
  );
}

function InfShortsPlayer({ videos, senders, currentUser, onToggleWatchLater, initialVideoId }: { videos: SharedVideo[], senders: Record<string, User>, currentUser: AuthenticatedUser, onToggleWatchLater: (id: string) => void, initialVideoId?: string }) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialVideoId && scrollContainerRef.current) {
            const index = videos.findIndex(v => v.id === initialVideoId);
            if (index !== -1) {
                const height = scrollContainerRef.current.clientHeight;
                scrollContainerRef.current.scrollTop = index * height;
            }
        }
    }, [initialVideoId, videos]);

    return (
        <div ref={scrollContainerRef} className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar flex flex-col items-center bg-black">
            {videos.map((video) => (
                <ShortItem 
                    key={video.id} 
                    video={video} 
                    sender={senders[video.senderId]} 
                    currentUser={currentUser} 
                    onToggleWatchLater={() => onToggleWatchLater(video.id)} 
                />
            ))}
        </div>
    );
}

function ShortItem({ video, sender, currentUser, onToggleWatchLater }: { video: SharedVideo, sender?: User, currentUser: AuthenticatedUser, onToggleWatchLater: () => void }) {
    const { t } = useLanguage();
    const db = useFirestore();
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLiked, setIsLiked] = useState(video.likedBy?.includes(currentUser.uid) || false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!db || !video.videoChunkIds) return;
        const load = async () => {
            const cached = await getCachedFile(video.id);
            if (cached) { setVideoUrl(cached); return; }
            try {
                const chunksData: { part: number, data: string }[] = [];
                for (const chunkId of video.videoChunkIds!) {
                    const snap = await getDoc(doc(db, 'videoChunks', chunkId));
                    if (snap.exists()) chunksData.push(snap.data() as any);
                }
                chunksData.sort((a, b) => a.part - b.part);
                const assembled = chunksData.map(c => c.data).join('');
                const dataUrl = `data:${video.videoMimeType};base64,${assembled}`;
                await cacheFile(video.id, dataUrl);
                setVideoUrl(await getCachedFile(video.id));
            } catch (e) { console.error(e); }
        };
        load();
    }, [video.id, db, video.videoChunkIds, video.videoMimeType]);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setIsPlaying(true);
                    videoRef.current?.play().catch(() => {});
                    if (db) updateDoc(doc(db, 'videos', video.id), { views: increment(1) });
                } else {
                    setIsPlaying(false);
                    videoRef.current?.pause();
                }
            });
        }, { threshold: 0.8 });

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [db, video.id]);

    const handleToggleLike = async () => {
        if (!db) return;
        const ref = doc(db, 'videos', video.id);
        try {
            if (isLiked) { await updateDoc(ref, { likedBy: arrayRemove(currentUser.uid) }); setIsLiked(false); }
            else { await updateDoc(ref, { likedBy: arrayUnion(currentUser.uid) }); setIsLiked(true); }
        } catch(e) {}
    };

    return (
        <div ref={containerRef} className="h-full w-full max-w-md snap-start shrink-0 relative bg-black flex items-center justify-center overflow-hidden">
            {videoUrl ? (
                <video 
                    ref={videoRef} 
                    src={videoUrl} 
                    loop 
                    playsInline 
                    className="h-full w-full object-cover" 
                    onClick={() => {
                        if (isPlaying) { videoRef.current?.pause(); setIsPlaying(false); }
                        else { videoRef.current?.play(); setIsPlaying(true); }
                    }}
                />
            ) : (
                <div className="flex flex-col items-center gap-4 text-white/20">
                    <Loader2 className="h-10 w-10 animate-spin" />
                </div>
            )}

            {!isPlaying && videoUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Play className="h-20 w-20 text-white/50 fill-white/20" />
                </div>
            )}

            <div className="absolute right-4 bottom-24 flex flex-col gap-6 z-10">
                <div className="flex flex-col items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={handleToggleLike} className={cn("h-12 w-12 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10 transition-all active:scale-125", isLiked && "text-red-500 bg-red-500/10")}>
                        <Heart className={cn("h-6 w-6", isLiked && "fill-current")} />
                    </Button>
                    <span className="text-[10px] font-black text-white drop-shadow-md">{video.likedBy?.length || 0}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => window.dispatchEvent(new CustomEvent('open-infvid', { detail: { videoId: video.id } }))} className="h-12 w-12 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10">
                        <MessageCircle className="h-6 w-6" />
                    </Button>
                </div>
                <Button variant="ghost" size="icon" onClick={onToggleWatchLater} className={cn("h-12 w-12 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10", currentUser.watchLater?.includes(video.id) && "text-primary")}>
                    <Bookmark className={cn("h-6 w-6", currentUser.watchLater?.includes(video.id) && "fill-current")} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(`/IV/T/${video.id}`); toast({ title: t('video_link_copied') }); }} className="h-12 w-12 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10">
                    <Share2 className="h-6 w-6" />
                </Button>
            </div>

            <div className="absolute bottom-6 left-4 right-16 z-10 text-white drop-shadow-xl text-left pointer-events-none">
                <div className="flex items-center gap-2 mb-3">
                    <Avatar className="h-9 w-9 border-2 border-white/20">
                        <AvatarImage src={sender?.avatar} />
                        <AvatarFallback>{sender?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1">
                            <p className="font-bold text-sm truncate">{sender?.name}</p>
                            {sender?.isAdmin && <VerifiedBadge className="w-3 h-3" />}
                        </div>
                        <p className="text-[10px] opacity-70 uppercase tracking-tighter">@{sender?.username?.replace('@','')}</p>
                    </div>
                </div>
                <h3 className="font-bold text-base leading-tight break-words whitespace-normal line-clamp-3">{video.title}</h3>
                {video.description && <p className="text-xs opacity-80 mt-1 line-clamp-2 leading-relaxed">{video.description}</p>}
            </div>
        </div>
    );
}

function VideoEditDialog({ video, onClose, db, t }: { video: SharedVideo, onClose: () => void, db: any, t: any }) {
    const { toast } = useToast();
    const [title, setTitle] = useState(video.title);
    const [description, setDescription] = useState(video.description || '');
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(video.thumbnailUrl || null);
    const [isSaving, setIsSaving] = useState(false);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            compressImage(file).then(setThumbnailPreview);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'videos', video.id), {
                title,
                description,
                thumbnailUrl: thumbnailPreview
            });
            toast({ title: t('dm_success'), description: t('video_updated') });
            onClose();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update video.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-md rounded-3xl p-6 overflow-hidden">
                <DialogTitle>{t('edit_video')}</DialogTitle>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>{t('infvid_thumbnail_label')}</Label>
                        <div className="aspect-video border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer overflow-hidden bg-muted relative" onClick={() => thumbnailInputRef.current?.click()}>
                            <input type="file" ref={thumbnailInputRef} onChange={handleThumbnailSelect} accept="image/*" className="hidden" />
                            {thumbnailPreview ? <img src={thumbnailPreview} className="w-full h-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('infvid_video_title_label')}</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl font-bold" maxLength={200} />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('infvid_video_desc_label')}</Label>
                        <Textarea value={description} onChange={e => setDescription(e.target.value)} className="rounded-xl min-h-[100px] resize-none" maxLength={1600} />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>{t('cancel')}</Button>
                    <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : t('save')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function UploadView({ onClose, onUpload, isUploading, maxSizeText, maxSizeInBytes, t, retryVideoId }: { onClose: () => void, onUpload: any, isUploading: boolean, maxSizeText: string, maxSizeInBytes: number, t: any, retryVideoId?: string | null }) {
    const { toast } = useToast(); const [file, setFile] = useState<File | null>(null); const [thumbnail, setThumbnail] = useState<File | null>(null); const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); 
    const [isVideoVertical, setIsVideoVertical] = useState(0); const [videoDuration, setVideoDuration] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null); const thumbnailInputRef = useRef<HTMLInputElement>(null);
    const db = useFirestore();

    useEffect(() => {
        if (retryVideoId && db) {
            getDoc(doc(db, 'videos', retryVideoId)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setTitle(data.title || '');
                    setDescription(data.description || '');
                    setThumbnailPreview(data.thumbnailUrl || null);
                }
            });
        }
    }, [retryVideoId, db]);
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (e.target.files?.[0]) { 
            const selectedFile = e.target.files[0]; 
            if (selectedFile.size > maxSizeInBytes) { toast({ variant: 'destructive', title: t('video_too_large', { size: maxSizeText }) }); return; } 
            const videoElement = document.createElement('video');
            videoElement.onloadedmetadata = () => { setIsVideoVertical(videoElement.videoHeight > videoElement.videoWidth ? 1 : 0); setVideoDuration(videoElement.duration); URL.revokeObjectURL(videoElement.src); };
            videoElement.src = URL.createObjectURL(selectedFile);
            setFile(selectedFile); if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, "")); 
        } 
    };
    
    const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) { setThumbnail(e.target.files[0]); setThumbnailPreview(URL.createObjectURL(e.target.files[0])); } };
    const handleSubmit = async () => { if (!file || !title.trim()) return; const isShort = (isVideoVertical === 1 && videoDuration < 180) ? 1 : 0; await onUpload(file, thumbnail, title, description, isShort); };

    return (
        <div className="flex flex-col h-full bg-background animate-in slide-in-from-right duration-300 relative">
            {isUploading && (
                <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-8" />
                    <h3 className="text-3xl font-bold font-headline mb-6">{t('infvid_upload_warning_title')}</h3>
                    <p className="text-muted-foreground leading-relaxed max-md mx-auto mb-8 text-lg">{t('infvid_upload_warning_desc')}</p>
                    <div className="flex items-center gap-3 text-primary font-black animate-pulse uppercase tracking-widest text-sm">
                        <AlertCircle className="h-5 w-5" />{t('processing_video')}
                    </div>
                </div>
            )}
            <header className="h-16 flex items-center px-4 border-b shrink-0 bg-background pt-[calc(1rem+env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
                <div className="ml-4 flex-1"><h2 className="text-xl font-bold font-headline">{retryVideoId ? t('retry_upload') : t('infvid_upload_title')}</h2></div>
                <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 ml-2"><X className="h-5 w-5" /></Button>
            </header>
            <ScrollArea className="flex-1">
                <div className="space-y-10 p-6 md:p-10 max-w-4xl mx-auto pb-20">
                    <div className={cn("border-4 border-dashed rounded-[2.5rem] p-10 md:p-16 flex flex-col items-center justify-center cursor-pointer transition-all", file ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50")} onClick={() => !isUploading && fileInputRef.current?.click()}>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="video/*" className="hidden" />
                        {file ? (<div className="text-center"><PlayCircle className="h-20 w-20 text-primary mx-auto mb-4" /><p className="font-black text-xl truncate max-w-[400px]">{file.name}</p><div className="flex items-center justify-center gap-3 mt-2"><p className="text-sm text-muted-foreground font-bold">{(file.size / (1024 * 1024)).toFixed(2)} MB</p><span className="text-sm text-primary font-bold uppercase">{(isVideoVertical === 1 && videoDuration < 180) ? t('infshorts_title') : t('video')}</span></div></div>) : (<div className="text-center"><Upload className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" /><p className="text-xl font-black text-muted-foreground">{retryVideoId ? t('choose_file') : t('infvid_upload_title')}</p><p className="text-xs text-muted-foreground mt-2 font-bold uppercase">{t('infvid_video_limits', { size: maxSizeText })}</p></div>)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4"><label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t('infvid_thumbnail_label')}</label><div className={cn("aspect-video border-4 border-dashed rounded-[2rem] flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-muted/20 relative", thumbnailPreview ? "border-solid border-primary" : "hover:border-primary/50")} onClick={() => !isUploading && thumbnailInputRef.current?.click()}><input type="file" ref={thumbnailInputRef} onChange={handleThumbnailSelect} accept="image/*" className="hidden" />{thumbnailPreview ? (<img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />) : (<div className="text-center"><ImageIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('infvid_select_thumbnail')}</p></div>)}</div></div>
                        <div className="space-y-6"><div className="space-y-3"><label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t('infvid_video_title_label')}</label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('infvid_video_title_placeholder')} disabled={isUploading} className="rounded-2xl h-14 px-6 bg-muted/30 border-none font-bold" maxLength={200} /></div><div className="space-y-3"><label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t('infvid_video_desc_label')}</label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('infvid_video_desc_placeholder')} className="resize-none rounded-2xl p-6 bg-muted/30 border-none min-h-[120px]" rows={3} disabled={isUploading} maxLength={1600} /></div></div>
                    </div>
                    <div className="pt-6 flex gap-4"><Button variant="ghost" onClick={onClose} disabled={isUploading} className="rounded-2xl flex-1 h-14 text-lg font-bold">{t('cancel')}</Button><Button onClick={handleSubmit} disabled={!file || !title.trim() || isUploading} className="rounded-2xl flex-[2] font-black h-14 text-lg shadow-xl">{isUploading ? t('loading') : t('save')}</Button></div>
                </div>
            </ScrollArea>
        </div>
    );
}

function VideoCard({ video, sender, onClick, isShortMode, currentUser, onToggleWatchLater, onDelete, onRetry, onEdit }: { video: SharedVideo, sender?: User, onClick: () => void, isShortMode?: boolean, currentUser: AuthenticatedUser, onToggleWatchLater: () => void, onDelete: () => void, onRetry: () => void, onEdit: () => void }) {
    const { t } = useLanguage();
    const isOwner = video.senderId === currentUser.uid;
    const isSaved = currentUser.watchLater?.includes(video.id);

    return (
        <div className="group relative flex flex-col bg-card rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className={cn("relative cursor-pointer overflow-hidden", isShortMode ? "aspect-[9/16]" : "aspect-video")} onClick={onClick}>
                {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                        <Play className="h-10 w-10 text-white/20" />
                    </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-xl scale-90 group-hover:scale-100 transition-transform">
                        <Play className="h-6 w-6 fill-current ml-1" />
                    </div>
                </div>
                {video.isProcessed === 0 && (
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1.5 border border-white/10">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span className="text-[10px] font-bold text-white uppercase">{t('processing_video')}</span>
                    </div>
                )}
            </div>
            
            <div className="p-3 flex-1 flex flex-col justify-between">
                <div className="flex gap-3">
                    {!isShortMode && (
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={sender?.avatar} />
                            <AvatarFallback>{sender?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                    )}
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm leading-tight line-clamp-2 mb-1 whitespace-pre-wrap break-words">{video.title}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black truncate">{sender?.name}</p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl font-bold">
                            <DropdownMenuItem onClick={onToggleWatchLater}>
                                <Clock className="mr-2 h-4 w-4" /> {isSaved ? t('remove_from_watch_later') : t('add_to_watch_later')}
                            </DropdownMenuItem>
                            {isOwner && (
                                <>
                                    <DropdownMenuItem onClick={onEdit}>
                                        <Pencil className="mr-2 h-4 w-4" /> {t('edit')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onRetry} className="text-primary">
                                        <RefreshCw className="mr-2 h-4 w-4" /> {t('reprocess_video')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> {t('delete')}
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}

function VideoDetailOverlay({ video, sender, onClose, currentUser, onDelete, onRetry, onEdit }: { video: SharedVideo, sender?: User, onClose: () => void, currentUser: AuthenticatedUser, onDelete: () => void, onRetry: (id: string) => void, onEdit: () => void }) {
    const { t, language } = useLanguage(); const db = useFirestore(); const { toast } = useToast();
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const isOwner = video.senderId === currentUser.uid;
    const [isLiked, setIsLiked] = useState(video.likedBy?.includes(currentUser.uid) || false);
    const [commentText, setCommentText] = useState('');
    const [isSendingComment, setIsSendingComment] = useState(false);

    const commentsQuery = useMemo(() => (db ? query(collection(db, 'videos', video.id, 'comments'), orderBy('timestamp', 'desc'), limit(50)) : null), [db, video.id]);
    const { data: comments, loading: commentsLoading } = useCollection<VideoComment>(commentsQuery);
    const commentUserIds = useMemo(() => Array.from(new Set(comments?.map(c => c.userId) || [])), [comments]);
    const { users: commentAuthors } = useBatchUsers(commentUserIds);

    useEffect(() => {
        if (!db || !video.videoChunkIds) return;
        const load = async () => {
            const cached = await getCachedFile(video.id);
            if (cached) { setVideoUrl(cached); setIsLoading(false); return; }
            setIsLoading(true);
            try {
                const chunksData: { part: number, data: string }[] = [];
                for (const chunkId of video.videoChunkIds!) {
                    const snap = await getDoc(doc(db, 'videoChunks', chunkId));
                    if (snap.exists()) chunksData.push(snap.data() as any);
                }
                chunksData.sort((a, b) => a.part - b.part);
                const assembled = chunksData.map(c => c.data).join('');
                const dataUrl = `data:${video.videoMimeType};base64,${assembled}`;
                await cacheFile(video.id, dataUrl);
                setVideoUrl(await getCachedFile(video.id));
                updateDoc(doc(db, 'videos', video.id), { views: increment(1) });
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        load();
    }, [video.id, db, video.videoChunkIds, video.videoMimeType]);

    const toggleLike = async () => {
        if (!db) return;
        const ref = doc(db, 'videos', video.id);
        try {
            if (isLiked) { await updateDoc(ref, { likedBy: arrayRemove(currentUser.uid) }); setIsLiked(false); }
            else { await updateDoc(ref, { likedBy: arrayUnion(currentUser.uid) }); setIsLiked(true); }
        } catch(e) {}
    };

    const handleAddComment = async (parentId?: string) => {
        if (!db || !commentText.trim() || isSendingComment) return;
        setIsSendingComment(true);
        try {
            await addDoc(collection(db, 'videos', video.id, 'comments'), {
                userId: currentUser.uid,
                userName: currentUser.name || currentUser.username,
                userAvatar: currentUser.avatar || null,
                text: commentText.trim(),
                timestamp: serverTimestamp(),
                ...(parentId && { parentId })
            });
            setCommentText('');
        } catch (e) { console.error(e); }
        finally { setIsSendingComment(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in slide-in-from-bottom duration-500 overflow-hidden">
            <header className="h-14 flex items-center px-4 shrink-0 bg-background pt-[calc(0.5rem+env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><ChevronDown className="h-6 w-6" /></Button>
                <div className="flex-1 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{video.isShort === 1 ? t('infshorts_title') : t('infvid_title')}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(`/IV/T/${video.id}`); toast({ title: t('copy_success_toast') }); }} className="rounded-full"><Share2 className="h-5 w-5" /></Button>
            </header>
            
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                <div className="flex-1 bg-black flex items-center justify-center relative min-h-[30vh] lg:min-h-0">
                    {videoUrl ? (
                        <video ref={videoRef} src={videoUrl} controls autoPlay className={cn("w-full h-full", video.isShort === 1 ? "object-contain" : "object-contain")} />
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-white/50">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <p className="text-xs font-bold uppercase tracking-widest">{t('connecting')}...</p>
                        </div>
                    )}
                </div>

                <div className="lg:w-[400px] flex flex-col bg-background border-l shrink-0 h-[50vh] lg:h-auto">
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-xl font-black font-headline leading-tight whitespace-pre-wrap break-words">{video.title}</h2>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                                    <span>{video.views || 0} views</span>
                                    <span>•</span>
                                    <span>{formatDistanceToNow(video.timestamp.toMillis(), { addSuffix: true, locale: language === 'ru' ? ru : enUS })}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                                <Button 
                                    variant="outline" 
                                    onClick={toggleLike}
                                    className={cn("h-11 rounded-2xl font-bold gap-2 px-6 transition-all", isLiked && "border-primary bg-primary/5 text-primary")}
                                >
                                    <ThumbsUp className={cn("h-4 w-4", isLiked && "fill-current")} />
                                    <span>{video.likedBy?.length || 0}</span>
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-11 w-11 rounded-full text-muted-foreground"
                                    onClick={() => {
                                        const isSaved = currentUser.watchLater?.includes(video.id);
                                        updateDoc(doc(db!, 'users', currentUser.uid), {
                                            watch_later: isSaved ? arrayRemove(video.id) : arrayUnion(video.id)
                                        });
                                        toast({ title: t('dm_success') });
                                    }}
                                >
                                    <Clock className={cn("h-4 w-4", currentUser.watchLater?.includes(video.id) && "text-primary fill-primary")} />
                                </Button>
                                <Button variant="outline" size="icon" className="h-11 w-11 rounded-full text-muted-foreground" onClick={() => { navigator.clipboard.writeText(`/IV/T/${video.id}`); toast({ title: t('copy_success_toast') }); }}>
                                    <Share2 className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-11 w-11 rounded-full text-muted-foreground" onClick={() => { if (videoUrl) { const a = document.createElement('a'); a.href = videoUrl; a.download = `${video.title}.mp4`; a.click(); } }}>
                                    <Download className="h-4 w-4" />
                                </Button>
                                {isOwner && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-full text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl font-bold">
                                            <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-4 w-4" /> {t('edit')}</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onRetry(video.id)} className="text-primary"><RefreshCw className="mr-2 h-4 w-4" /> {t('reprocess_video')}</DropdownMenuItem>
                                            <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> {t('delete')}</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>

                            <div className="bg-muted/40 p-4 rounded-2xl border border-border/50">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border-2 border-background"><AvatarImage src={sender?.avatar} /><AvatarFallback>{sender?.name?.charAt(0)}</AvatarFallback></Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-base truncate flex items-center gap-1">{sender?.name}{sender?.isAdmin && <VerifiedBadge className="w-3.5 h-3.5" />}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">@{sender?.username?.replace('@','')}</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="rounded-xl font-bold" onClick={() => window.dispatchEvent(new CustomEvent('open-chat', { detail: { chatId: [currentUser.uid, sender?.id || ''].sort().join('_') } }))}>Message</Button>
                                </div>
                                {video.description && <p className="mt-4 text-xs font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">{video.description}</p>}
                            </div>

                            <CommentSection video={video} comments={comments || []} currentUser={currentUser} onAddComment={handleAddComment} commentText={commentText} setAddCommentText={setCommentText} commentAuthors={commentAuthors} />
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}

function CommentSection({ video, comments, currentUser, onAddComment, commentText, setAddCommentText, commentAuthors }: { video: SharedVideo, comments: VideoComment[], currentUser: AuthenticatedUser, onAddComment: (replyTo?: VideoComment) => void, commentText: string, setAddCommentText: (t: string) => void, commentAuthors: Record<string, User> }) {
    const { t, language } = useLanguage(); const [replyingTo, setReplyTo] = useState<VideoComment | null>(null);
    const parentComments = comments.filter(c => !c.parentId);
    const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId).sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

    return (
        <div className="flex flex-col h-full gap-4">
            <h3 className="text-lg font-black font-headline uppercase tracking-tighter hidden lg:block">{t('comments')} ({comments.length})</h3>
            <div className="flex gap-3 mb-4">
                <Avatar className="h-9 w-9 shrink-0"><AvatarImage src={currentUser.avatar} /><AvatarFallback>{currentUser.name?.charAt(0)}</AvatarFallback></Avatar>
                <div className="flex-1 space-y-2">
                    {replyingTo && (<div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg text-[10px]"><p className="font-bold text-muted-foreground">{t('replying_to', { name: replyingTo.userName })}</p><Button variant="ghost" size="icon" className="h-3 w-3" onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></Button></div>)}
                    <div className="flex gap-2">
                        <Input value={commentText} onChange={e => setAddCommentText(e.target.value)} placeholder={t('no_comments_yet')} className="rounded-xl h-10 border-none bg-muted/50" onKeyDown={e => e.key === 'Enter' && (onAddComment(replyingTo || undefined), setReplyTo(null))} maxLength={1600} />
                        <Button size="icon" onClick={() => { onAddComment(replyingTo || undefined); setReplyTo(null); }} className="rounded-full h-10 w-10 shrink-0"><Send className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>
            <div className="space-y-6">
                {parentComments.length > 0 ? parentComments.map(comment => (
                    <div key={comment.id} className="space-y-4">
                        <CommentItem comment={comment} author={commentAuthors[comment.userId]} onReply={() => setReplyTo(comment)} t={t} language={language} />
                        <div className="ml-10 space-y-4 border-l pl-4">
                            {getReplies(comment.id).map(reply => (
                                <CommentItem key={reply.id} comment={reply} author={commentAuthors[reply.userId]} onReply={() => setReplyTo(reply)} isReply t={t} language={language} />
                            ))}
                        </div>
                    </div>
                )) : (<div className="text-center py-10 opacity-30"><MessageSquare className="h-10 w-10 mx-auto mb-2" /><p className="text-xs font-bold uppercase">{t('no_comments_yet')}</p></div>)}
            </div>
        </div>
    );
}

function CommentItem({ comment, author, onReply, isReply, t, language }: { comment: VideoComment, author?: User, onReply: () => void, isReply?: boolean, t: any, language: string }) {
    return (
        <div className="flex gap-3 group">
            <Avatar className={cn(isReply ? "h-7 w-7" : "h-9 w-9", "shrink-0")}>
                <AvatarImage src={author?.avatar} />
                <AvatarFallback>{comment.userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <p className={cn("font-bold truncate", isReply ? "text-xs" : "text-sm")}>{comment.userName}</p>
                    <span className="text-[10px] text-muted-foreground font-medium">{formatDistanceToNow(comment.timestamp?.toMillis() || Date.now(), { addSuffix: true, locale: language === 'ru' ? ru : enUS })}</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">{comment.text}</p>
                <div className="flex items-center gap-4 mt-1.5">
                    <button onClick={onReply} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">{t('reply')}</button>
                </div>
            </div>
        </div>
    );
}
