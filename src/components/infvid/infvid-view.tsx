'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, addDoc, updateDoc, Timestamp, setDoc, getDoc, query, orderBy, limit, increment, onSnapshot, arrayUnion, arrayRemove, writeBatch, where, deleteDoc } from 'firebase/firestore';
import type { AuthenticatedUser, SharedVideo, User, VideoComment } from '@/types';
import { Loader2, Upload, Play, X, User as UserIcon, Share2, MoreVertical, Search, PlusCircle, ArrowLeft, PlayCircle, Send, ThumbsUp, ImageIcon, ChevronDown, ChevronUp, AlertCircle, Zap, Clock, Trash2, Pencil, RefreshCw, MessageSquare } from 'lucide-react';
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

const compressImage = (file: File, quality = 0.75, maxDimension = 800): Promise<string> => {
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
    const handleSystemBack = () => { if (selectedVideoId) { setSelectedVideoId(null); setFetchedExternalVideo(null); } else if (isUploadOpen) { setIsUploadOpen(false); setRetryVideoId(null); } else { onClose(); } };
    let backListener: any; if (Capacitor.isNativePlatform()) { import('@capacitor/app').then(({ App }) => { backListener = App.addListener('backButton', handleSystemBack); }); }
    return () => { if (backListener) { backListener.then((l: any) => l.remove()); } };
  }, [selectedVideoId, isUploadOpen, onClose]);

  useEffect(() => {
    if (!initialVideoId || !db) return;
    const checkAndLoadVideo = async () => {
        const foundInList = videos?.find(v => v.id === initialVideoId);
        if (foundInList) { setSelectedVideoId(initialVideoId); return; }
        try {
            const videoSnap = await getDoc(doc(db, 'videos', initialVideoId));
            if (videoSnap.exists()) { const videoData = { id: videoSnap.id, ...videoSnap.data() } as SharedVideo; setFetchedExternalVideo(videoData); setSelectedVideoId(initialVideoId); }
            else { toast({ variant: 'destructive', title: t('video_not_found') }); }
        } catch (e) { console.error("Error loading initial video:", e); }
    };
    if (!videosLoading) { checkAndLoadVideo(); }
  }, [initialVideoId, db, videosLoading, videos, t, toast]);

  const handleUploadVideo = async (file: File, thumbnailFile: File | null, title: string, description: string, isShort: number) => {
    if (!db) return; setIsUploading(true);
    try {
        const videoDocRef = retryVideoId ? doc(db, 'videos', retryVideoId) : doc(collection(db, 'videos')); 
        const timestamp = Timestamp.now();
        let thumbnailUrl = ''; if (thumbnailFile) { thumbnailUrl = await compressImage(thumbnailFile); }
        const videoData: any = { title, description, senderId: currentUser.uid, timestamp, videoMimeType: file.type, videoStatus: 'uploading', views: 0, likedBy: [], thumbnailUrl, isShort, isProcessed: 0 };
        
        if (retryVideoId) {
            await updateDoc(videoDocRef, videoData);
        } else {
            await setDoc(videoDocRef, videoData);
        }

        await uploadVideoData(videoDocRef.id, file, currentUser.uid);
        toast({ title: t('dm_success'), description: t('infvid_upload_success') }); 
        setIsUploadOpen(false);
        setRetryVideoId(null);
    } catch (error) { 
        console.error("Video upload failed:", error); 
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload video.' }); 
    } finally { setIsUploading(false); }
  };

  const uploadVideoData = async (videoId: string, file: File, senderId: string) => {
      const videoBase64 = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve((reader.result as string).split(',')[1]); });
      const CHUNK_SIZE = 900 * 1024;
      const chunkIds: string[] = [];
      for (let i = 0; i < videoBase64.length; i += CHUNK_SIZE) {
          const chunkRef = doc(collection(db!, 'videoChunks'));
          await setDoc(chunkRef, { data: videoBase64.substring(i, i + CHUNK_SIZE), part: i/CHUNK_SIZE, senderId: senderId, videoId: videoId });
          chunkIds.push(chunkRef.id);
          await new Promise(res => setTimeout(res, 50));
      }
      await updateDoc(doc(db!, 'videos', videoId), { videoStatus: 'complete', videoChunkIds: chunkIds, isProcessed: 1 });
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
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete video. Check permissions.' });
    }
  };

  const handleRetryUpload = (vidId: string) => {
      setRetryVideoId(vidId);
      setIsUploadOpen(true);
      setSelectedVideoId(null); 
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
            <main className="flex-1 overflow-y-auto"><div className="p-4 md:p-6 bg-muted/10 pb-[calc(2rem+env(safe-area-inset-bottom))]">{videosLoading ? (<div className="flex h-full items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>) : filteredVideos.length > 0 ? (<div className={cn("grid gap-6 max-w-7xl mx-auto", activeTab === 'shorts' ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>{filteredVideos.map((video) => (<VideoCard key={video.id} video={video} sender={senders[video.senderId]} onClick={() => setSelectedVideoId(video.id)} isShortMode={activeTab === 'shorts'} currentUser={currentUser} onToggleWatchLater={() => toggleWatchLater(video.id)} onDelete={() => handleDeleteVideo(video.id)} onRetry={() => handleRetryUpload(video.id)} />))}</div>) : (<div className="flex h-full flex-col items-center justify-center text-muted-foreground text-center py-20"><PlayCircle className="h-20 w-20 mb-4 opacity-20" /><h3 className="text-xl font-semibold">{activeTab === 'watch_later' ? 'Список пуст.' : activeTab === 'shorts' ? 'Нет коротких видео.' : t('infvid_no_videos')}</h3></div>)}</div></main>
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
      {selectedVideo && (<VideoDetailOverlay key={selectedVideo.id} video={selectedVideo} sender={senders[selectedVideo.senderId]} onClose={() => { setSelectedVideoId(null); setFetchedExternalVideo(null); }} currentUser={currentUser} onDelete={() => handleDeleteVideo(selectedVideo.id)} onRetry={() => handleRetryUpload(selectedVideo.id)} />)}
    </div>
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
                    <p className="text-muted-foreground leading-relaxed max-w-md mx-auto mb-8 text-lg">{t('infvid_upload_warning_desc')}</p>
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
                        <div className="space-y-6"><div className="space-y-3"><label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t('infvid_video_title_label')}</label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('infvid_video_title_placeholder')} disabled={isUploading} className="rounded-2xl h-14 px-6 bg-muted/30 border-none font-bold" /></div><div className="space-y-3"><label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t('infvid_video_desc_label')}</label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('infvid_video_desc_placeholder')} className="resize-none rounded-2xl p-6 bg-muted/30 border-none min-h-[120px]" rows={3} disabled={isUploading} /></div></div>
                    </div>
                    <div className="pt-6 flex gap-4"><Button variant="ghost" onClick={onClose} disabled={isUploading} className="rounded-2xl flex-1 h-14 text-lg font-bold">{t('cancel')}</Button><Button onClick={handleSubmit} disabled={!file || !title.trim() || isUploading} className="rounded-2xl flex-[2] font-black h-14 text-lg shadow-xl">{isUploading ? t('loading') : t('save')}</Button></div>
                </div>
            </ScrollArea>
        </div>
    );
}

function VideoCard({ video, sender, onClick, isShortMode, currentUser, onToggleWatchLater, onDelete, onRetry }: { video: SharedVideo, sender?: User, onClick: () => void, isShortMode?: boolean, currentUser: AuthenticatedUser, onToggleWatchLater: () => void, onDelete: () => void, onRetry: () => void }) {
    const { t, language } = useLanguage(); const timeAgo = video.timestamp?.seconds ? formatDistanceToNow(new Date(video.timestamp.seconds * 1000), { addSuffix: true, locale: language === 'ru' ? ru : enUS }) : '';
    const isOwner = video.senderId === currentUser.uid;
    const isSaved = currentUser.watchLater?.includes(video.id);
    const needsReprocess = isOwner && (!video.isProcessed || video.isProcessed !== 1 || video.videoStatus === 'failed' || video.videoStatus === 'uploading');

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = `/IV/V/${video.id}`;
        navigator.clipboard.writeText(link);
        toast({ title: t('video_link_copied') });
    };

    if (isShortMode) {
        return (
            <div className="flex flex-col gap-2 group cursor-pointer animate-in zoom-in duration-300" onClick={onClick}>
                <div className="relative aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-lg border border-white/5 transition-transform hover:scale-[1.03] duration-300">
                    {video.thumbnailUrl ? (<img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />) : (<div className="absolute inset-0 flex items-center justify-center bg-primary/5"><Zap className="h-12 w-12 text-primary/30" /></div>)}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                    <div className="absolute bottom-3 left-3 right-3 text-white"><p className="text-[9px] font-bold opacity-80 mt-1 uppercase tracking-widest">{t('infvid_views', { count: video.views || 0 })}</p></div>
                    <div className="absolute top-3 left-3 bg-primary text-white p-1 rounded-full shadow-lg"><Zap className="h-3 w-3 fill-white" /></div>
                </div>
                <div className="flex items-start justify-between px-1">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold line-clamp-2 leading-tight">{video.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">{sender?.name}</p>
                    </div>
                    <div onClick={e => e.stopPropagation()} className="shrink-0">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl w-48 z-[60]">
                                <DropdownMenuItem onSelect={handleShare} className="font-bold"><Share2 className="h-4 w-4 mr-2" /> {t('share')}</DropdownMenuItem>
                                {isOwner && (
                                    <>
                                        {needsReprocess && <DropdownMenuItem onSelect={onRetry} className="font-bold text-primary"><RefreshCw className="h-4 w-4 mr-2" /> {t('retry_upload')}</DropdownMenuItem>}
                                        <DropdownMenuItem onSelect={onDelete} className="text-destructive font-bold"><Trash2 className="h-4 w-4 mr-2" /> {t('delete')}</DropdownMenuItem>
                                    </>
                                )}
                                {!isOwner && <DropdownMenuItem onSelect={onToggleWatchLater} className="font-bold">{isSaved ? t('remove_from_watch_later') : t('add_to_watch_later')}</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-3 group cursor-pointer relative" onClick={onClick}>
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-sm transition-transform hover:scale-[1.02] duration-200">
                {video.thumbnailUrl ? (<img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                        {video.videoStatus === 'failed' ? <AlertCircle className="h-12 w-12 text-destructive mb-2" /> : <Play className="h-12 w-12 text-white fill-white opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] text-white font-bold">HD</div>
            </div>
            <div className="flex gap-3">
                <Avatar className="h-9 w-9 shrink-0 border border-border/50"><AvatarImage src={sender?.avatar} /><AvatarFallback><UserIcon className="h-5 w-5" /></AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold line-clamp-2 leading-snug text-sm group-hover:text-primary transition-colors">{video.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 truncate font-medium">{sender?.name || '...'}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5"><span className="font-black text-primary">{t('infvid_views', { count: video.views || 0 })}</span><span className='w-1 h-1 rounded-full bg-muted-foreground/30' /><span>{timeAgo}</span></div>
                </div>
                <div onClick={e => e.stopPropagation()} className="shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-48 z-[60]">
                            <DropdownMenuItem onSelect={handleShare} className="font-bold"><Share2 className="h-4 w-4 mr-2" /> {t('share')}</DropdownMenuItem>
                            {isOwner && (
                                <>
                                    {needsReprocess && <DropdownMenuItem onSelect={onRetry} className="font-bold text-primary"><RefreshCw className="h-4 w-4 mr-2" /> {t('retry_upload')}</DropdownMenuItem>}
                                    <DropdownMenuItem onSelect={onDelete} className="text-destructive font-bold"><Trash2 className="h-4 w-4 mr-2" /> {t('delete')}</DropdownMenuItem>
                                </>
                            )}
                            {!isOwner && <DropdownMenuItem onSelect={onToggleWatchLater} className="font-bold">{isSaved ? t('remove_from_watch_later') : t('add_to_watch_later')}</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}

function VideoDetailOverlay({ video: initialVideo, sender, onClose, currentUser, onDelete, onRetry }: { video: SharedVideo, sender?: User, onClose: () => void, currentUser: AuthenticatedUser, onDelete: () => void, onRetry: (vidId: string) => void }) {
    const { t, language } = useLanguage(); const db = useFirestore(); const { toast } = useToast(); const [videoUrl, setVideoUrl] = useState<string | null>(null); const [isLoading, setIsLoading] = useState(true); const [assemblyProgress, setAssemblyProgress] = useState(0); const [commentText, setAddCommentText] = useState(''); const [comments, setComments] = useState<VideoComment[]>([]); const [video, setVideo] = useState<SharedVideo>(initialVideo); const [likedBy, setLikedBy] = useState<string[]>(initialVideo.likedBy || []); const [userSubscriptions, setUserSubscriptions] = useState<string[]>(currentUser.subscriptions || []); const viewIncremented = useRef(false);
    const isLiked = likedBy.includes(currentUser.uid); const isSubscribed = userSubscriptions.includes(video.senderId);
    const isSaved = currentUser.watchLater?.includes(video.id);
    const isOwner = video.senderId === currentUser.uid;
    const needsReprocess = isOwner && (!video.isProcessed || video.isProcessed !== 1 || video.videoStatus === 'failed' || video.videoStatus === 'uploading');
    const commentUserIds = useMemo(() => Array.from(new Set(comments.map(c => c.userId))), [comments]); const { users: commentAuthors } = useBatchUsers(commentUserIds);
    const [showComments, setShowComments] = useState(false);

    useEffect(() => {
        if (!db) return;
        const load = async () => {
            const cached = await getCachedFile(video.id);
            if (cached) { setVideoUrl(cached); setIsLoading(false); if (!viewIncremented.current) { viewIncremented.current = true; updateDoc(doc(db, 'videos', video.id), { views: increment(1) }); } return; }
            if (video.videoStatus !== 'complete' || !video.videoChunkIds) { if (video.videoStatus === 'uploading') setIsLoading(true); return; }
            setIsLoading(true);
            try {
                const totalChunks = video.videoChunkIds.length; const chunksData: { part: number, data: string }[] = [];
                for (let i = 0; i < totalChunks; i++) { const chunkSnap = await getDoc(doc(db, 'videoChunks', video.videoChunkIds[i])); if (chunkSnap.exists()) { chunksData.push(chunkSnap.data() as any); setAssemblyProgress(Math.round(((i + 1) / totalChunks) * 100)); } }
                chunksData.sort((a, b) => a.part - b.part); const assembledBase64 = chunksData.map(c => c.data).join(''); const dataUrl = `data:${video.videoMimeType};base64,${assembledBase64}`;
                await cacheFile(video.id, dataUrl); setVideoUrl(await getCachedFile(video.id));
                if (!viewIncremented.current) { viewIncremented.current = true; updateDoc(doc(db, 'videos', video.id), { views: increment(1) }); }
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        load();
    }, [video.id, db, video.videoStatus, video.videoChunkIds, video.videoMimeType]);

    useEffect(() => { if (!db) return; const videoRef = doc(db, 'videos', video.id); return onSnapshot(videoRef, (snapshot) => { if (snapshot.exists()) { const data = { id: snapshot.id, ...snapshot.data() } as SharedVideo; setVideo(data); setLikedBy(data.likedBy || []); } }); }, [db, video.id]);
    useEffect(() => { if (!db) return; const commentsQuery = query(collection(db, 'videos', video.id, 'comments'), orderBy('timestamp', 'desc'), limit(100)); return onSnapshot(commentsQuery, (snapshot) => { setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VideoComment))); }); }, [db, video.id]);
    useEffect(() => { if (!db) return; const userRef = doc(db, 'users', currentUser.uid); return onSnapshot(userRef, (snapshot) => { if (snapshot.exists()) { setUserSubscriptions(snapshot.data().subscriptions || []); } }); }, [db, currentUser.uid]);

    const handleAddComment = async (replyTo?: VideoComment) => { if (!db || !commentText.trim()) return; try { const commentData: any = { userId: currentUser.uid, userName: currentUser.name || currentUser.username, userAvatar: currentUser.avatar || null, text: commentText.trim(), timestamp: Timestamp.now(), likedBy: [], }; if (replyTo) { commentData.parentId = replyTo.parentId || replyTo.id; commentData.replyTo = { userId: replyTo.userId, userName: replyTo.userName, }; } await addDoc(collection(db, 'videos', video.id, 'comments'), commentData); setAddCommentText(''); } catch (e) { console.error(e); } };
    const handleToggleLike = async () => { if (!db) return; const videoRef = doc(db, 'videos', video.id); try { if (isLiked) { await updateDoc(videoRef, { likedBy: arrayRemove(currentUser.uid) }); } else { await updateDoc(videoRef, { likedBy: arrayUnion(currentUser.uid) }); } } catch (e) { console.error("Like toggle failed", e); } };
    const handleToggleSubscribe = async () => { if (!db || video.senderId === currentUser.uid) return; const userRef = doc(db, 'users', currentUser.uid); const authorRef = doc(db, 'users', video.senderId); try { const batch = writeBatch(db); if (isSubscribed) { batch.update(userRef, { subscriptions: arrayRemove(video.senderId) }); batch.update(authorRef, { subscriberCount: increment(-1) }); } else { batch.update(userRef, { subscriptions: arrayUnion(video.senderId) }); batch.update(authorRef, { subscriberCount: increment(1) }); } await batch.commit(); } catch (e) { console.error("Subscription toggle failed", e); } };
    const handleShare = () => { const internalLink = `/IV/V/${video.id}`; navigator.clipboard.writeText(internalLink); toast({ title: t('video_link_copied') }); };
    const toggleWatchLater = async () => { if (!db) return; try { await updateDoc(doc(db, 'users', currentUser.uid), { watchLater: isSaved ? arrayRemove(video.id) : arrayUnion(video.id) }); toast({ title: t('dm_success'), description: isSaved ? t('remove_from_watch_later') : t('add_to_watch_later') }); } catch(e) {} };

    const timeAgo = video.timestamp?.seconds ? formatDistanceToNow(new Date(video.timestamp.seconds * 1000), { addSuffix: true, locale: language === 'ru' ? ru : enUS }) : '';

    if (video.isShort === 1) {
        return (
            <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden">
                <div className="relative w-full h-full max-w-[480px] bg-zinc-950 flex items-center justify-center shadow-2xl">
                    {isLoading ? (
                        <div className="text-center space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{assemblyProgress}%</p>
                        </div>
                    ) : videoUrl && (
                        <video src={videoUrl} controls={false} autoPlay loop playsInline className="h-full w-full object-cover" />
                    )}

                    <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-30">
                        <div className="flex flex-col items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={handleToggleLike} className={cn("h-11 w-11 rounded-full bg-white/10 backdrop-blur-xl border border-white/5 transition-all active:scale-125", isLiked && "text-red-500")}>
                                <ThumbsUp className={cn("h-5.5 w-5.5", isLiked && "fill-current")} />
                            </Button>
                            <span className="text-[10px] font-black drop-shadow-md">{likedBy.length}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setShowComments(true)} className="h-11 w-11 rounded-full bg-white/10 backdrop-blur-xl border border-white/5">
                                <MessageSquare className="h-5.5 w-5.5" />
                            </Button>
                            <span className="text-[10px] font-black drop-shadow-md">{comments.length}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={toggleWatchLater} className={cn("h-11 w-11 rounded-full bg-white/10 backdrop-blur-xl border border-white/5", isSaved && "text-amber-500")}>
                            <Clock className={cn("h-5.5 w-5.5", isSaved && "fill-current")} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleShare} className="h-11 w-11 rounded-full bg-white/10 backdrop-blur-xl border border-white/5">
                            <Share2 className="h-5.5 w-5.5" />
                        </Button>
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-white/10 backdrop-blur-xl border border-white/5">
                                    <MoreVertical className="h-5.5 w-5.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl w-48 z-[110]">
                                <DropdownMenuItem onSelect={handleShare} className="font-bold"><Share2 className="h-4 w-4 mr-2" /> {t('share')}</DropdownMenuItem>
                                {isOwner && (
                                    <>
                                        {needsReprocess && <DropdownMenuItem onSelect={() => onRetry(video.id)} className="font-bold text-primary"><RefreshCw className="h-4 w-4 mr-2" /> {t('retry_upload')}</DropdownMenuItem>}
                                        <DropdownMenuItem onSelect={onDelete} className="text-destructive font-bold"><Trash2 className="h-4 w-4 mr-2" /> {t('delete')}</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-5 pb-8 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-20 pointer-events-none">
                        <div className="flex items-center gap-2.5 mb-3 pointer-events-auto">
                            <Avatar className="h-9 w-9 border-2 border-white/10 shadow-lg">
                                <AvatarImage src={sender?.avatar} />
                                <AvatarFallback className="bg-zinc-800 text-white text-xs">{sender?.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <p className="font-bold text-xs truncate flex items-center gap-1 drop-shadow-md">
                                    {sender?.name} <VerifiedBadge className="w-3 h-3" />
                                </p>
                                <button className="h-auto p-0 text-[10px] font-black uppercase text-primary hover:text-white transition-colors" onClick={handleToggleSubscribe}>
                                    {isSubscribed ? t('subscribed') : t('subscribe')}
                                </button>
                            </div>
                        </div>
                        <h3 className="font-bold text-sm leading-snug mb-1 drop-shadow-md pointer-events-auto">{video.title}</h3>
                        <p className="text-[11px] text-white/70 line-clamp-2 leading-relaxed drop-shadow-sm pointer-events-auto">{video.description}</p>
                    </div>

                    <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-6 right-4 z-40 text-white bg-black/40 backdrop-blur-md rounded-full h-9 w-9 hover:bg-black/60 transition-colors">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <Dialog open={showComments} onOpenChange={setShowComments}>
                    <DialogContent className="max-w-md h-[65vh] rounded-t-[2.5rem] border-none p-0 overflow-hidden flex flex-col bg-card z-[120]">
                        <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between">
                            <DialogTitle className="text-xs font-black uppercase tracking-widest opacity-60 ml-2">{t('comments')} ({comments.length})</DialogTitle>
                            <Button variant="ghost" size="icon" onClick={() => setShowComments(false)} className="h-8 w-8 rounded-full"><X className="h-4 w-4" /></Button>
                        </DialogHeader>
                        <ScrollArea className="flex-1">
                            <div className="p-5"><CommentSection video={video} comments={comments} currentUser={currentUser} onAddComment={handleAddComment} commentText={commentText} setAddCommentText={setAddCommentText} commentAuthors={commentAuthors} /></div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-300">
            <header className="h-14 flex items-center px-4 border-b shrink-0 bg-background/95 backdrop-blur-md sticky top-0 z-20 pt-[calc(1rem+env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
                <div className="ml-4 flex items-center gap-2 overflow-hidden flex-1"><InfVidIcon className="h-6 w-6 shrink-0" /><span className="font-bold font-headline truncate">{video.title}</span></div>
                <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 ml-2"><X className="h-5 w-5" /></Button>
            </header>
            <div className="flex-1 overflow-y-auto">
                <section className="w-full bg-black flex items-center justify-center relative overflow-hidden h-[60vh]">
                    <div className="h-full flex items-center justify-center w-full">
                        {isLoading ? (<div className="text-center space-y-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /><div className="space-y-2"><p className="text-white/60 text-sm font-medium animate-pulse">{video.videoStatus === 'uploading' ? t('processing_video') : t('loading')}...</p><p className="text-primary text-xs font-black">{assemblyProgress}%</p></div></div>) : videoUrl ? (<video src={videoUrl} controls autoPlay className="h-full max-h-full max-w-full object-contain" />) : (<p className="text-destructive font-bold">{t('infvid_assembly_failed')}</p>)}
                    </div>
                </section>
                <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6 p-4 md:p-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    <div className="flex-1 space-y-6">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold font-headline leading-tight">{video.title}</h2>
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12 border"><AvatarImage src={sender?.avatar} /><AvatarFallback>{sender?.name?.charAt(0)}</AvatarFallback></Avatar>
                                    <div><div className="font-bold text-base leading-tight flex items-center gap-1">{sender?.name}{(sender?.username === '@InfiniteBot' || sender?.username === '@Infinite') && <VerifiedBadge className='w-3 h-3' />}</div><p className="text-xs text-muted-foreground font-medium">{t('subscribers_count', { count: sender?.subscriberCount || 0 })}</p></div>
                                    <Button variant={isSubscribed ? "secondary" : "default"} className={cn("ml-4 rounded-full h-10 px-6 font-bold", !isSubscribed && "bg-black text-white dark:bg-white dark:text-black")} onClick={handleToggleSubscribe} disabled={video.senderId === currentUser.uid}>{isSubscribed ? t('subscribed') : t('subscribe')}</Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant={isLiked ? "default" : "secondary"} className={cn("rounded-full gap-2 h-10 px-5 transition-all", isLiked && "bg-primary text-primary-foreground")} onClick={handleToggleLike}><ThumbsUp className={cn("h-4 w-4", isLiked && "fill-current")} /><span className="text-xs font-bold">{t('likes', { count: likedBy.length })}</span></Button>
                                    <Button variant="secondary" className={cn("rounded-full gap-2 h-10 px-5 transition-all", isSaved && "bg-amber-500 text-white")} onClick={toggleWatchLater}><Clock className={cn("h-4 w-4", isSaved && "fill-current")} /><span className="text-xs font-bold">{t('watch_later')}</span></Button>
                                    <Button variant="secondary" className="rounded-full gap-2 h-10 px-5" onClick={handleShare}><Share2 className="h-4 w-4" /><span className="text-xs font-bold">{t('share')}</span></Button>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-muted">
                                                <MoreVertical className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl w-48">
                                            <DropdownMenuItem onSelect={handleShare} className="font-bold"><Share2 className="h-4 w-4 mr-2" /> {t('share')}</DropdownMenuItem>
                                            {isOwner && (
                                                <>
                                                    {needsReprocess && <DropdownMenuItem onSelect={() => onRetry(video.id)} className="font-bold text-primary"><RefreshCw className="h-4 w-4 mr-2" /> {t('retry_upload')}</DropdownMenuItem>}
                                                    <DropdownMenuItem onSelect={onDelete} className="text-destructive font-bold"><Trash2 className="h-4 w-4 mr-2" /> {t('delete')}</DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                            <div className="bg-muted/50 rounded-2xl p-4 text-sm leading-relaxed border border-border/50 shadow-inner"><div className="flex items-center gap-2 font-bold mb-2"><span className="text-primary text-base font-black">{t('infvid_views', { count: video.views || 0 })}</span><span className="w-1 h-1 rounded-full bg-muted-foreground/30" /><span className="text-muted-foreground">{timeAgo}</span></div><p className="text-foreground/80 whitespace-pre-wrap">{video.description || t('infvid_no_description')}</p></div>
                        </div>
                        <div className="block lg:hidden pt-6"><CommentSection video={video} comments={comments} currentUser={currentUser} onAddComment={handleAddComment} commentText={commentText} setAddCommentText={setAddCommentText} commentAuthors={commentAuthors} /></div>
                    </div>
                    <aside className="hidden lg:block w-96 shrink-0 border-l pl-6"><CommentSection video={video} comments={comments} currentUser={currentUser} onAddComment={handleAddComment} commentText={commentText} setAddCommentText={setAddCommentText} commentAuthors={commentAuthors} /></aside>
                </div>
            </div>
        </div>
    );
}

function CommentSection({ video, comments, currentUser, onAddComment, commentText, setAddCommentText, commentAuthors }: { video: SharedVideo, comments: VideoComment[], currentUser: AuthenticatedUser, onAddComment: (replyTo?: VideoComment) => void, commentText: string, setAddCommentText: (v: string) => void, commentAuthors: Record<string, User> }) {
    const { t } = useLanguage(); const [replyingTo, setReplyingTo] = useState<VideoComment | null>(null);
    const rootComments = useMemo(() => comments.filter(c => !c.parentId), [comments]);
    const repliesMap = useMemo(() => { const map: Record<string, VideoComment[]> = {}; comments.forEach(c => { if (c.parentId) { if (!map[c.parentId]) map[c.parentId] = []; map[c.parentId].push(c); } }); return map; }, [comments]);
    const onSubmit = () => { onAddComment(replyingTo || undefined); setReplyingTo(null); };
    return (<div className="space-y-6"><h3 className="text-lg font-bold flex items-center gap-2">{t('comments')}<Badge variant="secondary" className="font-mono px-2">{comments.length}</Badge></h3><div className="space-y-2">{replyingTo && (<div className="flex items-center justify-between bg-primary/10 p-2 rounded-lg text-xs animate-in slide-in-from-bottom-1"><span className="font-medium text-primary">Ответ пользователю {replyingTo.userName}</span><Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setReplyingTo(null)}><X className="h-3 w-3" /></Button></div>)}<div className="flex gap-3"><Avatar className="h-10 w-10 shrink-0"><AvatarImage src={currentUser.avatar} /><AvatarFallback>{currentUser.name?.charAt(0)}</AvatarFallback></Avatar><div className="flex-1 space-y-2"><Textarea placeholder={t('add_comment_placeholder')} className="min-h-[44px] h-11 py-3 resize-none border-none bg-muted/50 rounded-xl" value={commentText} onChange={(e) => setAddCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSubmit())} /><div className="flex justify-end gap-2 pt-1"><Button variant="ghost" size="sm" onClick={() => { setAddCommentText(''); setReplyingTo(null); }} className="rounded-full px-4" disabled={!commentText.trim()}>{t('cancel')}</Button><Button size="sm" className="rounded-full px-6 font-bold gap-2" onClick={onSubmit} disabled={!commentText.trim()}>{t('ok')}</Button></div></div></div></div><div className="space-y-6 pt-2">{rootComments.length > 0 ? rootComments.map((comment) => (<CommentItem key={comment.id} comment={comment} replies={repliesMap[comment.id] || []} currentUser={currentUser} onReply={setReplyingTo} videoId={video.id} commentAuthors={commentAuthors} />)) : (<div className="py-12 text-center text-muted-foreground italic text-sm bg-muted/20 rounded-2xl border-2 border-dashed border-border/50">{t('no_comments_yet')}</div>)}</div></div>);
}

function CommentItem({ comment, replies, currentUser, onReply, videoId, commentAuthors }: { comment: VideoComment, replies: VideoComment[], currentUser: AuthenticatedUser, onReply: (c: VideoComment) => void, videoId: string, commentAuthors: Record<string, User> }) {
    const { t, language } = useLanguage(); const db = useFirestore(); const [showReplies, setShowReplies] = useState(false); const isLikedByMe = comment.likedBy?.includes(currentUser.uid);
    const author = commentAuthors[comment.userId]; const displayName = author?.name || comment.userName; const displayAvatar = author?.avatar || comment.userAvatar;
    const handleToggleCommentLike = async (c: VideoComment) => { if (!db) return; const commentRef = doc(db, 'videos', videoId, 'comments', c.id); const isLiked = c.likedBy?.includes(currentUser.uid); try { if (isLiked) await updateDoc(commentRef, { likedBy: arrayRemove(currentUser.uid) }); else await updateDoc(commentRef, { likedBy: arrayUnion(currentUser.uid) }); } catch (e) { console.error("Comment like failed", e); } };
    return (<div className="space-y-3"><div className="flex gap-3"><Avatar className="h-9 w-9 shrink-0"><AvatarImage src={displayAvatar || undefined} /><AvatarFallback>{displayName?.charAt(0)}</AvatarFallback></Avatar><div className="flex-1 space-y-1"><div className="flex items-center gap-2"><span className="font-bold text-sm leading-none">{displayName}</span><span className="text-[10px] text-muted-foreground font-medium">{comment.timestamp?.seconds ? formatDistanceToNow(new Date(comment.timestamp.seconds * 1000), { addSuffix: true, locale: language === 'ru' ? ru : enUS }) : ''}</span></div><p className="text-sm leading-relaxed text-foreground/90">{comment.text}</p><div className="flex items-center gap-4 mt-1"><button onClick={() => handleToggleCommentLike(comment)} className={cn("flex items-center gap-1.5 transition-colors", isLikedByMe ? "text-primary" : "text-muted-foreground hover:text-primary")}><ThumbsUp className={cn("h-3.5 w-3.5", isLikedByMe && "fill-current")} /><span className="text-[10px] font-bold">{comment.likedBy?.length || 0}</span></button><button onClick={() => onReply(comment)} className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors">{t('reply')}</button></div></div></div>{replies.length > 0 && (<div className="ml-12 space-y-3"><button onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-2 text-[11px] font-bold text-primary hover:underline">{showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}{t('answers_button')} ({replies.length})</button>{showReplies && (<div className="space-y-4 pt-1 animate-in slide-in-from-top-1">{replies.map((reply) => { const isReplyLikedByMe = reply.likedBy?.includes(currentUser.uid); const replyAuthor = commentAuthors[reply.userId]; const replyDisplayName = replyAuthor?.name || reply.userName; const replyDisplayAvatar = replyAuthor?.avatar || reply.userAvatar; return (<div key={reply.id} className="flex gap-3"><Avatar className="h-7 w-7 shrink-0"><AvatarImage src={replyDisplayAvatar || undefined} /><AvatarFallback className="text-[10px]">{replyDisplayName?.charAt(0)}</AvatarFallback></Avatar><div className="flex-1 space-y-1"><div className="flex items-center gap-2"><span className="font-bold text-xs leading-none">{replyDisplayName}</span><span className="text-[9px] text-muted-foreground">{reply.timestamp?.seconds ? formatDistanceToNow(new Date(reply.timestamp.seconds * 1000), { addSuffix: true, locale: language === 'ru' ? ru : enUS }) : ''}</span></div><p className="text-xs text-foreground/90"><span className="text-primary font-bold mr-1">{reply.replyTo?.userName}</span>{reply.text}</p><div className="flex items-center gap-3 mt-1"><button onClick={() => handleToggleCommentLike(reply)} className={cn("flex items-center gap-1 transition-colors", isReplyLikedByMe ? "text-primary" : "text-muted-foreground hover:text-primary")}><ThumbsUp className={cn("h-3.5 w-3.5", isReplyLikedByMe && "fill-current")} /><span className="text-[9px] font-bold">{reply.likedBy?.length || 0}</span></button><button onClick={() => onReply(comment)} className="text-[9px] font-bold text-muted-foreground hover:text-primary transition-colors">{t('reply')}</button></div></div></div>); })}</div>)}</div>)}</div>);
}
