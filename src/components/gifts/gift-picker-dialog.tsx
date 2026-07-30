'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { useFirestore } from '@/firebase';
import { collection, doc, addDoc, serverTimestamp, increment, runTransaction } from 'firebase/firestore';
import { User, Gift as GiftType, AuthenticatedUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { InfGoldIcon } from '../ui/inf-gold-icon';
import { Loader2, Sparkles, X, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const GIFT_CONFIG = [
  { emoji: '🍦', price: 15 },
  { emoji: '🍕', price: 25 },
  { emoji: '🎁', price: 50 },
  { emoji: '🌟', price: 100 },
  { emoji: '💎', price: 500 },
  { emoji: '👑', price: 1000 },
];

export function GiftPickerDialog({ open, onOpenChange, recipient, currentUser }: { open: boolean, onOpenChange: (o: boolean) => void, recipient: User | null, currentUser: AuthenticatedUser | null }) {
  const { t } = useLanguage();
  const db = useFirestore();
  const { toast } = useToast();
  const [selectedGift, setSelectedGift] = useState<{emoji: string, price: number} | null>(null);
  const [giftMessage, setGiftMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!db || !selectedGift || isSending || !currentUser?.uid || !recipient?.id) return;
    setIsSending(true);
    try {
        await runTransaction(db, async (tx) => {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists()) throw new Error("User missing");
            const balance = userSnap.data().infGoldBalance || 0;
            if (balance < selectedGift.price) throw new Error(t('not_enough_gold'));

            const recipientGiftRef = doc(collection(db, 'users', recipient.id, 'receivedGifts'));
            tx.update(userRef, { infGoldBalance: increment(-selectedGift.price) });
            tx.set(recipientGiftRef, {
                emoji: selectedGift.emoji,
                price: selectedGift.price,
                senderId: currentUser.uid,
                senderName: currentUser.name || currentUser.username || 'User',
                timestamp: serverTimestamp(),
                message: giftMessage.trim() || null,
            });
        });
        toast({ title: t('dm_success'), description: t('gift_sent') });
        onOpenChange(false);
        setGiftMessage('');
        setSelectedGift(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsSending(false);
    }
  };

  const isSelf = recipient?.id === currentUser?.uid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-[2rem] p-6 border-none shadow-2xl">
        <DialogHeader className="items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-600 mb-2">
            <Sparkles className="h-8 w-8" />
          </div>
          <DialogTitle className="text-xl font-bold font-headline">{t('send_gift')}</DialogTitle>
          <DialogDescription>
            {t('send_gift_desc_label' as any) || 'Choose a gift for'} {isSelf ? (t('yourself_label' as any) || 'yourself') : (recipient?.name || 'User')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-6">
          {GIFT_CONFIG.map(gift => (
            <button
              key={gift.emoji}
              onClick={() => setSelectedGift(gift)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95",
                selectedGift?.emoji === gift.emoji 
                  ? "border-primary bg-primary/5 shadow-md" 
                  : "border-border/50 hover:border-primary/20 hover:bg-muted/50"
              )}
            >
              <span className="text-3xl">{gift.emoji}</span>
              <div className="flex items-center gap-1 text-[10px] font-black text-primary">
                  <InfGoldIcon className="h-3 w-3" />
                  {gift.price}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 px-1">
                <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('gift_message_label')}</Label>
            </div>
            <Input 
                value={giftMessage} 
                onChange={e => setGiftMessage(e.target.value)} 
                placeholder={t('gift_message_placeholder')}
                className="h-12 rounded-xl bg-muted/50 border-none focus-visible:ring-primary font-medium"
            />
        </div>

        <DialogFooter className="flex-col gap-2">
          <Button 
            onClick={handleSend} 
            disabled={!selectedGift || isSending} 
            className="w-full h-14 rounded-2xl font-bold text-lg shadow-xl"
          >
            {isSending ? <Loader2 className="animate-spin" /> : t('send_button')}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-12 rounded-xl text-muted-foreground">
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}