'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ArrowLeft, X, UserPlus, Users, Trash2, MessageSquare, Phone, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import {
  collection, query, where, getDocs, limit, doc, updateDoc, runTransaction,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { useBatchUsers } from '@/hooks/use-batch-users';
import type { AuthenticatedUser, Contact } from '@/types';
import { formatPhoneNumber, isValidPhoneNumber, maskPhoneNumber, normalizePhoneNumber } from '@/lib/phone-utils';
import { VerifiedBadge } from './ui/verified-badge';

interface ContactsDialogProps {
  currentUser: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated?: (chatId: string) => void;
}

export function ContactsDialog({ currentUser, open, onOpenChange, onChatCreated }: ContactsDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [view, setView] = useState<'list' | 'add'>('list');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [startingChatId, setStartingChatId] = useState<string | null>(null);

  const userId = currentUser.uid || currentUser.id || '';
  const contacts = useMemo<Contact[]>(() => currentUser.contacts || [], [currentUser.contacts]);

  const linkedIds = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.userId).filter(Boolean) as string[])),
    [contacts]
  );
  const { users: linkedUsers } = useBatchUsers(linkedIds);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...contacts].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (!q) return sorted;
    return sorted.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [contacts, search]);

  const resetAddForm = () => { setName(''); setPhone(''); };

  const handleSaveContact = async () => {
    if (!db || !userId || saving) return;
    const normalized = normalizePhoneNumber(phone);
    if (!name.trim()) { toast({ variant: 'destructive', title: 'Error', description: t('contact_name') }); return; }
    if (!isValidPhoneNumber(normalized)) { toast({ variant: 'destructive', title: 'Error', description: t('invalid_phone') }); return; }
    if (contacts.some((c) => c.phone === normalized)) { toast({ variant: 'destructive', title: 'Error', description: t('contact_exists') }); return; }

    setSaving(true);
    try {
      // Try to link the contact to a registered Infinite user by phone number.
      let linkedUserId: string | null = null;
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('phone', '==', normalized), limit(1)));
        if (!snap.empty) linkedUserId = snap.docs[0].id;
      } catch { /* linking is best-effort */ }

      const newContact: Contact = {
        id: Math.random().toString(36).slice(2),
        name: name.trim(),
        phone: normalized,
        userId: linkedUserId,
        addedAt: Date.now(),
      };

      await updateDoc(doc(db, 'users', userId), { contacts: [...contacts, newContact] });
      toast({ title: t('dm_success'), description: t('contact_added') });
      resetAddForm();
      setView('list');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveContact = async (contact: Contact) => {
    if (!db || !userId) return;
    try {
      await updateDoc(doc(db, 'users', userId), { contacts: contacts.filter((c) => c.id !== contact.id) });
      toast({ title: t('dm_success'), description: t('contact_removed') });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleMessage = async (contact: Contact) => {
    if (!db || !userId || !contact.userId || startingChatId) return;
    const targetUserId = contact.userId;
    if (targetUserId === userId) return;
    setStartingChatId(contact.id);
    try {
      const members = [userId, targetUserId].sort();
      const chatId = members.join('_');
      await runTransaction(db, async (transaction) => {
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
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setStartingChatId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="flex flex-col max-h-[90vh] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl max-w-md">
        <DialogHeader className="relative flex-row items-center justify-center p-4 border-b shrink-0 h-16">
          {view === 'add' ? (
            <Button variant="ghost" size="icon" onClick={() => { setView('list'); resetAddForm(); }} className="absolute left-2 top-1/2 -translate-y-1/2"><ArrowLeft /></Button>
          ) : (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-10" />
          )}
          <DialogTitle className="font-black">{view === 'add' ? t('add_contact') : t('contacts')}</DialogTitle>
          <DialogDescription className="sr-only">{t('contacts_desc')}</DialogDescription>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-2 top-1/2 -translate-y-1/2"><X /></Button>
        </DialogHeader>

        {view === 'add' ? (
          <div className="p-6 space-y-5">
            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary"><UserPlus className="h-7 w-7" /></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-50">{t('contact_name')}</label>
              <Input autoFocus placeholder={t('contact_name_placeholder')} value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl font-bold" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-50">{t('phone_number_label')}</label>
              <Input type="tel" inputMode="tel" placeholder="+7 900 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-xl font-bold" />
            </div>
            <Button className="w-full h-14 rounded-2xl font-black text-base shadow-xl" disabled={saving} onClick={handleSaveContact}>
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {t('save_contact')}
            </Button>
          </div>
        ) : (
          <>
            <div className="p-4 pb-2 shrink-0 space-y-3">
              <Button className="w-full h-12 rounded-xl font-bold gap-2" onClick={() => setView('add')}><UserPlus className="h-4 w-4" /> {t('add_contact')}</Button>
              {contacts.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={t('search_contacts')} value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 rounded-xl pl-9 bg-muted/40 border-none font-medium" />
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 px-3 pb-4">
              {filteredContacts.length === 0 ? (
                <div className="py-16 text-center px-8">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="font-black uppercase tracking-widest text-xs mb-2">{t('no_contacts')}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('no_contacts_desc')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredContacts.map((contact) => {
                    const linked = contact.userId ? linkedUsers[contact.userId] : null;
                    const displayPhone = linked?.phoneHidden ? maskPhoneNumber(contact.phone) : formatPhoneNumber(contact.phone);
                    const isVerified = linked?.username === '@Infinite';
                    return (
                      <div key={contact.id} className="group flex items-center gap-3 p-2.5 rounded-2xl hover:bg-muted/50 transition-colors">
                        <Avatar className="h-11 w-11 shrink-0">
                          {linked?.avatar ? <AvatarImage src={linked.avatar} alt={contact.name} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold truncate">{contact.name}</p>
                            {isVerified && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{displayPhone}</span>
                            <span className={cn('shrink-0 font-bold', contact.userId ? 'text-primary' : 'opacity-50')}>
                              · {contact.userId ? t('contact_on_infinite') : t('contact_not_registered')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {contact.userId && contact.userId !== userId && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-primary" onClick={() => handleMessage(contact)} disabled={startingChatId === contact.id}>
                              {startingChatId === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                              <span className="sr-only">{t('message_contact')}</span>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10" onClick={() => handleRemoveContact(contact)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">{t('contact_removed')}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
