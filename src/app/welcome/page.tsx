'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/language-context';
import { Loader2, Star, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WelcomePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(1); // 1: Intro, 2: Final

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

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
            <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20 text-center">
                <p className="text-sm opacity-90">{t('welcome_message')}</p>
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
          <div className="flex flex-col items-center space-y-8 animate-in zoom-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 animate-ping bg-white/20 rounded-full scale-150" />
                <Rocket className="h-20 w-20 text-white relative z-10 fill-white" />
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
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'relative flex min-h-svh flex-col items-center justify-center p-8 text-center transition-colors duration-700 overflow-hidden',
        step === 2 ? 'bg-[#FFAA00] text-gray-900' : 'bg-[#FF8C00] text-white'
      )}
    >
      <div className="w-full flex-1 flex flex-col items-center justify-center max-w-4xl py-[env(safe-area-inset-top)]">
        {renderContent()}
      </div>

      <div className={cn(
        'absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] transition-colors duration-700',
        step === 2 ? 'text-gray-900' : 'text-white'
      )}>
        <Badge variant="outline" className="border-current text-current font-bold">{t('beta_badge')}</Badge>
      </div>
    </div>
  );
}
