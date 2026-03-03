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
import { Sparkles, Clock } from "lucide-react";

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
            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader className="items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        {isUpdateAvailable ? (
                            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                        ) : (
                            <Clock className="h-8 w-8 text-primary" />
                        )}
                    </div>
                    <div className="space-y-2">
                        <AlertDialogTitle className="text-2xl font-bold font-headline">{title}</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground leading-relaxed">
                            {description}
                        </AlertDialogDescription>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="sm:justify-center pt-2">
                    <AlertDialogAction onClick={() => onOpenChange(false)} className="rounded-xl px-8 h-12 font-bold min-w-[140px]">
                        {t('ok')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
