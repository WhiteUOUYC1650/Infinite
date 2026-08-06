
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/language-context';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, addDoc, updateDoc, Timestamp, setDoc, getDoc, query, orderBy, limit, onSnapshot, arrayUnion, arrayRemove, writeBatch, deleteDoc, increment, serverTimestamp } from 'firebase/firestore';
import type { AuthenticatedUser, SharedMusic, User, VideoComment } from '@/types';
import { Loader2, Upload, Play, X, User as UserIcon, Share2, MoreVertical, Search, PlusCircle, ArrowLeft, PlayCircle, Send, ThumbsUp, ImageIcon, ChevronDown, ChevronUp, AlertCircle, Zap, Clock, Trash2, Pencil, RefreshCw, MessageSquare, Download, Music, Pause, MoreHorizontal } from 'lucide-react';
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

export function InfMusicView({ currentUser, onClose }: { currentUser: AuthenticatedUser, onClose: () => void }) {
  const { t } = useLanguage(); const db = useFirestore(); const { toast } = useToast(); const { theme: colorTheme } = useTheme();
  const [isUploadOpen, setIsUploadOpen] = useState(false); const [isUploading, setIsUploading] = useState(false); const [searchQuery, setSearchQuery] = useState(''); const [selectedMusicId, setSelectedMusicId] = useState<string | null>(null);
  const isPrem = currentUser.subscriptionTier === 'prem'; const maxSizeText = isPrem ? '4GB' : '1GB'; const maxSizeInBytes = isPrem ? 4 * 1024 * 1024 * 1024 : 1 * 1024 * 1024 * 1024;

  const musicQuery = useMemo(() => { 
    if (!db) return null; 
    return query(collection(db, 'music'), orderBy('timestamp', 'desc'), limit(100)); 
  }, [db]);
  const { data: musicList, loading: musicLoading } = useCollection<SharedMusic>(musicQuery);
  const senderIds = useMemo(() => Array.from(new Set(musicList?.map(m => m.senderId) || [])), [musicList]);
  const { users: senders } = useBatchUsers(senderIds);

  const filteredMusic = useMemo(() => {
      if (!musicList) return [];
      const q = searchQuery.toLowerCase().trim();
      if (!q) return musicList;
      return musicList.filter(m => m.title.toLowerCase().includes(q) || m.author.toLowerCase().includes(q) || (senders[m.senderId]?.name || '').toLowerCase().includes(q));
  }, [musicList, searchQuery, senders]);

  useEffect(() => {
    const handleSystemBack = () => { if (selectedMusicId) { setSelectedMusicId(null); } else if (isUploadOpen) { setIsUploadOpen(false); } else { onClose(); } };
    let backListener: any; if (Capacitor.isNativePlatform()) { import('@capacitor/app').then(({ App }) => { backListener = App.addListener('backButton', handleSystemBack); }); }
    return () => { if (backListener) { backListener.then((l: any) => l.remove()); } };
  }, [selectedMusicId, isUploadOpen, onClose]);

  const handleUploadMusic = async (file: File, coverFile: File | null, title: string, author: string, description: string) => {
    if (!db) return; setIsUploading(true);
    try {
        const musicDocRef = doc(collection(db, 'music')); 
        let coverUrl = ''; if (coverFile) { coverUrl = await compressImage(coverFile); }
        
        await setDoc(musicDocRef, {
            title, author, description, senderId: currentUser.uid, timestamp: serverTimestamp(),
            musicMimeType: file.type, musicStatus: 'uploading', listens: 0, likedBy: [], coverUrl
        });

        const CHUNK_SIZE = 384 * 1024;
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

            const chunkRef = doc(collection(db, 'musicChunks'));
            await setDoc(chunkRef, { data: base64, part: i, senderId: currentUser.uid, musicId: musicDocRef.id, timestamp: serverTimestamp() });
            chunkIds.push(chunkRef.id);
            
            if (i % 5 === 0) await new Promise(res => setTimeout(res, 100));
        }

        await updateDoc(musicDocRef, { musicStatus: 'complete', musicChunkIds: chunkIds });
        
        toast({ title: t('dm_success'), description: t('infmusic_upload_success') }); 
        setIsUploadOpen(false);
    } catch (error) { 
        console.error("Music upload failed:", error); 
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload music.' }); 
    } finally { setIsUploading(false); }
  };

  const selectedMusic = useMemo(() => { if (!selectedMusicId) return null; return musicList?.find(m => m.id === selectedMusicId) || null; }, [selectedMusicId, musicList]);

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      {!isUploadOpen ? (
          <>
            <header className="flex-shrink-0 flex flex-col border-b z-20 pt-[calc(1rem+env(safe-area-inset-top))] bg-background">
                <div className="flex items-center p-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Music className="h-7 w-7 text-primary shrink-0" /><h1 className="text-xl font-bold font-headline truncate">{t('infmusic_title')}</h1><Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none shrink-0">BETA</Badge>
                        </div>
                    </div>
                    <div className="flex-1 max-w-sm mx-4 hidden md:block"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder={t('search_placeholder')} className="pl-9 h-10 bg-muted/50 rounded-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
                    <div className="flex items-center gap-2 shrink-0"><Button onClick={() => setIsUploadOpen(true)} className="gap-2 rounded-full h-10 px-4"><PlusCircle className="h-4 w-4" /><span className="hidden sm:inline">{t('infmusic_upload_title')}</span></Button></div>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto"><div className="p-4 md:p-6 bg-muted/10 pb-[calc(2rem+env(safe-area-inset-bottom))]">{musicLoading ? (<div className="flex h-full items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>) : filteredMusic.length > 0 ? (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">{filteredMusic.map((music) => (<MusicCard key={music.id} music={music} sender={senders[music.senderId]} onClick={() => setSelectedMusicId(music.id)} />))}</div>) : (<div className="flex h-full flex-col items-center justify-center text-muted-foreground text-center py-20"><PlayCircle className="h-20 w-20 mb-4 opacity-20" /><h3 className="text-xl font-semibold">{t('infmusic_no_music')}</h3></div>)}</div></main>
          </>
      ) : (
          <UploadMusicView 
            onClose={() => setIsUploadOpen(false)} 
            onUpload={handleUploadMusic} 
            isUploading={isUploading} 
            maxSizeText={maxSizeText} 
            maxSizeInBytes={maxSizeInBytes}
            t={t}
          />
      )}
      {selectedMusic && (<MusicPlayerOverlay music={selectedMusic} sender={senders[selectedMusic.senderId]} onClose={() => setSelectedMusicId(null)} currentUser={currentUser} />)}
    </div>
  );
}

function UploadMusicView({ onClose, onUpload, isUploading, maxSizeText, maxSizeInBytes, t }: { onClose: () => void, onUpload: any, isUploading: boolean, maxSizeText: string, maxSizeInBytes: number, t: any }) {
    const { toast } = useToast(); const [file, setFile] = useState<File | null>(null); const [cover, setCover] = useState<File | null>(null); const [coverPreview, setCoverPreview] = useState<string | null>(null); const [title, setTitle] = useState(''); const [author, setAuthor] = useState(''); const [description, setDescription] = useState(''); 
    const fileInputRef = useRef<HTMLInputElement>(null); const coverInputRef = useRef<HTMLInputElement>(null);
    
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (e.target.files?.[0]) { 
            const selectedFile = e.target.files[0]; 
            if (selectedFile.size > maxSizeInBytes) { toast({ variant: 'destructive', title: t('max_file_size_label', { size: maxSizeText }) }); return; } 
            setFile(selectedFile); 
            if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, "")); 
        } 
    };
    const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) { setCover(e.target.files[0]); setCoverPreview(URL.createObjectURL(e.target.files[0])); } };
    const handleSubmit = async () => { if (!file || !title.trim() || !author.trim()) return; await onUpload(file, cover, title, author, description); };

    return (
        <div className="flex flex-col h-full bg-background animate-in slide-in-from-right duration-300 relative">
            {isUploading && (
                <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-8" />
                    <h3 className="text-2xl font-bold font-headline mb-2">{t('creating')}...</h3>
                    <p className="text-muted-foreground">{t('infvid_upload_warning_desc')}</p>
                </div>
            )}
            <header className="h-16 flex items-center px-4 border-b shrink-0 bg-background pt-[calc(1rem+env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
                <div className="ml-4 flex-1"><h2 className="text-xl font-bold font-headline">{t('infmusic_upload_title')}</h2></div>
            </header>
            <ScrollArea className="flex-1">
                <div className="space-y-8 p-6 max-w-2xl mx-auto pb-20">
                    <div className={cn("border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all", file ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50")} onClick={() => !isUploading && fileInputRef.current?.click()}>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*" className="hidden" />
                        {file ? (<div className="text-center"><Music className="h-12 w-12 text-primary mx-auto mb-2" /><p className="font-bold truncate max-w-[300px]">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p></div>) : (<div className="text-center"><Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="font-bold text-muted-foreground">{t('infmusic_upload_title')}</p><p className="text-[10px] text-muted-foreground mt-1 uppercase">{t('max_file_size_label', { size: maxSizeText })}</p></div>)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cover Art</Label><div className={cn("aspect-square border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-muted/20 relative", coverPreview ? "border-solid border-primary" : "")} onClick={() => !isUploading && coverInputRef.current?.click()}><input type="file" ref={coverInputRef} onChange={handleCoverSelect} accept="image/*" className="hidden" />{coverPreview ? (<img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />) : (<ImageIcon className="h-8 w-8 text-muted-foreground/30" />)}</div></div>
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('infmusic_title')}</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Song title..." className="rounded-xl h-11 bg-muted/30 border-none font-bold" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('infmusic_author_label')}</Label><Input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Artist name..." className="rounded-xl h-11 bg-muted/30 border-none font-bold" /></div>
                        </div>
                    </div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('description_label')}</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell us about this track..." className="resize-none rounded-xl p-4 bg-muted/30 border-none min-h-[100px]" rows={3} /></div>
                    <div className="pt-4 flex gap-3"><Button variant="ghost" onClick={onClose} disabled={isUploading} className="rounded-xl flex-1 h-12">Cancel</Button><Button onClick={handleSubmit} disabled={!file || !title.trim() || !author.trim() || isUploading} className="rounded-xl flex-[2] font-bold h-12 shadow-lg">Save & Upload</Button></div>
                </div>
            </ScrollArea>
        </div>
    );
}

function MusicCard({ music, sender, onClick }: { music: SharedMusic, sender?: User, onClick: () => void }) {
    return (
        <div className="bg-card border rounded-2xl p-3 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group" onClick={onClick}>
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0 relative">
                {music.coverUrl ? <img src={music.coverUrl} className="w-full h-full object-cover" /> : <Music className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/30" />}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Play className="h-5 w-5 fill-current" /></div>
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate group-hover:text-primary transition-colors whitespace-pre-wrap break-words">{music.title}</p>
                <p className="text-xs text-muted-foreground truncate whitespace-pre-wrap break-words">{music.author}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase font-bold tracking-tighter">by {sender?.name}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-4 w-4" /></Button>
        </div>
    );
}

function MusicPlayerOverlay({ music, sender, onClose, currentUser }: { music: SharedMusic, sender?: User, onClose: () => void, currentUser: AuthenticatedUser }) {
    const { t, language } = useLanguage(); const db = useFirestore(); const { toast } = useToast();
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isLiked, setIsLiked] = useState(music.likedBy?.includes(currentUser.uid) || false);
    
    const [commentText, setCommentText] = useState('');
    const [isSendingComment, setIsSendingComment] = useState(false);
    const commentsQuery = useMemo(() => (db ? query(collection(db, 'music', music.id, 'comments'), orderBy('timestamp', 'desc'), limit(50)) : null), [db, music.id]);
    const { data: comments, loading: commentsLoading } = useCollection<VideoComment>(commentsQuery);
    const commentUserIds = useMemo(() => Array.from(new Set(comments?.map(c => c.userId) || [])), [comments]);
    const { users: commentAuthors } = useBatchUsers(commentUserIds);

    useEffect(() => {
        if (!db || !music.musicChunkIds) return;
        const load = async () => {
            const cached = await getCachedFile(music.id);
            if (cached) { setAudioUrl(cached); setIsLoading(false); return; }
            setIsLoading(true);
            try {
                const chunksData: { part: number, data: string }[] = [];
                for (const chunkId of music.musicChunkIds!) {
                    const snap = await getDoc(doc(db, 'musicChunks', chunkId));
                    if (snap.exists()) chunksData.push(snap.data() as any);
                }
                chunksData.sort((a, b) => a.part - b.part);
                const assembled = chunksData.map(c => c.data).join('');
                const dataUrl = `data:${music.musicMimeType};base64,${assembled}`;
                await cacheFile(music.id, dataUrl);
                setAudioUrl(await getCachedFile(music.id));
                updateDoc(doc(db, 'music', music.id), { listens: increment(1) });
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        load();
    }, [music.id, db, music.musicChunkIds, music.musicMimeType]);

    const togglePlay = () => { if (!audioRef.current) return; if (isPlaying) audioRef.current.pause(); else audioRef.current.play(); setIsPlaying(!isPlaying); };
    const formatTime = (t: number) => { const m = Math.floor(t / 60); const s = Math.floor(t % 60); return `${m}:${s.toString().padStart(2, '0')}`; };
    
    const toggleLike = async () => {
        if (!db) return;
        const ref = doc(db, 'music', music.id);
        try {
            if (isLiked) { await updateDoc(ref, { likedBy: arrayRemove(currentUser.uid) }); setIsLiked(false); }
            else { await updateDoc(ref, { likedBy: arrayUnion(currentUser.uid) }); setIsLiked(true); }
        } catch(e) {}
    };

    const handleAddComment = async () => {
        if (!db || !commentText.trim() || isSendingComment) return;
        setIsSendingComment(true);
        try {
            await addDoc(collection(db, 'music', music.id, 'comments'), {
                userId: currentUser.uid,
                userName: currentUser.name || currentUser.username,
                userAvatar: currentUser.avatar || null,
                text: commentText.trim(),
                timestamp: serverTimestamp(),
            });
            setCommentText('');
        } catch (e) { console.error(e); }
        finally { setIsSendingComment(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in slide-in-from-bottom duration-500 overflow-hidden">
            <header className="h-14 flex items-center px-4 shrink-0 bg-background/95 backdrop-blur-md pt-[calc(0.5rem+env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><ChevronDown className="h-6 w-6" /></Button>
                <div className="flex-1 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('infmusic_title')}</p></div>
                <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(`/IM/T/${music.id}`); toast({ title: t('copy_success_toast') }); }} className="rounded-full"><Share2 className="h-5 w-5" /></Button>
            </header>
            
            <ScrollArea className="flex-1 overflow-y-auto">
                <div className="flex flex-col p-6 max-w-lg mx-auto w-full pb-24">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-20 h-20 rounded-xl bg-muted shadow-xl overflow-hidden shrink-0 relative">
                            {music.coverUrl ? <img src={music.coverUrl} className="w-full h-full object-cover" alt="Cover" /> : <Music className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/20" />}
                            {isLoading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-black font-headline leading-tight tracking-tighter break-words whitespace-pre-wrap">{music.title}</h2>
                            <p className="text-primary font-bold text-base break-words whitespace-pre-wrap">{music.author}</p>
                        </div>
                    </div>

                    {audioUrl && (
                        <audio 
                            ref={audioRef} 
                            src={audioUrl} 
                            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} 
                            onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} 
                            onEnded={() => setIsPlaying(false)}
                        />
                    )}

                    <div className="w-full bg-black/5 dark:bg-white/5 p-6 rounded-[2.5rem] mb-10 space-y-4">
                        <div className="flex items-center gap-6">
                            <Button onClick={togglePlay} disabled={isLoading} className="h-16 w-16 rounded-full bg-primary text-white shadow-xl active:scale-95 transition-all p-0 flex items-center justify-center shrink-0">
                                {isPlaying ? <Pause className="h-8 w-8 fill-current" /> : <Play className="h-8 w-8 fill-current ml-1" />}
                            </Button>
                            <div className="flex-1 space-y-2">
                                <div className="relative h-2 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
                                    if (!audioRef.current || !duration) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
                                }}>
                                    <div className="absolute h-full bg-primary transition-all duration-100" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
                                </div>
                                <div className="flex justify-between text-[11px] font-mono font-bold opacity-60">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-center gap-8 pt-2">
                            <Button variant="ghost" size="icon" onClick={toggleLike} className={cn("h-12 w-12 rounded-full transition-all active:scale-90", isLiked && "text-red-500 bg-red-500/10")}>
                                <ThumbsUp className={cn("h-6 w-6", isLiked && "fill-current")} />
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full text-muted-foreground bg-black/5"><MoreHorizontal className="h-6 w-6" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="rounded-xl font-bold">
                                    <DropdownMenuItem onClick={() => { if (audioUrl) { const a = document.createElement('a'); a.href = audioUrl; a.download = `${music.title}.mp3`; a.click(); } }}><Download className="mr-2 h-4 w-4" /> {t('download')}</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {music.description && (
                        <div className="w-full bg-muted/30 p-5 rounded-3xl border border-border/40 text-left mb-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">About Track</p>
                            <p className="text-sm font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">{music.description}</p>
                        </div>
                    )}
                    
                    <div className="w-full bg-muted/40 p-4 rounded-3xl border border-border/50 mb-10 text-left">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">{t('sender_label')}</p>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 border-2 border-background"><AvatarImage src={sender?.avatar} /><AvatarFallback>{sender?.name?.charAt(0)}</AvatarFallback></Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-base truncate flex items-center gap-1">{sender?.name}{sender?.isAdmin && <VerifiedBadge className="w-3.5 h-3.5" />}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">@{sender?.username?.replace('@','')}</p>
                            </div>
                            <Button variant="outline" size="sm" className="rounded-xl font-bold h-10 px-4" onClick={() => window.dispatchEvent(new CustomEvent('open-chat', { detail: { chatId: [currentUser.uid, sender?.id || ''].sort().join('_') } }))}>Message</Button>
                        </div>
                    </div>

                    <div className="w-full text-left space-y-6">
                        <h3 className="text-xl font-black font-headline uppercase tracking-tighter ml-1">{t('comments')} ({comments?.length || 0})</h3>
                        <div className="flex gap-3 mb-6">
                            <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={currentUser.avatar} /><AvatarFallback>{currentUser.name?.charAt(0)}</AvatarFallback></Avatar>
                            <div className="flex-1 flex gap-2">
                                <Input 
                                    value={commentText} 
                                    onChange={e => setCommentText(e.target.value)} 
                                    placeholder="Add a comment..." 
                                    className="rounded-2xl h-11 bg-muted/50 border-none px-4"
                                    onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                    maxLength={1600}
                                />
                                <Button size="icon" onClick={handleAddComment} disabled={!commentText.trim() || isSendingComment} className="rounded-full h-11 w-11 shrink-0 bg-primary/10 text-primary hover:bg-primary/20">
                                    {isSendingComment ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {commentsLoading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary opacity-20" /></div>
                            ) : comments && comments.length > 0 ? (
                                comments.map(comment => (
                                    <div key={comment.id} className="flex gap-3 group">
                                        <Avatar className="h-9 w-9 shrink-0"><AvatarImage src={commentAuthors[comment.userId]?.avatar} /><AvatarFallback>{comment.userName.charAt(0)}</AvatarFallback></Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="font-bold text-sm truncate">{comment.userName}</p>
                                                <span className="text-[10px] text-muted-foreground font-medium">{formatDistanceToNow(comment.timestamp?.toMillis() || Date.now(), { addSuffix: true, locale: language === 'ru' ? ru : enUS })}</span>
                                            </div>
                                            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">{comment.text}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 opacity-30">
                                    <MessageSquare className="h-10 w-10 mx-auto mb-2" />
                                    <p className="text-xs font-bold uppercase tracking-widest">{t('no_comments_yet')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
