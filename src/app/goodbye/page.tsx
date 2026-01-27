'use client';

import { useLanguage } from '@/context/language-context';
import Link from 'next/link';

export default function GoodbyePage() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white text-center p-8">
      <div className="space-y-4">
        <h1 className="text-5xl font-bold font-headline">{t('goodbye_title')}</h1>
        <p className="text-lg text-gray-300">
          {t('goodbye_message')}
        </p>
        <Link href="/signup" className="text-sm text-gray-400 hover:underline">
          {t('re_register_link')}
        </Link>
      </div>
    </div>
  );
}
