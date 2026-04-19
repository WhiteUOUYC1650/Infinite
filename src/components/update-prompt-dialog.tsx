'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLanguage } from "@/context/language-context";
import { Sparkles, Clock, Download, Loader2, X } from "lucide-react";
import { Button } from "./ui/button";

interface UpdatePromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isUpdateAvailable?: boolean;
    onUpdate?: () => void;
    isDownloading?: boolean;
}

export function UpdatePromptDialog({ open, onOpenChange, isUpdateAvailable = false, onUpdate, isDownloading = false }: UpdatePromptDialogProps) {
    const { t } = useLanguage();
    
    const title = isUpdateAvailable ? t('update_available_title') : t('update_required_title');
    const description = isUpdateAvailable ? t('update_available_description') : t('update_required_description');

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="rounded-3xl border-none shadow-2xl overflow-hidden">
                <button 
                  onClick={() => onOpenChange(false)}
                  className="absolute right-4 top-4 rounded-full p-2 hover:bg-muted transition-colors opacity-70"
                >
                  <X className="h-5 w-5" />
                </button>
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
                <AlertDialogFooter className="sm:justify-center pt-4 flex-col gap-2">
                    <Button onClick={onUpdate} disabled={isDownloading} className="w-full h-12 rounded-xl font-bold gap-2">
                        {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {t('update_infinite')}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => onOpenChange(false)} 
                      className="w-full h-12 rounded-xl font-medium border-none hover:bg-muted text-muted-foreground"
                    >
                        {t('cancel')}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}