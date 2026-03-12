'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Loader2, Radio, LogOut } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, Timestamp, getDoc } from 'firebase/firestore';
import type { PopulatedChat, AuthenticatedUser, CallParticipant, Call } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GroupCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: PopulatedChat;
  currentUser: AuthenticatedUser;
  isOwner: boolean;
}

export function GroupCallDialog({ open, onOpenChange, chat, currentUser, isOwner }: GroupCallDialogProps) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [callData, setCallData] = useState<Call | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isBroadcast = chat.type === 'channel';
  const canStream = isOwner || !isBroadcast;

  const uniqueParticipants = useMemo(() => {
    if (!callData?.participants) return [];
    const seen = new Set();
    return callData.participants.filter(p => {
      if (!p.uid || seen.has(p.uid)) return false;
      seen.add(p.uid);
      return true;
    });
  }, [callData?.participants]);

  useEffect(() => {
    if (!open || !db) return;

    const callRef = doc(db, 'calls', chat.id);
    const unsubscribe = onSnapshot(callRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Call;
        setCallData(data);
        if (data.status === 'ended') {
          onOpenChange(false);
        }
      } else if (!isOwner) {
        onOpenChange(false);
      }
    });

    const setupMedia = async () => {
      if (canStream) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setLocalStream(stream);
          if (videoRef.current) videoRef.current.srcObject = stream;

          // Speaking Detection Logic
          const audioContext = new AudioContext();
          const analyser = audioContext.createAnalyser();
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 256;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const checkSpeaking = async () => {
            if (!open) return;
            analyser.getByteFrequencyData(dataArray);
            let volume = 0;
            for (let i = 0; i < dataArray.length; i++) volume += dataArray[i];
            const avg = volume / dataArray.length;
            const isSpeaking = avg > 30 && !isMuted;

            // Sync speaking status to Firestore
            const callSnap = await getDoc(callRef);
            if (callSnap.exists()) {
                const parts = (callSnap.data().participants || []) as CallParticipant[];
                const meIndex = parts.findIndex(p => p.uid === currentUser.uid);
                if (meIndex !== -1 && parts[meIndex].isSpeaking !== isSpeaking) {
                    parts[meIndex].isSpeaking = isSpeaking;
                    updateDoc(callRef, { participants: parts });
                }
            }
            if (open) setTimeout(checkSpeaking, 500);
          };
          checkSpeaking();

        } catch (err) {
          console.error("Group call media error:", err);
          toast({
            variant: 'destructive',
            title: t('microphone_error_title'),
            description: t('microphone_error_desc'),
          });
        }
      }
    };

    setupMedia();

    const participant: CallParticipant = {
      uid: currentUser.uid,
      name: currentUser.name || currentUser.username || 'User',
      avatar: currentUser.avatar || '',
      joinedAt: Timestamp.now(),
      isSpeaking: false
    };

    updateDoc(callRef, {
      participants: arrayUnion(participant),
      status: 'active'
    }).catch(e => {
        console.error("Failed to join call document:", e);
    });

    return () => {
      unsubscribe();
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      updateDoc(callRef, {
        participants: arrayRemove(participant)
      }).catch(() => {});
    };
  }, [open, db, chat.id, currentUser.uid, isOwner, canStream, isMuted]);

  const handleLeave = async () => {
    onOpenChange(false);
  };

  const handleEndSession = async () => {
    if (!db || !isOwner) return;
    const callRef = doc(db, 'calls', chat.id);
    try {
      await updateDoc(callRef, { status: 'ended', participants: [] });
    } catch (e) { console.error(e); }
    onOpenChange(false);
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!localStream.getAudioTracks()[0].enabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!localStream.getVideoTracks()[0].enabled);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden bg-[#0F0F0F] text-white border-none rounded-3xl animate-in zoom-in duration-300"
        hideCloseButton
      >
        <DialogTitle className="sr-only">
          {isBroadcast ? t('broadcast_title') : t('video_chat_title')}
        </DialogTitle>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 bg-zinc-900/50 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center text-red-500 animate-pulse">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg font-headline leading-none">
                {isBroadcast ? t('broadcast_title') : t('video_chat_title')}
              </h2>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1 font-bold">
                {isBroadcast ? t('broadcast_live') : t('video_chat_live')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <Users className="w-4 h-4 text-white/60" />
            <span className="text-sm font-bold">{uniqueParticipants.length}</span>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 relative bg-black flex items-center justify-center p-4 min-h-[40vh] md:min-h-0">
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 border border-white/5">
              {canStream ? (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={cn("w-full h-full object-cover", isVideoOff && "hidden")} 
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-white/40 font-bold uppercase tracking-widest text-xs">{t('connecting')}...</p>
                </div>
              )}
              
              {(isVideoOff || !canStream) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <Avatar className="w-32 h-32 text-4xl border-4 border-white/10 relative z-10">
                      <AvatarImage src={currentUser.avatar} />
                      <AvatarFallback className="bg-zinc-800 text-white">{currentUser.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-48 md:h-auto md:w-72 flex flex-col bg-zinc-900/30 border-t md:border-t-0 md:border-l border-white/5 shrink-0">
            <div className="p-4 border-b border-white/5 hidden md:block">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">{t('participants')}</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {uniqueParticipants.map(p => (
                    <div key={p.uid} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
                      <Avatar className="w-10 h-10 border border-white/10">
                        <AvatarImage src={p.avatar} />
                        <AvatarFallback className="bg-zinc-800 text-xs">{p.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold truncate">{p.name}</p>
                          <div className="shrink-0">
                            {p.uid === currentUser.uid ? (
                                isMuted ? <MicOff className="w-3.5 h-3.5 text-red-500" /> : <Mic className={cn("w-3.5 h-3.5", p.isSpeaking ? "text-green-500" : "text-white/40")} />
                            ) : (
                                <Mic className={cn("w-3.5 h-3.5", p.isSpeaking ? "text-green-500" : "text-white/40")} />
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-white/40 truncate">{p.uid === currentUser.uid ? t('you_message_preview') : (isBroadcast ? 'Слушатель' : 'Участник')}</p>
                      </div>
                    </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="h-24 shrink-0 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-4 px-6">
          {canStream && (
            <div className="flex items-center gap-4 bg-zinc-900/80 backdrop-blur-xl p-2 rounded-3xl border border-white/10">
              <Button variant={isMuted ? "destructive" : "ghost"} size="icon" className="w-12 h-12 rounded-2xl" onClick={toggleMic}>
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
              <Button variant={isVideoOff ? "destructive" : "ghost"} size="icon" className="w-12 h-12 rounded-2xl" onClick={toggleVideo}>
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button variant="outline" className="h-14 px-6 rounded-2xl font-bold bg-white/10 border-white/10 hover:bg-white/20 text-white" onClick={handleLeave}>
                <LogOut className="mr-2 h-5 w-5" /> {t('leave')}
            </Button>
            {isOwner && (
                <Button variant="destructive" className="h-14 px-6 rounded-2xl font-bold gap-2" onClick={handleEndSession}>
                    <PhoneOff className="h-5 w-5" /> {t('delete')}
                </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
