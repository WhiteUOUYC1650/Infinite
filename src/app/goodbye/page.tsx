'use client';

import { useLanguage } from '@/context/language-context';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Infinity as InfinityIcon, Languages, Sun, Moon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/context/theme-context';

export default function GoodbyePage() {
  const { language, setLanguage, t } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-8 relative">
       <div className="absolute top-4 right-4 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Languages className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={language} onValueChange={(value) => setLanguage(value as 'en' | 'ru')}>
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="ru">Русский</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDarkMode ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      <div className="space-y-8 flex flex-col items-center">
        <InfinityIcon className="h-24 w-24 text-muted-foreground" />
        <div className="space-y-4">
          <h1 className="text-5xl font-bold font-headline">{t('goodbye_title')}</h1>
          <p className="text-lg text-muted-foreground">
            {t('goodbye_message')}
          </p>
        </div>
        <Link href="/signup">
          <Button variant="outline">
            {t('re_register_link')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
