
'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, Timestamp } from 'firebase/firestore';
import type { PopulatedChat, AuthenticatedUser, CallParticipant, Call } from '@/types';
import { useLanguage } from '@/context/language-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

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
  const [callData, setCallData] = useState<Call | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isBroadcast = chat.type === 'channel';
  const canStream = isOwner || !isBroadcast;

  useEffect(() => {
    if (!open || !db) return;

    const callRef = doc(db, 'calls', chat.id);
    const unsubscribe = onSnapshot(callRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Call;
        setCallData(data);
        if (data.status === 'ended') {
          handleEndSession();
        }
      } else if (!isOwner) {
        onOpenChange(false);
      }
    });

    // Request permissions and setup local stream
    if (canStream) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          setLocalStream(stream);
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.error("Group call media error:", err);
        });
    }

    // Join call logic
    const participant: CallParticipant = {
      uid: currentUser.uid,
      name: currentUser.name || currentUser.username || 'User',
      avatar: currentUser.avatar,
      joinedAt: Timestamp.now(),
    };

    updateDoc(callRef, {
      participants: arrayUnion(participant),
      status: 'active'
    }).catch(console.error);

    return () => {
      unsubscribe();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      updateDoc(callRef, {
        participants: arrayRemove(participant)
      }).catch(() => {});
    };
  }, [open, db, chat.id, currentUser.uid, isOwner]);

  const handleEndSession = async () => {
    if (!db) return;
    const callRef = doc(db, 'calls', chat.id);
    if (isOwner) {
      await updateDoc(callRef, { status: 'ended', participants: [] });
    }
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
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden bg-black text-white border-none rounded-3xl">
        <DialogHeader className="p-6 shrink-0 bg-gradient-to-b from-black/80 to-transparent z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center animate-pulse">
                <span className="text-[10px] font-black">{t('broadcast_live')}</span>
              </div>
              <div>
                <DialogTitle className="text-white text-xl font-headline">{isBroadcast ? t('broadcast_title') : t('video_chat_title')}</DialogTitle>
                <p className="text-white/60 text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {t('participants')}: {callData?.participants?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 relative flex items-center justify-center bg-zinc-900">
          {canStream ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cn("w-full h-full object-cover", isVideoOff && "hidden")} 
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-white/80 font-bold">{t('connecting')}...</p>
            </div>
          )}
          
          {isVideoOff && canStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
              <Avatar className="w-32 h-32 text-4xl">
                <AvatarImage src={currentUser.avatar} />
                <AvatarFallback>{currentUser.name?.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Participant Overlay */}
          <div className="absolute bottom-20 left-6 flex flex-wrap gap-2 max-w-[200px]">
            {callData?.participants?.slice(0, 5).map(p => (
              <Avatar key={p.uid} className="w-8 h-8 border-2 border-black">
                <AvatarImage src={p.avatar} />
                <AvatarFallback className="text-[10px]">{p.name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
            {callData?.participants && callData.participants.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-black flex items-center justify-center text-[10px] font-bold">
                +{callData.participants.length - 5}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 shrink-0 bg-gradient-to-t from-black/80 to-transparent z-10 flex-row justify-center gap-4">
          {canStream && (
            <>
              <Button 
                variant={isMuted ? "destructive" : "secondary"} 
                size="icon" 
                className="w-14 h-14 rounded-full" 
                onClick={toggleMic}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </Button>
              <Button 
                variant={isVideoOff ? "destructive" : "secondary"} 
                size="icon" 
                className="w-14 h-14 rounded-full" 
                onClick={toggleVideo}
              >
                {isVideoOff ? <VideoOff /> : <Video />}
              </Button>
            </>
          )}
          <Button variant="destructive" size="icon" className="w-14 h-14 rounded-full" onClick={handleEndSession}>
            <PhoneOff />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
