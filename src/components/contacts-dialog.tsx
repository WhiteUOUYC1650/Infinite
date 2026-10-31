'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Loader2, MessageCircle, Trash2, UserPlus, X } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Query,
} from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { formatPhoneNumber, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import type { AuthenticatedUser, Contact, User } from '@/types';

interface ContactsDialogProps {
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated?: (chatId: string) => void;
}

export function ContactsDialog({ currentUser, open, onOpenChange, onChatCreated }: ContactsDialogProps) {
  const db = useFirestore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const userId = currentUser.uid || currentUser.id || '';

  const [phoneInput, setPhoneInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);

  const contactsQuery = useMemo(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'users', userId, 'contacts'), orderBy('name')) as Query<Contact>;
  }, [db, userId]);
  const { data: contacts, loading } = useCollection<Contact>(contactsQuery);

  const handleAddContact = async () => {
    if (!db || !userId || isAdding) return;
    const normalized = normalizePhoneNumber(phoneInput);
    if (!isValidPhoneNumber(normalized)) {
      toast({ variant: 'destructive', title: t('phone_invalid') });
      return;
    }
    setIsAdding(true);
    try {
      const indexSnap = await getDoc(doc(db, 'phoneIndex', normalized));
      if (!indexSnap.exists()) {
        toast({ variant: 'destructive', title: t('contact_not_found') });
        return;
      }
      const contactUid = indexSnap.data().uid as string;
      if (contactUid === userId) {
        toast({ variant: 'destructive', title: t('contact_is_self') });
        return;
      }
      const userSnap = await getDoc(doc(db, 'users', contactUid));
      if (!userSnap.exists()) {
        toast({ variant: 'destructive', title: t('contact_not_found') });
        return;
      }
      const contactData = userSnap.data() as User;
      await setDoc(doc(db, 'users', userId, 'contacts', contactUid), {
        uid: contactUid,
        name: contactData.name || contactData.username || normalized,
        username: contactData.username || '',
        phoneNumber: normalized,
        createdAt: serverTimestamp(),
      });
      setPhoneInput('');
      toast({ title: t('contact_added') });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: t('contact_add_error') });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!db || !userId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'contacts', contactId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenChat = async (contact: Contact) => {
    if (!db || !userId || openingChatId) return;
    setOpeningChatId(contact.uid);
    try {
      const members = [userId, contact.uid].sort();
      const chatId = members.join('_');
      await runTransaction(db, async transaction => {
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await transaction.get(chatRef);
        if (chatSnap.exists()) return;
        transaction.set(chatRef, {
          type: 'dm',
          members,
          unreadCounts: members.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
        });
      });
      onOpenChange(false);
      onChatCreated?.(chatId);
    } catch (error) {
      console.error(error);
    } finally {
      setOpeningChatId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="flex flex-col max-h-[85vh] max-w-md p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
        <DialogHeader className="relative flex-row items-center justify-center p-4 border-b shrink-0 h-16">
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button>
          <DialogTitle>{t('contacts')}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2"><X /></Button>
        </DialogHeader>

        <div className="p-6 space-y-3 border-b">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
            {t('add_contact_by_phone')}
          </Label>
          <div className="flex gap-2">
            <Input
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              placeholder="+7 900 000-00-00"
              inputMode="tel"
              className="flex-1 h-12 rounded-2xl bg-muted/50 border-none font-bold"
            />
            <Button onClick={handleAddContact} disabled={isAdding} className="h-12 w-12 rounded-2xl p-0">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {loading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
            {!loading && !contacts?.length && (
              <p className="text-center text-xs font-bold uppercase text-muted-foreground py-16 opacity-60">{t('no_contacts')}</p>
            )}
            {contacts?.map(contact => (
              <div key={contact.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-muted/30">
                <div className="min-w-0">
                  <p className="font-bold truncate">{contact.name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium truncate">
                    {formatPhoneNumber(contact.phoneNumber)}{contact.username ? ` · ${contact.username}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => handleOpenChat(contact)} disabled={openingChatId === contact.uid}>
                    {openingChatId === contact.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4 text-primary" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-xl text-destructive hover:bg-destructive/10" onClick={() => handleDeleteContact(contact.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
