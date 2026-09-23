'use client';

import { useState } from 'react';
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
import { KeyRound, Loader2 } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const auth = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    const user = auth?.currentUser;
    if (!user || !user.email || isSaving) return;
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: t('password_too_short') });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: t('passwords_do_not_match') });
      return;
    }
    setIsSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast({ title: t('password_changed') });
      reset();
      onOpenChange(false);
    } catch (error) {
      const code = (error as { code?: string }).code;
      const description =
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? t('current_password_wrong')
          : t('password_change_error');
      toast({ variant: 'destructive', title: 'Error', description });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => { onOpenChange(isOpen); if (!isOpen) reset(); }}>
      <DialogContent className="max-w-sm rounded-3xl border-none shadow-2xl p-8 space-y-6">
        <DialogHeader className="items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold font-headline">{t('change_password')}</DialogTitle>
          <DialogDescription>{t('change_password_desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              {t('current_password')}
            </Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="h-12 rounded-2xl bg-muted/50 border-none font-bold"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              {t('new_password')}
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="h-12 rounded-2xl bg-muted/50 border-none font-bold"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              {t('confirm_new_password')}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="h-12 rounded-2xl bg-muted/50 border-none font-bold"
              autoComplete="new-password"
            />
          </div>

          <Button
            className="w-full h-12 rounded-2xl font-bold"
            onClick={handleSubmit}
            disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
          </Button>
          <Button variant="ghost" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
