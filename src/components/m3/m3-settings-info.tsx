'use client';

/**
 * Material 3 settings pages: Data & storage, About.
 */

import React, { useEffect, useState } from 'react';
import { Check, FileText, Gauge, HardDrive, Info, ShieldCheck, Trash2, Palette } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { useUpdatePrompt } from '@/context/update-prompt-context';
import { useTheme } from '@/context/theme-context';
import { useToast } from '@/hooks/use-toast';
import { calculateCacheSize, clearCacheDB, enforceCacheLimit, getCacheLimitBytes, setCacheLimitBytes } from '@/lib/cache-utils';
import { LegalDialog } from '@/components/legal-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { M3FilledButton } from './m3-primitives';
import { M3RowItem } from './m3-surfaces';

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Cache limit presets: 1 MB … 100 GB, plus "unlimited" (0). */
const CACHE_LIMIT_PRESETS_MB = [1, 5, 10, 25, 50, 100, 250, 500, 1024, 2048, 5120, 10240, 25600, 51200, 102400];

export function M3StoragePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [size, setSize] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [limit, setLimit] = useState<number>(() => getCacheLimitBytes());
  const [limitOpen, setLimitOpen] = useState(false);

  const refresh = async () => {
    try {
      setSize(await calculateCacheSize());
    } catch (e) {
      console.error(e);
      setSize(0);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const applyLimit = async (bytes: number) => {
    setCacheLimitBytes(bytes);
    setLimit(bytes);
    setLimitOpen(false);
    await enforceCacheLimit();
    await refresh();
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearCacheDB();
      await refresh();
      toast({ title: t('clear_cache'), description: t('cache_cleared_success') });
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-3 px-2">
      <div className="flex items-center gap-4 rounded-[1.5rem] bg-m3-surface-container-low p-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-m3-primary-container text-m3-on-primary-container">
          <HardDrive className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] uppercase tracking-[0.08em] text-m3-on-surface-variant">
            {t('cache_usage')}
          </p>
          <p className="text-2xl font-medium text-m3-on-surface">
            {size === null ? '…' : formatBytes(size)}
          </p>
        </div>
      </div>

      <M3RowItem
        plain
        icon={Gauge}
        label={t('cache_limit_label')}
        description={t('cache_limit_desc')}
        value={
          <span className="text-sm text-m3-on-surface-variant">
            {limit ? formatBytes(limit) : t('cache_limit_unlimited')}
          </span>
        }
        onClick={() => setLimitOpen(true)}
      />

      <p className="px-4 text-[12.5px] leading-relaxed text-m3-on-surface-variant">
        {t('clear_cache_desc')}
      </p>

      <M3FilledButton
        variant="tonal"
        icon={Trash2}
        className="w-full"
        disabled={clearing}
        onClick={handleClear}
      >
        {t('clear_cache')}
      </M3FilledButton>

      <Sheet open={limitOpen} onOpenChange={setLimitOpen}>
        <SheetContent
          side="bottom"
          hideCloseButton
          className="border-0 bg-m3-surface-container-high px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2"
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-m3-on-surface-variant/40" />
          <SheetHeader className="px-4 pb-1 text-left">
            <SheetTitle className="text-base font-medium text-m3-on-surface">
              {t('cache_limit_label')}
            </SheetTitle>
          </SheetHeader>
          <div className="no-scrollbar max-h-[60vh] overflow-y-auto">
            <M3RowItem
              plain
              label={t('cache_limit_unlimited')}
              description={t('cache_limit_unlimited_desc')}
              right={limit === 0 ? <Check className="h-4 w-4 text-m3-primary" /> : undefined}
              onClick={() => void applyLimit(0)}
            />
            {CACHE_LIMIT_PRESETS_MB.map((mb) => (
              <M3RowItem
                key={mb}
                plain
                label={formatBytes(mb * 1024 * 1024)}
                right={
                  limit === mb * 1024 * 1024 ? (
                    <Check className="h-4 w-4 text-m3-primary" />
                  ) : undefined
                }
                onClick={() => void applyLimit(mb * 1024 * 1024)}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function M3AboutPage({ onOpenAllSettings }: { onOpenAllSettings: () => void }) {
  const { t } = useLanguage();
  const { currentVersion } = useUpdatePrompt();
  const { material3Design, material2Design } = useTheme();
  const [legal, setLegal] = useState<'tos' | 'privacy' | null>(null);

  const edition = material3Design
    ? t('edition_material3')
    : material2Design
      ? t('edition_material2')
      : t('edition_classic');

  return (
    <div className="space-y-3 px-2">
      <div className="flex flex-col items-center gap-2 rounded-[1.5rem] bg-m3-surface-container-low px-5 py-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-m3-primary-container text-m3-on-primary-container">
          <Info className="h-8 w-8" />
        </span>
        <p className="text-lg font-medium text-m3-on-surface">Infinite {currentVersion}</p>
        <p className="text-[13px] text-m3-on-surface-variant">Redesign</p>
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-m3-secondary-container px-3 py-1 text-[11px] font-medium text-m3-on-secondary-container">
          <Palette className="h-3.5 w-3.5" />
          {t('edition_label')}: {edition}
        </span>
      </div>

      <div className="rounded-[1.5rem] bg-m3-surface-container-low py-1">
        <M3RowItem
          plain
          icon={FileText}
          label={t('terms_of_service')}
          onClick={() => setLegal('tos')}
        />
        <M3RowItem
          plain
          icon={ShieldCheck}
          label={t('privacy_policy')}
          onClick={() => setLegal('privacy')}
        />
        <M3RowItem
          plain
          icon={Info}
          label={t('all_settings')}
          onClick={onOpenAllSettings}
        />
      </div>

      <p className="px-4 pt-2 text-center text-[11px] text-m3-on-surface-variant">
        Infinite 3.0 · Redesign
      </p>

      <LegalDialog open={!!legal} onOpenChange={(open) => !open && setLegal(null)} type={legal || 'tos'} />
    </div>
  );
}
