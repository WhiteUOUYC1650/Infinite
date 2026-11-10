/**
 * System information utilities for detecting Android version,
 * reduced motion preference, and color scheme preference.
 * 
 * These are used theming and UI behavior adjustments across different
 * Infinite editions (classic, Material 2, Material 3).
 */

/** Detects the Android version from the user agent string. */
export function getAndroidVersion(): number | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  const match = ua.match(/(?:Android\s([\d.]+))/i);
  return match ? parseFloat(match[1]) : null;
}

/** Checks if the user has reduced motion preference enabled. */
export const useReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  const [reducedMotion, setReducedMotion] = React.useState(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  React.useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = () => setReducedMotion(media.matches);
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  }, []);
  return reducedMotion;
};

/** Checks if the system color scheme is dark. */
export const useSystemColorScheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  const [scheme, setScheme] = React.useState<'light' | 'dark'>('light');
  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setScheme(media.matches ? 'dark' : 'light');
    const listener = () => setScheme(media.matches ? 'dark' : 'light');
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  }, []);
  return scheme;
};