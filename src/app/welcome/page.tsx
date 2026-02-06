'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/language-context';
import { Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WelcomePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex min-h-screen flex-col items-center justify-center p-8 text-center transition-colors duration-500',
        step === 1 ? 'bg-[#FF8C00] text-white' : 'bg-[#FFAA00] text-gray-900'
      )}
    >
      {step === 1 ? (
        <div className="flex flex-col items-center space-y-8">
          <h1 className="text-5xl font-bold font-headline">{t('welcome_title')}</h1>
          <p className="text-xl">{t('welcome_subtitle')}</p>
          <Button
            onClick={() => setStep(2)}
            size="lg"
            className="bg-white text-[#FF8C00] hover:bg-white/90"
          >
            {t('continue_button')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-8">
          <Star className="h-16 w-16 text-white" />
          <h1 className="text-4xl font-bold font-headline">{t('thank_you_beta')}</h1>
          <p className="max-w-md text-lg">{t('welcome_message')}</p>
          <Button
            onClick={() => router.push('/')}
            size="lg"
            className="bg-gray-900 text-white hover:bg-gray-800"
          >
            {t('continue_button')}
          </Button>
        </div>
      )}

      <div className={cn(
        'absolute bottom-4 right-4',
        step === 1 ? 'text-white' : 'text-gray-900'
      )}>
        <Badge variant="outline" className="border-current text-current">{t('beta_badge')}</Badge>
      </div>
    </div>
  );
}
