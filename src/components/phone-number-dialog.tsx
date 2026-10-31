'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Smartphone, Trash2 } from 'lucide-react';
import { doc, deleteDoc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatPhoneNumber, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import { isSimDetectionSupported, readSimNumbers, type SimNumber } from '@/lib/sim-numbers';
import type { AuthenticatedUser, UserPhone } from '@/types';

interface PhoneNumberDialogProps {
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhoneNumberDialog({ currentUser, open, onOpenChange }: PhoneNumberDialogProps) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const userId = currentUser.uid || currentUser.id || '';

  const [existingPhone, setExistingPhone] = useState<UserPhone | null>(null);
  const [simNumbers, setSimNumbers] = useState<SimNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  const [hidden, setHidden] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const scanSimNumbers = async () => {
    if (!isSimDetectionSupported()) return;
    setIsScanning(true);
    try {
      const numbers = await readSimNumbers();
      setSimNumbers(numbers);
      if (numbers.length > 0) setSelectedNumber(normalizePhoneNumber(numbers[0].number));
    } catch (error) {
      console.warn('SIM number detection failed', error);
      setSimNumbers([]);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (!open || !db || !userId) return;
    setManualNumber('');
    getDoc(doc(db, 'userPhones', userId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as UserPhone;
        setExistingPhone(data);
        setSelectedNumber(data.phoneNumber);
        setHidden(!!data.hidden);
      } else {
        setExistingPhone(null);
        setSelectedNumber('');
        setHidden(false);
      }
    }).catch(error => console.warn('Failed to load phone number', error));
    scanSimNumbers();
  }, [open, db, userId]);

  const finalNumber = useMemo(
    () => normalizePhoneNumber(manualNumber || selectedNumber),
    [manualNumber, selectedNumber]
  );

  const handleSave = async () => {
    if (!db || !userId || isSaving) return;
    if (!isValidPhoneNumber(finalNumber)) {
      toast({ variant: 'destructive', title: t('phone_invalid') });
      return;
    }
    setIsSaving(true);
    try {
      const indexRef = doc(db, 'phoneIndex', finalNumber);
      const indexSnap = await getDoc(indexRef);
      if (indexSnap.exists() && indexSnap.data().uid !== userId) {
        toast({ variant: 'destructive', title: t('phone_taken') });
        return;
      }
      if (existingPhone && existingPhone.phoneNumber !== finalNumber) {
        await deleteDoc(doc(db, 'phoneIndex', existingPhone.phoneNumber));
      }
      await setDoc(indexRef, { uid: userId, phoneNumber: finalNumber });
      await setDoc(doc(db, 'userPhones', userId), {
        uid: userId,
        phoneNumber: finalNumber,
        hidden,
        updatedAt: serverTimestamp(),
      });
      toast({ title: t('dm_success'), description: formatPhoneNumber(finalNumber) });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: t('phone_save_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!db || !userId || !existingPhone || isRemoving) return;
    setIsRemoving(true);
    try {
      await deleteDoc(doc(db, 'phoneIndex', existingPhone.phoneNumber));
      await deleteDoc(doc(db, 'userPhones', userId));
      setExistingPhone(null);
      setSelectedNumber('');
      toast({ title: t('phone_removed') });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: t('phone_save_error') });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border-none shadow-2xl p-8 space-y-6">
        <DialogHeader className="items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold font-headline">
            {existingPhone ? t('change_phone_number') : t('add_phone_number')}
          </DialogTitle>
          <DialogDescription>{t('choose_your_phone_number')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isScanning && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('phone_scanning_sim')}
            </div>
          )}

          {simNumbers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {t('phone_sim_numbers')}
              </Label>
              {simNumbers.map(sim => {
                const normalized = normalizePhoneNumber(sim.number);
                const isActive = !manualNumber && normalized === selectedNumber;
                return (
                  <button
                    key={`${sim.slot}-${normalized}`}
                    type="button"
                    onClick={() => { setManualNumber(''); setSelectedNumber(normalized); }}
                    className={cn(
                      'w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-colors',
                      isActive ? 'border-primary bg-primary/10' : 'border-transparent bg-muted/40 hover:bg-muted'
                    )}
                  >
                    <div>
                      <p className="font-bold">{formatPhoneNumber(sim.number)}</p>
                      <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                        SIM {sim.slot + 1}{sim.carrier ? ` · ${sim.carrier}` : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!isScanning && simNumbers.length === 0 && (
            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              {isSimDetectionSupported() ? t('phone_no_sim_numbers') : t('phone_manual_only')}
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              {t('phone_manual_label')}
            </Label>
            <Input
              value={manualNumber}
              onChange={e => setManualNumber(e.target.value)}
              placeholder="+7 900 000-00-00"
              inputMode="tel"
              className="h-12 rounded-2xl bg-muted/50 border-none font-bold"
            />
          </div>

          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-muted/30">
            <div className="flex-1">
              <Label htmlFor="phone-hidden" className="font-bold cursor-pointer">{t('phone_hidden_label')}</Label>
              <p className="text-[10px] text-muted-foreground leading-tight mt-1">{t('phone_hidden_desc')}</p>
            </div>
            <Switch id="phone-hidden" checked={hidden} onCheckedChange={setHidden} className="mt-1" />
          </div>

          <Button
            className="w-full h-12 rounded-2xl font-bold"
            onClick={handleSave}
            disabled={isSaving || !isValidPhoneNumber(finalNumber)}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
          </Button>

          {isSimDetectionSupported() && (
            <Button variant="ghost" className="w-full rounded-xl font-bold" onClick={scanSimNumbers} disabled={isScanning}>
              {t('phone_rescan_sim')}
            </Button>
          )}

          {existingPhone && (
            <Button
              variant="ghost"
              className="w-full rounded-xl text-destructive hover:bg-destructive/10 font-bold"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="mr-2 h-4 w-4" /> {t('phone_remove')}</>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
