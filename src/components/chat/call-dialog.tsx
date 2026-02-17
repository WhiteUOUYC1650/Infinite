'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import type { PopulatedChat, AuthenticatedUser, User, Call } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { useLanguage } from '@/context/language-context';

function DraggableCallBubble({ onClick }: { onClick: () => void }) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 120 });
  const dragInfo = useRef<{isDragging: boolean, didMove: boolean, startX: number, startY: number, offsetX: number, offsetY: number}>({isDragging: false, didMove: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0});

  useEffect(() => {
    // Set initial position after mount to access window object
    const initialX = document.documentElement.clientWidth - 80;
    const initialY = document.documentElement.clientHeight - 100;
    setPosition({ x: initialX, y: initialY });
  }, []);


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
    
    bubble.style.transition = 'none'; // Disable transitions while dragging
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

      // Constrain to viewport
      const constrainX = document.documentElement.clientWidth - bubbleRef.current.offsetWidth;
      const constrainY = document.documentElement.clientHeight - bubbleRef.current.offsetHeight;
      newX = Math.max(0, Math.min(newX, constrainX));
      newY = Math.max(0, Math.min(newY, constrainY));

      setPosition({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      if (dragInfo.current.isDragging) {
        dragInfo.current.isDragging = false;
        if (bubbleRef.current) {
            bubbleRef.current.style.transition = ''; // Re-enable transitions
        }
      }
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragInfo.current.didMove) {
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <div
      ref={bubbleRef}
      onMouseDown={onMouseDown}
      onClick={handleClick}
      className="fixed z-[100] flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-green-500/90 p-2 shadow-lg backdrop-blur-sm transition-all hover:scale-105"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      <Phone className="h-8 w-8 text-white" strokeWidth={1.5} />
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
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export function CallDialog({ open, onOpenChange, chat, otherUser, currentUser, isCaller }: CallDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const answerApplied = useRef(false);
  const offerApplied = useRef(false);

  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (callStatus === 'connected') {
        timer = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
    } else {
        setDuration(0); // Reset timer if not connected
    }
    return () => {
        if (timer) clearInterval(timer);
    };
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Local cleanup function
  const endCallLocally = (notifyFirestore = true) => {
    if (callStatus === 'ended' && !peerConnection.current) return;
    
    setCallStatus('ended');
    
    localStream.current?.getTracks().forEach((track) => track.stop());
    peerConnection.current?.close();
    localStream.current = null;
    peerConnection.current = null;
    
    if(notifyFirestore && db) {
        const callDocRef = doc(db, 'calls', chat.id);
        getDoc(callDocRef).then(docSnap => {
            if (docSnap.exists() && docSnap.data().status !== 'ended') {
                updateDoc(callDocRef, { status: 'ended' }).catch(() => {});
            }
        });
    }

    // Delay closing the dialog to tell parent component to unmount us
    setTimeout(() => {
        onOpenChange(false);
    }, 1500);
  };

  useEffect(() => {
    if (!open || !db) return;

    // Reset all local states for a new call
    setCallStatus('connecting');
    setIsMinimized(false);
    answerApplied.current = false;
    offerApplied.current = false;
    setDuration(0);

    let callDocUnsubscribe: () => void;
    
    const setupCall = async () => {
        try {
            const pc = new RTCPeerConnection(servers);
            peerConnection.current = pc;
            
            const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            localStream.current = stream;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const remoteStream = new MediaStream();
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = remoteStream;
            }
            pc.ontrack = (event) => {
                event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
            };
            pc.onconnectionstatechange = () => {
                if(pc.connectionState === 'connected') {
                    setCallStatus('connected');
                }
            }


            const callDocRef = doc(db, 'calls', chat.id);
            
            // Exchange ICE candidates
            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    await updateDoc(callDocRef, {
                        [isCaller ? 'callerCandidates' : 'calleeCandidates']: arrayUnion(event.candidate.toJSON())
                    });
                }
            };
            
            // Caller logic
            if (isCaller) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                await setDoc(callDocRef, {
                    callerId: currentUser.uid,
                    calleeId: otherUser?.id,
                    status: 'calling',
                    offer: { sdp: offer.sdp, type: offer.type },
                    callerCandidates: [],
                    calleeCandidates: [],
                });
            }

            // Watch for call doc changes (answer, candidates, hang-up)
            callDocUnsubscribe = onSnapshot(callDocRef, async (snapshot) => {
                const data = snapshot.data() as Call;
                const pcInstance = peerConnection.current;

                if (!data || !pcInstance) return;

                // Callee gets offer and creates answer
                if (!isCaller && data.offer && !offerApplied.current) {
                    offerApplied.current = true;
                    await pcInstance.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await pcInstance.createAnswer();
                    await pcInstance.setLocalDescription(answer);
                    await updateDoc(callDocRef, {
                        answer: { sdp: answer.sdp, type: answer.type },
                        status: 'active'
                    });
                }
                
                // Caller gets answer
                if (isCaller && data.answer && !answerApplied.current) {
                     answerApplied.current = true;
                     await pcInstance.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
                
                // Add ICE candidates
                const candidatesField = isCaller ? 'calleeCandidates' : 'callerCandidates';
                if (data[candidatesField]) {
                    data[candidatesField]!.forEach(candidate => {
                        if (pcInstance?.remoteDescription) {
                          pcInstance?.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding ICE candidate", e));
                        }
                    });
                }

                if (data.status === 'ended') {
                    endCallLocally(false);
                }
            });

        } catch (error) {
            console.error("Error setting up call:", error);
            toast({ variant: 'destructive', title: t('microphone_error_title'), description: t('microphone_error_desc') });
            endCallLocally(true);
        }
    };
    
    setupCall();

    return () => {
        if (callDocUnsubscribe) callDocUnsubscribe();
        endCallLocally(true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, db, isCaller, chat.id, currentUser.uid, otherUser?.id, toast, t]);

  const handleHangUp = () => {
    endCallLocally(true);
  };
  
  const toggleMute = () => {
      if (!localStream.current) return;
      localStream.current.getAudioTracks().forEach(track => {
          track.enabled = !track.enabled;
          setIsMuted(!track.enabled);
      });
  }

  const handleVideoClick = () => {
      toast({ title: t('placeholder_title'), description: t('placeholder_description')});
  }
  
  const handleMinimize = () => {
    setIsMinimized(true);
  }

  const handleRestore = () => {
    setIsMinimized(false);
  }

  return (
    <>
        <Dialog open={open && !isMinimized}>
          <DialogContent 
            className="max-w-sm" 
            hideCloseButton
            onEscapeKeyDown={(e) => {
                e.preventDefault();
                handleMinimize();
            }}
            onPointerDownOutside={(e) => {
                e.preventDefault();
                handleMinimize();
            }}
          >
            <DialogHeader className="items-center text-center space-y-4">
              <UserAvatarWithStatus user={otherUser!} className="w-24 h-24 text-4xl" />
              <div className="space-y-1">
                <DialogTitle className="text-2xl">{otherUser?.name}</DialogTitle>
                <DialogDescription>
                  {callStatus === 'connecting' && t('connecting')}
                  {callStatus === 'connected' && formatDuration(duration)}
                  {callStatus === 'ended' && t('call_ended')}
                </DialogDescription>
              </div>
            </DialogHeader>

            <DialogFooter className="flex-row justify-center gap-4 pt-8">
                <Button variant={isMuted ? "default" : "secondary"} size="icon" className="w-16 h-16 rounded-full" onClick={toggleMute}>
                    {isMuted ? <MicOff /> : <Mic />}
                </Button>
                 <Button variant="secondary" size="icon" className="w-16 h-16 rounded-full" onClick={handleVideoClick}>
                    <VideoOff />
                </Button>
                <Button variant="destructive" size="icon" className="w-16 h-16 rounded-full" onClick={handleHangUp}>
                    <PhoneOff />
                </Button>
            </DialogFooter>
            <audio ref={remoteAudioRef} autoPlay playsInline />
          </DialogContent>
        </Dialog>
        {isMinimized && open && (
            <DraggableCallBubble onClick={handleRestore} />
        )}
    </>
  );
}
