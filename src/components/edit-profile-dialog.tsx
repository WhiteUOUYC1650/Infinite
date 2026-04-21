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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import React, { useRef, useState, useEffect } from 'react';
import { useLanguage } from '@/context/language-context';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Loader2, Pencil, Cake } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
  birthday: z.object({
    day: z.string().min(1),
    month: z.string().min(1),
    year: z.string().optional(),
  }).optional(),
});

interface EditProfileDialogProps {
  user: AuthenticatedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper to center the crop
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

// Helper to get the cropped image data URL
async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop
): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const pixelRatio = window.devicePixelRatio;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result as string));
      reader.addEventListener('error', (error) => reject(error));
      reader.readAsDataURL(blob);
    }, 'image/jpeg');
  });
}


export function EditProfileDialog({ user, open, onOpenChange }: EditProfileDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null | undefined>(user.avatar);
  const [imageToCrop, setImageToCrop] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user.name || '',
      statusMessage: user.statusMessage || '',
      avatar: user.avatar || '',
      birthday: user.birthday ? {
        day: user.birthday.day.toString(),
        month: user.birthday.month.toString(),
        year: user.birthday.year?.toString() || '',
      } : undefined,
    },
  });

  // Reset form and preview when dialog opens/closes or user changes
  useEffect(() => {
    if (open) {
        form.reset({
            name: user.name || '',
            statusMessage: user.statusMessage || '',
            avatar: user.avatar || '',
            birthday: user.birthday ? {
                day: user.birthday.day.toString(),
                month: user.birthday.month.toString(),
                year: user.birthday.year?.toString() || '',
            } : undefined,
        });
        setAvatarPreview(user.avatar);
        setImageToCrop(''); // Also reset cropper state
    }
  }, [open, user, form]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
            variant: 'destructive',
            title: 'Image too large',
            description: 'Please select an image smaller than 2MB.',
        });
        return;
      }
      setCrop(undefined) // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImageToCrop(reader.result?.toString() || ''),
      )
      reader.readAsDataURL(file)
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1 / 1));
  }

  const handleCropConfirm = async () => {
    if (!completedCrop || !imgRef.current) {
        toast({ variant: 'destructive', title: 'Crop Error', description: 'Could not process the crop.' });
        return;
    }
    setIsCropping(true);
    try {
        const croppedImageUrl = await getCroppedImg(imgRef.current, completedCrop);
        setAvatarPreview(croppedImageUrl);
        form.setValue('avatar', croppedImageUrl, { shouldValidate: true });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Crop Error', description: 'An error occurred while cropping.' });
    } finally {
        setImageToCrop('');
        setIsCropping(false);
    }
  };


  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!db || !user) return;

    const userRef = doc(db, 'users', user.uid);
    const updatedData: { [key: string]: any } = {
        name: values.name,
        statusMessage: values.statusMessage,
        hasSetNickname: true,
        avatar: values.avatar,
    };

    if (values.birthday?.day && values.birthday?.month) {
        updatedData.birthday = {
            day: parseInt(values.birthday.day),
            month: parseInt(values.birthday.month),
            year: values.birthday.year ? parseInt(values.birthday.year) : null,
        };
    }

    setDoc(userRef, updatedData, { merge: true })
        .then(() => {
            toast({ title: t('dm_success'), description: t('profile_update_success') });
            onOpenChange(false);
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: updatedData,
            });
            errorEmitter.emit('permission-error', permissionError);
      });
  };

  const monthNames = (t('months') || '').split(',');

  const dialogContent = imageToCrop ? (
    <>
        <DialogHeader>
            <DialogTitle>Crop your new avatar</DialogTitle>
            <DialogDescription>Adjust the selection to crop your image. It will be a 1:1 square.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
            <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                minWidth={100}
                minHeight={100}
            >
                <img
                    ref={imgRef}
                    alt="Crop me"
                    src={imageToCrop}
                    onLoad={onImageLoad}
                    style={{ maxHeight: '60vh' }}
                />
            </ReactCrop>
        </div>
        <DialogFooter>
            <Button variant="ghost" onClick={() => setImageToCrop('')}>Cancel</Button>
            <Button onClick={handleCropConfirm} disabled={isCropping}>
                {isCropping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crop & Save
            </Button>
        </DialogFooter>
    </>
  ) : (
    <>
        <DialogHeader>
          <DialogTitle>{t('edit_profile')}</DialogTitle>
          <DialogDescription>
            {t('edit_profile_desc')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
             {/* Avatar uploader */}
            <div className="flex justify-center">
              <div className="relative">
                <button type="button" onClick={handleAvatarClick} className="rounded-full">
                  <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-lg">
                    <AvatarImage src={avatarPreview || undefined} />
                    <AvatarFallback className='bg-muted text-foreground'>{user.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </button>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-background"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/png, image/jpeg, image/gif"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                </FormControl>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('nickname_label')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('nickname_placeholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="statusMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('account_description_label')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('account_description_placeholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                    <Cake className="h-4 w-4" />
                    <Label className="font-bold">{t('birthday_label')}</Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <FormField
                        control={form.control}
                        name="birthday.day"
                        render={({ field }) => (
                            <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/50 border-none">
                                            <SelectValue placeholder={t('day')} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {Array.from({ length: 31 }, (_, i) => (
                                            <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="birthday.month"
                        render={({ field }) => (
                            <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/50 border-none">
                                            <SelectValue placeholder={t('month_label')} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {monthNames.map((name, i) => (
                                            <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="birthday.year"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        placeholder={t('year_label')} 
                                        {...field} 
                                        className="h-11 rounded-xl bg-muted/50 border-none"
                                        min="1900"
                                        max={new Date().getFullYear()}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className='rounded-xl'>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting} className='rounded-xl font-bold'>
                {form.formState.isSubmitting ? <><Loader2 className='mr-2 h-4 w-4 animate-spin' /> {t('saving')}</> : t('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='rounded-[1.5rem]'>
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}
