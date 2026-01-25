'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLanguage } from "@/context/language-context";

interface UpdatePromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isUpdateAvailable?: boolean;
}

export function UpdatePromptDialog({ open, onOpenChange, isUpdateAvailable = false }: UpdatePromptDialogProps) {
    const { t } = useLanguage();
    
    const title = isUpdateAvailable ? t('update_available_title') : t('update_required_title');
    const description = isUpdateAvailable ? t('update_available_description') : t('update_required_description');

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>{title}</AlertDialogTitle>
                <AlertDialogDescription>
                    {description}
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogAction onClick={() => onOpenChange(false)}>{t('ok')}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
