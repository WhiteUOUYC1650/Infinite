'use client';

import { useLanguage } from '@/context/language-context';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Infinity as InfinityIcon } from 'lucide-react';

export default function GoodbyePage() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white text-center p-8">
      <div className="space-y-8 flex flex-col items-center">
        <InfinityIcon className="h-24 w-24 text-gray-500" />
        <div className="space-y-4">
          <h1 className="text-5xl font-bold font-headline">{t('goodbye_title')}</h1>
          <p className="text-lg text-gray-300">
            {t('goodbye_message')}
          </p>
        </div>
        <Link href="/signup">
          <Button variant="outline" className="bg-transparent text-gray-300 border-gray-600 hover:bg-gray-100 hover:text-black">
            {t('re_register_link')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
