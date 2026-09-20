import { Capacitor } from '@capacitor/core';

export type SimNumber = {
  slot: number;
  label: string; // Carrier / SIM label, e.g. "SIM 1" or "MegaFon"
  number: string; // Normalized E.164 number
};

/**
 * Attempts to read the phone numbers stored on the device's SIM cards.
 *
 * Reading SIM numbers is only possible inside the native (Capacitor/Android)
 * container and only when a companion native plugin exposing the numbers is
 * available AND the phone-number permission has been granted. On the web
 * preview (or when the permission is denied) this resolves to an empty list,
 * and the UI falls back to manual entry.
 */
export async function detectSimNumbers(): Promise<SimNumber[]> {
  try {
    if (!Capacitor.isNativePlatform()) return [];

    const plugins: any =
      (Capacitor as any).Plugins ||
      (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins) ||
      {};

    // Support a few likely plugin names so the app works with whichever
    // native bridge is bundled into the Android build.
    const plugin = plugins.SimNumbers || plugins.PhoneNumbers || plugins.PhoneNumber || plugins.Sim;
    if (!plugin?.getNumbers && !plugin?.getSimNumbers) return [];

    // Ask for the READ_PHONE_NUMBERS permission if the plugin supports it.
    if (typeof plugin.requestPermissions === 'function') {
      try { await plugin.requestPermissions(); } catch { /* denied → fall through */ }
    }

    const getter = plugin.getNumbers || plugin.getSimNumbers;
    const res = await getter.call(plugin);
    const list: any[] = res?.numbers || res?.simCards || res?.sims || (Array.isArray(res) ? res : []);

    return list
      .map((n: any, i: number) => ({
        slot: typeof n.slot === 'number' ? n.slot : i + 1,
        label: n.carrierName || n.displayName || n.label || `SIM ${i + 1}`,
        number: normalizePhoneNumber(n.number || n.phoneNumber || n.line1Number || ''),
      }))
      .filter((n) => !!n.number);
  } catch {
    return [];
  }
}

/** Strips formatting characters, keeping a leading + and digits only. */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return '';
  return (hasPlus ? '+' : '') + digits;
}

/** Loose validity check for an international phone number. */
export function isValidPhoneNumber(raw: string): boolean {
  const normalized = normalizePhoneNumber(raw);
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Formats a number for display, e.g. "+7 900 123 45 67".
 * Falls back to the raw normalized value when the pattern is unknown.
 */
export function formatPhoneNumber(raw: string): string {
  const normalized = normalizePhoneNumber(raw);
  if (!normalized) return '';
  const hasPlus = normalized.startsWith('+');
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 10) return normalized;

  // Group as country code + 3-3-2-2 (works well for RU/most 11-digit numbers).
  const country = digits.slice(0, digits.length - 10);
  const rest = digits.slice(digits.length - 10);
  const groups = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean);
  const prefix = country ? `${hasPlus ? '+' : ''}${country} ` : hasPlus ? '+' : '';
  return `${prefix}${groups.join(' ')}`.trim();
}

/** Masks a number for private display: "+7 ··· ·· 67". */
export function maskPhoneNumber(raw: string): string {
  const normalized = normalizePhoneNumber(raw);
  if (!normalized) return '';
  const hasPlus = normalized.startsWith('+');
  const digits = normalized.replace(/\D/g, '');
  if (digits.length <= 4) return `${hasPlus ? '+' : ''}${'·'.repeat(digits.length)}`;
  const country = digits.slice(0, Math.max(0, digits.length - 10)) || digits.slice(0, 1);
  const last2 = digits.slice(-2);
  return `${hasPlus ? '+' : ''}${country} ··· ·· ${last2}`;
}
