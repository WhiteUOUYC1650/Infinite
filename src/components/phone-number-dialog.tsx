'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Smartphone, Check, Pencil, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import type { AuthenticatedUser } from '@/types';
import {
  detectSimNumbers,
  formatPhoneNumber,
  isValidPhoneNumber,
  normalizePhoneNumber,
  type SimNumber,
} from '@/lib/phone-utils';

interface PhoneNumberDialogProps {
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhoneNumberDialog({ currentUser, open, onOpenChange }: PhoneNumberDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [scanning, setScanning] = useState(true);
  const [sims, setSims] = useState<SimNumber[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const userId = currentUser.uid || currentUser.id || '';

  useEffect(() => {
    if (!open) return;
    // Reset and scan for SIM numbers each time the dialog opens.
    setScanning(true);
    setSims([]);
    setSelected(null);
    setManual(currentUser.phone || '');
    setManualMode(false);

    let cancelled = false;
    detectSimNumbers().then((found) => {
      if (cancelled) return;
      setSims(found);
      if (found.length > 0) {
        setSelected(found[0].number);
        setManualMode(false);
      } else {
        setManualMode(true);
      }
      setScanning(false);
    });
    return () => { cancelled = true; };
  }, [open, currentUser.phone]);

  const chosenNumber = manualMode ? normalizePhoneNumber(manual) : selected;
  const canSave = !!chosenNumber && isValidPhoneNumber(chosenNumber);

  const handleSave = async () => {
    if (!db || !userId || !canSave || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), { phone: chosenNumber });
      toast({ title: t('dm_success'), description: t('phone_saved') });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] p-0 overflow-hidden max-w-sm">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-black leading-tight">{t('choose_your_number')}</DialogTitle>
              <DialogDescription className="text-[11px] leading-tight mt-0.5">{t('phone_number_desc')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {scanning ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('scanning_sims')}</p>
            </div>
          ) : (
            <>
              {sims.length > 0 && !manualMode && (
                <div className="space-y-2">
                  {sims.map((sim) => (
                    <button
                      key={`${sim.slot}-${sim.number}`}
                      type="button"
                      onClick={() => setSelected(sim.number)}
                      className={cn(
                        'w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all',
                        selected === sim.number
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent bg-muted/40 hover:bg-muted/70'
                      )}
                    >
                      <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center text-primary shrink-0 shadow-sm">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          {t('sim_slot', { slot: sim.slot })} · {sim.label}
                        </p>
                        <p className="font-bold truncate">{formatPhoneNumber(sim.number)}</p>
                      </div>
                      {selected === sim.number && <Check className="h-5 w-5 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {manualMode ? (
                <div className="space-y-3">
                  {sims.length === 0 && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/40 rounded-xl p-3">
                      {t('sim_not_available')}
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-50">{t('phone_number_label')}</label>
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoFocus
                      placeholder="+7 900 123 45 67"
                      value={manual}
                      onChange={(e) => setManual(e.target.value)}
                      className="h-12 rounded-xl font-bold"
                    />
                  </div>
                  {sims.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-10 rounded-xl text-xs font-bold text-primary"
                      onClick={() => { setManualMode(false); setSelected(sims[0].number); }}
                    >
                      {t('back_to_sim_numbers')}
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-11 rounded-xl text-xs font-bold text-primary gap-2"
                  onClick={() => setManualMode(true)}
                >
                  <Pencil className="h-4 w-4" />
                  {t('enter_number_manually')}
                </Button>
              )}

              <div className="flex items-start gap-2 text-[10px] text-muted-foreground leading-relaxed pt-1">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/70" />
                <span>{t('phone_privacy_hint')}</span>
              </div>

              <Button
                type="button"
                className="w-full h-14 rounded-2xl font-black text-base shadow-xl"
                disabled={!canSave || saving}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {t('add_phone_number')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
