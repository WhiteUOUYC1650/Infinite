
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/language-context';
import { Loader2, Star, ShieldCheck, ScrollText, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function WelcomePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(1); // 1: Intro, 2: Terms, 3: Privacy, 4: Thanks
  
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);
  const [hasScrolledPrivacy, setHasScrolledPrivacy] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  
  const termsRef = useRef<HTMLDivElement>(null);
  const privacyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const handleScroll = (ref: React.RefObject<HTMLDivElement>, setScrolled: (val: boolean) => void) => {
    if (!ref.current) return;
    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    // Check if scrolled to bottom (within 20px)
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      setScrolled(true);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const renderContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-500">
            <h1 className="text-5xl font-bold font-headline">{t('welcome_title')}</h1>
            <p className="text-xl max-w-lg">{t('welcome_subtitle')}</p>
            <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20 text-left">
                <h3 className="font-bold flex items-center gap-2 mb-2"><ShieldCheck className="h-5 w-5" /> {t('welcome_legal_title')}</h3>
                <p className="text-sm opacity-90">{t('welcome_legal_subtitle')}</p>
            </div>
            <Button
              onClick={() => setStep(2)}
              size="lg"
              className="bg-white text-[#FF8C00] hover:bg-white/90 font-bold px-12 h-14 rounded-2xl"
            >
              {t('continue_button')}
            </Button>
          </div>
        );
      case 2:
        return (
          <div className="flex flex-col items-center space-y-6 w-full max-w-md animate-in slide-in-from-right duration-500">
            <ScrollText className="h-12 w-12" />
            <h2 className="text-3xl font-bold font-headline">{t('terms_of_use')}</h2>
            <div 
                ref={termsRef}
                onScroll={() => handleScroll(termsRef, setHasScrolledTerms)}
                className="w-full h-64 bg-white/10 rounded-2xl p-6 overflow-y-auto border border-white/20 text-left text-sm whitespace-pre-wrap"
            >
                {t('legal_terms_content')}
                <p className="pt-10 text-center font-bold text-white/50 italic">--- End of Terms ---</p>
            </div>
            {!hasScrolledTerms && <p className="text-xs animate-bounce text-white/70">{t('scroll_to_bottom_hint')}</p>}
            <Button
              disabled={!hasScrolledTerms}
              onClick={() => setStep(3)}
              size="lg"
              className="bg-white text-[#FF8C00] hover:bg-white/90 font-bold w-full h-14 rounded-2xl"
            >
              {t('continue_button')}
            </Button>
          </div>
        );
      case 3:
        return (
          <div className="flex flex-col items-center space-y-6 w-full max-w-md animate-in slide-in-from-right duration-500">
            <ShieldCheck className="h-12 w-12" />
            <h2 className="text-3xl font-bold font-headline">{t('privacy_policy')}</h2>
            <div 
                ref={privacyRef}
                onScroll={() => handleScroll(privacyRef, setHasScrolledPrivacy)}
                className="w-full h-64 bg-white/10 rounded-2xl p-6 overflow-y-auto border border-white/20 text-left text-sm whitespace-pre-wrap"
            >
                {t('legal_privacy_content')}
                <p className="pt-10 text-center font-bold text-white/50 italic">--- End of Policy ---</p>
            </div>
            
            <div className="flex items-center space-x-3 bg-white/5 p-4 rounded-xl w-full border border-white/10">
                <Checkbox 
                    id="agree" 
                    checked={isAgreed} 
                    onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
                    disabled={!hasScrolledPrivacy}
                    className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#FF8C00]"
                />
                <Label htmlFor="agree" className="text-sm font-medium leading-none cursor-pointer">
                    {t('i_agree_legal')}
                </Label>
            </div>

            <Button
              disabled={!isAgreed}
              onClick={() => setStep(4)}
              size="lg"
              className="bg-white text-[#FF8C00] hover:bg-white/90 font-bold w-full h-14 rounded-2xl"
            >
              {t('continue_button')}
            </Button>
          </div>
        );
      case 4:
        return (
          <div className="flex flex-col items-center space-y-8 animate-in zoom-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 animate-ping bg-white/20 rounded-full scale-150" />
                <Star className="h-20 w-20 text-white relative z-10 fill-white" />
            </div>
            <h1 className="text-4xl font-bold font-headline">{t('thank_you_beta')}</h1>
            <p className="max-w-md text-lg opacity-90">{t('welcome_message')}</p>
            <Button
              onClick={() => router.push('/')}
              size="lg"
              className="bg-gray-900 text-white hover:bg-gray-800 font-bold px-12 h-14 rounded-2xl shadow-xl"
            >
              {t('continue_button')}
            </Button>
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        'relative flex min-h-svh flex-col items-center justify-center p-8 text-center transition-colors duration-700 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] pl-[calc(2rem+env(safe-area-inset-left))] pr-[calc(2rem+env(safe-area-inset-right))]',
        step === 4 ? 'bg-[#FFAA00] text-gray-900' : 'bg-[#FF8C00] text-white'
      )}
    >
      {renderContent()}

      <div className={cn(
        'absolute bottom-4 right-4 transition-colors duration-700',
        step === 4 ? 'text-gray-900' : 'text-white'
      )}>
        <Badge variant="outline" className="border-current text-current font-bold">{t('beta_badge')}</Badge>
      </div>
    </div>
  );
}
