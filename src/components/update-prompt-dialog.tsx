'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useLanguage } from "@/context/language-context";
import { Sparkles, Clock, Download, Loader2, X } from "lucide-react";
import { Button } from "./ui/button";

interface UpdatePromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isUpdateAvailable?: boolean;
    onUpdate?: () => void;
    isDownloading?: boolean;
    targetVersion?: string;
}

export function UpdatePromptDialog({ open, onOpenChange, isUpdateAvailable = false, onUpdate, isDownloading = false, targetVersion }: UpdatePromptDialogProps) {
    const { t } = useLanguage();
    
    const title = isUpdateAvailable ? t('update_available_title') : t('update_required_title');
    const description = isUpdateAvailable 
        ? (targetVersion ? t('update_available_status', { version: targetVersion }) : t('update_available_description'))
        : t('update_required_description');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-3xl border-none shadow-2xl overflow-hidden outline-none z-[1000]">
                <DialogHeader className="items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        {isUpdateAvailable ? (
                            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                        ) : (
                            <Clock className="h-8 w-8 text-primary" />
                        )}
                    </div>
                    <div className="space-y-2">
                        <DialogTitle className="text-2xl font-bold font-headline">{title}</DialogTitle>
                        <DialogDescription className="text-muted-foreground leading-relaxed font-bold">
                            {description}
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <DialogFooter className="sm:justify-center pt-4 flex flex-col gap-2">
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
