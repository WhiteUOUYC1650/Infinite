export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return '+' + digits.slice(1).replace(/\D/g, '');
  const onlyDigits = digits.replace(/\D/g, '');
  if (!onlyDigits) return '';
  if (onlyDigits.length === 11 && onlyDigits.startsWith('8')) return '+7' + onlyDigits.slice(1);
  return '+' + onlyDigits;
}

export function isValidPhoneNumber(raw: string): boolean {
  const normalized = normalizePhoneNumber(raw);
  return /^\+\d{7,15}$/.test(normalized);
}

export function formatPhoneNumber(raw: string): string {
  const normalized = normalizePhoneNumber(raw);
  if (!normalized) return '';
  const digits = normalized.slice(1);
  if (digits.length < 10) return normalized;
  const country = digits.slice(0, digits.length - 10);
  const rest = digits.slice(-10);
  return `+${country} ${rest.slice(0, 3)} ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8)}`.trim();
}

export function maskPhoneNumber(raw: string): string {
  const normalized = normalizePhoneNumber(raw);
  if (normalized.length < 5) return normalized;
  return normalized.slice(0, 3) + '•'.repeat(normalized.length - 5) + normalized.slice(-2);
}
