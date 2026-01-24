'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/language-context';
import { Loader2, Star } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WelcomePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const { t } = useLanguage();

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
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="flex justify-center items-center gap-2">
            <CardTitle className="text-3xl font-bold font-headline">{t('welcome_title')}</CardTitle>
          </div>
          <CardDescription>{t('welcome_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-yellow-400 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 text-left">
            <Star className="h-4 w-4 !text-yellow-500 dark:!text-yellow-600" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
              {t('welcome_message')}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={() => router.push('/')} size="lg">
            {t('continue_button')}
          </Button>
        </CardFooter>
      </Card>
      <div className="absolute bottom-4 right-4">
        <Badge variant="outline">{t('beta_badge')}</Badge>
      </div>
    </div>
  );
}
