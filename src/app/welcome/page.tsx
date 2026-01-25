'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/language-context';
import { Loader2, Star } from 'lucide-react';

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
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {step === 1 && (
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-3xl font-bold font-headline">{t('welcome_title')}</CardTitle>
            <CardDescription>{t('welcome_subtitle')}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setStep(2)} size="lg">
              {t('continue_button')}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card className="w-full max-w-lg text-center">
           <CardHeader>
               <div className="flex justify-center items-center gap-3">
                   <Star className="h-8 w-8 text-yellow-500" />
                   <CardTitle className="text-3xl font-bold font-headline">{t('thank_you_beta')}</CardTitle>
                </div>
           </CardHeader>
           <CardContent>
                <p className="text-muted-foreground">{t('welcome_message')}</p>
           </CardContent>
           <CardFooter className="flex justify-center">
               <Button onClick={() => router.push('/')} size="lg">
                   {t('continue_button')}
               </Button>
           </CardFooter>
       </Card>
     )}

      <div className="absolute bottom-4 right-4">
        <Badge variant="outline">{t('beta_badge')}</Badge>
      </div>
    </div>
  );
}
