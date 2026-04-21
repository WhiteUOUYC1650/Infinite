
'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Phone, PhoneOff, Video as VideoIcon, VideoOff, Maximize2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import type { PopulatedChat, AuthenticatedUser, User, Call } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function DraggableCallBubble({ onClick, isVideo, remoteStream }: { onClick: () => void, isVideo: boolean, remoteStream: MediaStream | null }) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragInfo = useRef<{isDragging: boolean, didMove: boolean, startX: number, startY: number, offsetX: number, offsetY: number}>({isDragging: false, didMove: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0});

  useEffect(() => {
    const initialX = document.documentElement.clientWidth - 80;
    const initialY = document.documentElement.clientHeight - 100;
    setPosition({ x: initialX, y: initialY });
  }, []);

  useEffect(() => {
    if (videoRef.current && remoteStream && isVideo) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isVideo]);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    dragInfo.current.isDragging = true;
    dragInfo.current.didMove = false;
    dragInfo.current.startX = e.clientX;
    dragInfo.current.startY = e.clientY;
    const rect = bubble.getBoundingClientRect();
    dragInfo.current.offsetX = e.clientX - rect.left;
    dragInfo.current.offsetY = e.clientY - rect.top;
    bubble.style.transition = 'none';
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragInfo.current.isDragging || !bubbleRef.current) return;
      if (!dragInfo.current.didMove && (Math.abs(e.clientX - dragInfo.current.startX) > 5 || Math.abs(e.clientY - dragInfo.current.startY) > 5)) {
        dragInfo.current.didMove = true;
      }
      e.preventDefault();
      let newX = e.clientX - dragInfo.current.offsetX;
      let newY = e.clientY - dragInfo.current.offsetY;
      const constrainX = document.documentElement.clientWidth - bubbleRef.current.offsetWidth;
      const constrainY = document.documentElement.clientHeight - bubbleRef.current.offsetHeight;
      newX = Math.max(0, Math.min(newX, constrainX));
      newY = Math.max(0, Math.min(newY, constrainY));
      setPosition({ x: newX, y: newY });
    };
    const onMouseUp = () => {
      if (dragInfo.current.isDragging) {
        dragInfo.current.isDragging = false;
        if (bubbleRef.current) bubbleRef.current.style.transition = '';
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div
      ref={bubbleRef}
      onMouseDown={onMouseDown}
      onClick={() => !dragInfo.current.didMove && onClick()}
      className={cn(
        "fixed z-[100] cursor-pointer rounded-2xl shadow-2xl backdrop-blur-sm transition-all hover:scale-105 overflow-hidden border border-white/20",
        isVideo ? "w-32 aspect-[9/16] bg-black" : "h-16 w-16 bg-green-500/90 flex items-center justify-center"
      )}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      {isVideo ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <Phone className="h-8 w-8 text-white" strokeWidth={1.5} />
      )}
    </div>
  );
}

interface CallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: PopulatedChat;
  otherUser: User | null;
  currentUser: AuthenticatedUser;
  isCaller: boolean;
  isVideo?: boolean;
}

const servers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
};

export function CallDialog({ open, onOpenChange, chat, otherUser, currentUser, isCaller, isVideo = false }: CallDialogProps) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { minimizeCallOnClose } = useTheme();
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const answerApplied = useRef(false);
  const offerApplied = useRef(false);

  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideo);
  const [isMinimized, setIsMinimized] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (callStatus === 'connected') {
        timer = setInterval(() => setDuration(prev => prev + 1), 1000);
    }
    return () => timer && clearInterval(timer);
  }, [callStatus]);

  const endCallLocally = (notifyFirestore = true) => {
    if (callStatus === 'ended' && !peerConnection.current) return;
    setCallStatus('ended');
    
    // Stop local tracks
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
    }

    // Stop remote tracks
    if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
    }
    
    if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
    }
    
    localStreamRef.current = null;
    remoteStreamRef.current = null;

    if(notifyFirestore && db) {
        const callDocRef = doc(db, 'calls', chat.id);
        updateDoc(callDocRef, { status: 'ended' }).catch(() => {});
    }
    
    setTimeout(() => onOpenChange(false), 1500);
  };

  useEffect(() => {
    if (!open || !db) return;

    setCallStatus('connecting');
    setIsMinimized(false);
    answerApplied.current = false;
    offerApplied.current = false;
    setDuration(0);

    const setupCall = async () => {
        try {
            const constraints = { video: isVideo, audio: true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setHasCameraPermission(true);
            localStreamRef.current = stream;
            
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }

            const pc = new RTCPeerConnection(servers);
            peerConnection.current = pc;

            // Proper track addition for two-way audio/video
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const remoteStream = new MediaStream();
            remoteStreamRef.current = remoteStream;
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }

            pc.ontrack = (event) => {
                event.streams[0].getTracks().forEach(track => {
                    remoteStream.addTrack(track);
                });
                setCallStatus('connected');
            };

            pc.onconnectionstatechange = () => {
                if(pc.connectionState === 'connected') setCallStatus('connected');
                if(pc.connectionState === 'failed' || pc.connectionState === 'disconnected') endCallLocally(true);
            };

            const callDocRef = doc(db, 'calls', chat.id);
            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    await updateDoc(callDocRef, {
                        [isCaller ? 'callerCandidates' : 'calleeCandidates']: arrayUnion(event.candidate.toJSON())
                    });
                }
            };
            
            if (isCaller) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await setDoc(callDocRef, {
                    callerId: currentUser.uid,
                    calleeId: otherUser?.id,
                    status: 'calling',
                    isVideo: isVideo,
                    offer: { sdp: offer.sdp, type: offer.type },
                    callerCandidates: [],
                    calleeCandidates: [],
                });
            }

            const unsubscribe = onSnapshot(callDocRef, async (snapshot) => {
                const data = snapshot.data() as Call;
                if (!data || !peerConnection.current) return;

                if (!isCaller && data.offer && !offerApplied.current) {
                    offerApplied.current = true;
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await peerConnection.current.createAnswer();
                    await peerConnection.current.setLocalDescription(answer);
                    await updateDoc(callDocRef, {
                        answer: { sdp: answer.sdp, type: answer.type },
                        status: 'active'
                    });
                }
                
                if (isCaller && data.answer && !answerApplied.current) {
                     answerApplied.current = true;
                     await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
                
                const candidates = isCaller ? data.calleeCandidates : data.callerCandidates;
                if (candidates) {
                    candidates.forEach(c => peerConnection.current?.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
                }

                if (data.status === 'ended') endCallLocally(false);
            });

            return unsubscribe;
        } catch (error) {
            console.error("Call setup error:", error);
            setHasCameraPermission(false);
            toast({ variant: 'destructive', title: t('microphone_error_title'), description: t('microphone_error_desc') });
            endCallLocally(true);
        }
    };
    
    const unsub = setupCall();
    return () => {
        unsub.then(u => u && u());
        endCallLocally(true);
    };
  }, [open, isVideo]);

  const toggleMute = () => {
      if (!localStreamRef.current) return;
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!localStreamRef.current.getAudioTracks()[0].enabled);
  };

  const toggleVideo = () => {
      if (!localStreamRef.current) return;
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!localStreamRef.current.getVideoTracks()[0].enabled);
  };

  return (
    <>
        <Dialog open={open && !isMinimized} onOpenChange={(val) => !val && endCallLocally(true)}>
          <DialogContent 
            className={cn("max-w-md h-[80vh] p-0 overflow-hidden bg-black text-white border-none rounded-3xl animate-in zoom-in duration-300")} 
            hideCloseButton
            onPointerDownOutside={(e) => minimizeCallOnClose && (e.preventDefault(), setIsMinimized(true))}
          >
            <DialogTitle className="sr-only">{isVideo ? t('video_call') : t('audio_call')}</DialogTitle>
            {isVideo ? (
              <div className="relative w-full h-full flex flex-col">
                <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  {callStatus !== 'connected' && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4">
                      <UserAvatarWithStatus user={otherUser!} className="w-32 h-32 text-4xl" />
                      <div className="text-center">
                        <h2 className="text-2xl font-bold">{otherUser?.name}</h2>
                        <p className="text-white/60">{callStatus === 'connecting' ? t('connecting') : t('call_ended')}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute top-6 right-6 w-32 aspect-[9/16] bg-zinc-800 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-20">
                  <video ref={localVideoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover", isVideoOff && "hidden")} />
                  {isVideoOff && (
                    <div className="w-full h-full flex items-center justify-center">
                      <Avatar className='w-16 h-16'><AvatarFallback className='bg-muted text-foreground'>{currentUser.name?.charAt(0)}</AvatarFallback></Avatar>
                    </div>
                  )}
                </div>
                
                {callStatus === 'connected' && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-xs font-bold font-mono">
                        {format(new Date(duration * 1000), 'mm:ss')}
                    </div>
                )}

                <div className="mt-auto p-8 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-6 z-30">
                  <Button variant={isMuted ? "destructive" : "secondary"} size="icon" className="w-16 h-16 rounded-full" onClick={toggleMute}>
                    {isMuted ? <MicOff /> : <Mic />}
                  </Button>
                  <Button variant={isVideoOff ? "destructive" : "secondary"} size="icon" className="w-16 h-16 rounded-full" onClick={toggleVideo}>
                    {isVideoOff ? <VideoOff /> : <VideoIcon />}
                  </Button>
                  <Button variant="destructive" size="icon" className="w-16 h-16 rounded-full shadow-lg" onClick={() => endCallLocally(true)}>
                    <PhoneOff />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-8 flex flex-col items-center justify-center h-full">
                <DialogHeader className="items-center">
                  <UserAvatarWithStatus user={otherUser!} className="w-32 h-32 text-4xl" />
                  <div className="space-y-1 mt-4">
                    <DialogTitle className="text-3xl font-bold">{otherUser?.name}</DialogTitle>
                    <DialogDescription className="text-white/60 text-lg">
                      {callStatus === 'connecting' && t('connecting')}
                      {callStatus === 'connected' && format(new Date(duration * 1000), 'mm:ss')}
                      {callStatus === 'ended' && t('call_ended')}
                    </DialogDescription>
                  </div>
                </DialogHeader>
                <DialogFooter className="flex-row justify-center gap-6">
                  <Button variant={isMuted ? "destructive" : "secondary"} size="icon" className="w-20 h-20 rounded-full" onClick={toggleMute}>
                    {isMuted ? <MicOff className='h-8 w-8' /> : <Mic className='h-8 w-8' />}
                  </Button>
                  <Button variant="destructive" size="icon" className="w-20 h-20 rounded-full shadow-xl" onClick={() => endCallLocally(true)}>
                    <PhoneOff className='h-8 w-8' />
                  </Button>
                </DialogFooter>
              </div>
            )}
            {hasCameraPermission === false && isVideo && (
              <div className="absolute top-4 left-4 right-4 z-50">
                <Alert variant="destructive">
                  <AlertTitle>{t('microphone_error_title')}</AlertTitle>
                  <AlertDescription>{t('microphone_error_desc')}</AlertDescription>
                </Alert>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {isMinimized && open && (
            <DraggableCallBubble onClick={() => setIsMinimized(false)} isVideo={isVideo} remoteStream={remoteStreamRef.current} />
        )}
    </>
  );
}
