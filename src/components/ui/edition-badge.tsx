'use client';

import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/language-context';
import { APP_EDITION } from '@/context/theme-context';

/**
 * Version badge that tells the user which edition of Infinite is installed.
 * The value is baked in at build time (see .github/workflows/main.yml).
 */
export function EditionBadge({ className }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <Badge variant="outline" className={className}>
      {APP_EDITION === 'material3'
        ? t('beta_badge')
        : APP_EDITION === 'material2'
          ? t('beta_badge_m2')
          : t('beta_badge_classic')}
    </Badge>
  );
}
