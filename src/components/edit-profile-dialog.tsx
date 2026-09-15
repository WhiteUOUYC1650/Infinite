
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import type { AuthenticatedUser, SharedMusic } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/context/language-context';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Loader2, Pencil, Cake, ImageIcon, Music } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Nickname must be at least 2 characters.' }),
  statusMessage: z.string().max(120, { message: 'Status must be 120 characters or less.' }).optional(),
  avatar: z.string().optional(),
  bannerUrl: z.string().optional(),
  profileMusicId: z.string().optional(),
  birthday: z.object({
    day: z.string(),
    month: z.string(),
    year: z.string().optional(),
  }),
}).refine((data) => {
  const { day, month, year } = data.birthday;
  const isAnyFieldFilled = (day && day !== 'none') || (month && month !== 'none') || (!!year && year !== '');
  if (isAnyFieldFilled) return day !== 'none' && month !== 'none';
  return true;
}, {
  message: 'Day and month are required.',
  path: ['birthday.day'],
});

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight), mediaWidth, mediaHeight);
}

async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, crop.width, crop.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas is empty')); return; }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    }, 'image/jpeg');
  });
}

export function EditProfileDialog({ user, open, onOpenChange }: { user: AuthenticatedUser, open: boolean, onOpenChange: (o: boolean) => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null | undefined>(user.avatar);
  const [bannerPreview, setBannerPreview] = useState<string | null | undefined>(user.bannerUrl);
  const [imageToCrop, setImageToCrop] = useState('');
  const [cropTarget, setCropTarget] = useState<'avatar' | 'banner'>('avatar');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);

  const musicQuery = useMemo(() => db ? query(collection(db, 'music'), orderBy('timestamp', 'desc'), limit(50)) : null, [db]);
  const { data: musicTracks } = useCollection<SharedMusic>(musicQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      name: user.name || '',
      statusMessage: user.statusMessage || '',
      avatar: user.avatar || '',
      bannerUrl: user.bannerUrl || '',
      profileMusicId: user.profileMusicId || 'none',
      birthday: {
        day: user.birthday?.day?.toString() || 'none',
        month: user.birthday?.month?.toString() || 'none',
        year: user.birthday?.year?.toString() || '',
      },
    },
  });

  const watchMonth = useWatch({ control: form.control, name: 'birthday.month' });
  const watchYear = useWatch({ control: form.control, name: 'birthday.year' });
  const watchDay = useWatch({ control: form.control, name: 'birthday.day' });

  const daysInMonth = useMemo(() => {
    const month = parseInt(watchMonth);
    if (!month || isNaN(month)) return 31;
    if ([4, 6, 9, 11].includes(month)) return 30;
    if (month === 2) {
      const year = parseInt(watchYear || '0');
      if (year && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29;
      return 28;
    }
    return 31;
  }, [watchMonth, watchYear]);

  useEffect(() => {
    if (open) {
        form.reset({
            name: user.name || '',
            statusMessage: user.statusMessage || '',
            avatar: user.avatar || '',
            bannerUrl: user.bannerUrl || '',
            profileMusicId: user.profileMusicId || 'none',
            birthday: {
                day: user.birthday?.day?.toString() || 'none',
                month: user.birthday?.month?.toString() || 'none',
                year: user.birthday?.year?.toString() || '',
            },
        });
        setAvatarPreview(user.avatar);
        setBannerPreview(user.bannerUrl);
        setImageToCrop('');
    }
  }, [open, user, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, target: 'avatar' | 'banner') => {
    if (event.target.files?.[0]) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) { toast({ variant: 'destructive', title: 'Image too large' }); return; }
      setCropTarget(target);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageToCrop(reader.result?.toString() || ''));
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = async () => {
    if (!completedCrop || !imgRef.current) return;
    setIsCropping(true);
    try {
        const cropped = await getCroppedImg(imgRef.current, completedCrop);
        if (cropTarget === 'avatar') { setAvatarPreview(cropped); form.setValue('avatar', cropped); }
        else { setBannerPreview(cropped); form.setValue('bannerUrl', cropped); }
    } finally { setImageToCrop(''); setIsCropping(false); }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!db || !user.uid) return;
    const userRef = doc(db, 'users', user.uid);
    const updatedData: any = { 
        name: values.name, statusMessage: values.statusMessage, avatar: values.avatar, bannerUrl: values.bannerUrl, 
        profileMusicId: values.profileMusicId === 'none' ? null : values.profileMusicId,
        hasSetNickname: true, birthday: null 
    };
    if (values.birthday.day !== 'none' && values.birthday.month !== 'none') {
        updatedData.birthday = { day: parseInt(values.birthday.day), month: parseInt(values.birthday.month), year: values.birthday.year ? parseInt(values.birthday.year) : null };
    }
    setDoc(userRef, updatedData, { merge: true }).then(() => {
        toast({ title: t('dm_success'), description: t('profile_update_success') });
        onOpenChange(false);
    }).catch(async (e) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'update', requestResourceData: updatedData }));
    });
  };

  const monthNames = (t('months') || '').split(',');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='rounded-[2rem] p-0 overflow-hidden max-w-sm'>
        {imageToCrop ? (
            <div className="flex flex-col h-[80vh]">
                <DialogHeader className="p-6 border-b"><DialogTitle>Crop your {cropTarget}</DialogTitle></DialogHeader>
                <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                    <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={c => setCompletedCrop(c)} aspect={cropTarget === 'avatar' ? 1 : 21/9}>
                        <img ref={imgRef} src={imageToCrop} onLoad={e => setCrop(centerAspectCrop(e.currentTarget.width, e.currentTarget.height, cropTarget === 'avatar' ? 1 : 21/9))} className="max-h-full max-w-full" />
                    </ReactCrop>
                </div>
                <DialogFooter className="p-6 border-t gap-2"><Button variant="ghost" onClick={() => setImageToCrop('')}>Cancel</Button><Button onClick={handleCropConfirm} disabled={isCropping}>{isCropping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crop & Save</Button></DialogFooter>
            </div>
        ) : (
            <div className="flex flex-col h-[85vh]">
                <DialogHeader className="p-6 border-b shrink-0"><DialogTitle>{t('edit_profile')}</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-8 pb-10">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">{t('profile_banner_label')}</Label>
                                    <div className="relative aspect-[21/9] rounded-2xl overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/20 cursor-pointer group" onClick={() => bannerInputRef.current?.click()}>
                                        {bannerPreview ? <img src={bannerPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center gap-2"><ImageIcon className="h-6 w-6 opacity-30" /><p className="text-[10px] font-bold opacity-30">Tap to upload banner</p></div>}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Pencil className="text-white" /></div>
                                        <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'banner')} />
                                    </div>
                                </div>

                                <div className="flex justify-center relative">
                                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                        <Avatar className="h-24 w-24 border-4 border-background shadow-xl"><AvatarImage src={avatarPreview || undefined} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar>
                                        <div className="absolute bottom-0 right-0 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white border-2 border-background"><Pencil className="h-4 w-4" /></div>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'avatar')} />
                                    </div>
                                </div>

                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('nickname_label')}</FormLabel><FormControl><Input placeholder={t('nickname_placeholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="statusMessage" render={({ field }) => (<FormItem><FormLabel>{t('account_description_label')}</FormLabel><FormControl><Textarea placeholder={t('account_description_placeholder')} {...field} className="resize-none" /></FormControl><FormMessage /></FormItem>)} />

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-primary"><Cake className="h-4 w-4" /><Label className="font-bold">{t('birthday_label')}</Label></div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <FormField control={form.control} name="birthday.day" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 bg-muted/50 border-none"><SelectValue /></SelectTrigger></FormControl><SelectContent>{Array.from({length: daysInMonth}, (_,i) => <SelectItem key={i+1} value={(i+1).toString()}>{i+1}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                        <FormField control={form.control} name="birthday.month" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 bg-muted/50 border-none"><SelectValue /></SelectTrigger></FormControl><SelectContent>{monthNames.map((n, i) => <SelectItem key={i+1} value={(i+1).toString()}>{n}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                        <FormField control={form.control} name="birthday.year" render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder={t('year_label')} {...field} className="h-11 bg-muted/50 border-none" /></FormControl></FormItem>)} />
                                    </div>
                                </div>

                                <FormField control={form.control} name="profileMusicId" render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2 text-primary mb-2"><Music className="h-4 w-4" /><FormLabel className="font-bold">{t('profile_music_label')}</FormLabel></div>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-12 bg-muted/50 border-none rounded-xl font-bold"><SelectValue placeholder="Select vibe..." /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="none" className="font-bold opacity-50">{t('none_label')}</SelectItem>
                                                {musicTracks?.map(track => <SelectItem key={track.id} value={track.id} className="font-bold">{track.title} — {track.author}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </ScrollArea>
                        <DialogFooter className="p-6 border-t gap-2 shrink-0"><Button type="button" variant="ghost" className="rounded-xl flex-1" onClick={() => onOpenChange(false)}>{t('cancel')}</Button><Button type="submit" className="rounded-xl flex-[2] font-bold">{t('save')}</Button></DialogFooter>
                    </form>
                </Form>
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
