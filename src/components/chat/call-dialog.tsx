'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import type { PopulatedChat, AuthenticatedUser, User, Call } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UserAvatarWithStatus } from './user-avatar-with-status';
import { useLanguage } from '@/context/language-context';

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

  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);

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

    // Delay closing the dialog to show "Call Ended"
    setTimeout(() => {
        onOpenChange(false);
    }, 1500);
  };

  useEffect(() => {
    if (!open || !db) return;

    setCallStatus('connecting');

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

                if (!data || !peerConnection.current) return;

                // Callee gets offer and creates answer
                if (!isCaller && data.offer && peerConnection.current.signalingState === 'stable') {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await peerConnection.current.createAnswer();
                    await peerConnection.current.setLocalDescription(answer);
                    await updateDoc(callDocRef, {
                        answer: { sdp: answer.sdp, type: answer.type },
                        status: 'active'
                    });
                }
                
                // Caller gets answer
                if (isCaller && data.answer && peerConnection.current.signalingState === 'have-local-offer') {
                     await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
                
                // Add ICE candidates
                const candidatesField = isCaller ? 'calleeCandidates' : 'callerCandidates';
                if (data[candidatesField]) {
                    data[candidatesField]!.forEach(candidate => {
                        if (peerConnection.current?.remoteDescription) {
                          peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding ICE candidate", e));
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleHangUp() }}>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader className="items-center text-center space-y-4">
          <UserAvatarWithStatus user={otherUser!} className="w-24 h-24 text-4xl" />
          <div className="space-y-1">
            <DialogTitle className="text-2xl">{otherUser?.name}</DialogTitle>
            <DialogDescription>
              {callStatus === 'connecting' && t('connecting')}
              {callStatus === 'connected' && '00:00'}
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
  );
}
