/**
 * Material 3 (Material You) palette generator for the Material 3 edition.
 *
 * The app lets the user pick an accent colour ("seed") — orange, purple, blue…
 * In the Material 3 build that seed is expanded into a full set of Material 3
 * *color roles* (surface / surface-container-*, primary, primary-container,
 * on-surface-variant, outline…) instead of being used verbatim, which is what
 * makes the interface read as Material You rather than "classic + rounded
 * corners".
 *
 * Only `src/context/theme-context.tsx` uses this module, and only when the
 * Material 3 edition is active (`NEXT_PUBLIC_INFINITE_EDITION=material3`), so
 * the classic 1.5 and Material 2 builds are not affected in any way.
 *
 * The tone mapping is a pragmatic approximation of the official
 * Material Color Utilities algorithm (it works in HSL rather than CAM16/HCT so
 * it can run in a few microseconds on the UI thread).
 */

export type M3ColorRoles = Record<string, string>;

type Hsl = { h: number; s: number; l: number };

const DEFAULT_SEED: Hsl = { h: 25, s: 95, l: 53 };

/** Parses the `"25 95% 53%"` HSL triplets used by the theme context. */
export function parseHsl(value: string | undefined | null): Hsl {
  if (!value) return DEFAULT_SEED;
  const match = String(value)
    .trim()
    .match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) return DEFAULT_SEED;
  return {
    h: Number(match[1]) || 0,
    s: Number(match[2]) || 0,
    l: Number(match[3]) || 0,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value * 10) / 10;

const wrapHue = (h: number) => ((h % 360) + 360) % 360;

/** Builds an HSL triplet in the same `"h s% l%"` format the app uses. */
function tone(h: number, s: number, l: number): string {
  return `${round(wrapHue(h))} ${round(clamp(s, 0, 100))}% ${round(clamp(l, 0, 100))}%`;
}


/**
 * Generates every Material 3 color role plus the app's legacy semantic
 * variables (--background, --card, --primary…), so shared screens written
 * against the classic tokens automatically pick up the Material 3 palette.
 */
export function createM3Palette(seedPrimary: string | undefined | null, dark: boolean): M3ColorRoles {
  const seed = parseHsl(seedPrimary);
  const seedSat = clamp(seed.s, 18, 100);
  /** Surfaces are "neutral": they only hint at the seed hue. */
  const neutralHue = seed.h;

  const roles: M3ColorRoles = dark
    ? {
        primary: tone(seed.h, clamp(seedSat * 0.75, 45, 80), 80),
        'on-primary': tone(seed.h, clamp(seedSat * 0.5, 30, 60), 18),
        'primary-container': tone(seed.h, clamp(seedSat * 0.6, 35, 70), 27),
        'on-primary-container': tone(seed.h, clamp(seedSat, 55, 100), 92),
        secondary: tone(neutralHue, 14, 84),
        'on-secondary': tone(neutralHue, 14, 18),
        'secondary-container': tone(neutralHue, 22, 26),
        'on-secondary-container': tone(neutralHue, 18, 92),
        tertiary: tone(seed.h + 150, 34, 82),
        'on-tertiary': tone(seed.h + 150, 30, 18),
        'tertiary-container': tone(seed.h + 150, 30, 28),
        'on-tertiary-container': tone(seed.h + 150, 34, 92),
        error: tone(0, 70, 80),
        'on-error': tone(0, 60, 18),
        'error-container': tone(0, 55, 30),
        'on-error-container': tone(0, 90, 92),
        surface: tone(neutralHue, 12, 8),
        'surface-dim': tone(neutralHue, 12, 6),
        'surface-bright': tone(neutralHue, 12, 26),
        'surface-container-lowest': tone(neutralHue, 14, 5),
        'surface-container-low': tone(neutralHue, 12, 10),
        'surface-container': tone(neutralHue, 12, 12),
        'surface-container-high': tone(neutralHue, 12, 16),
        'surface-container-highest': tone(neutralHue, 12, 21),
        'on-surface': tone(neutralHue, 16, 93),
        'on-surface-variant': tone(neutralHue, 10, 76),
        outline: tone(neutralHue, 8, 58),
        'outline-variant': tone(neutralHue, 10, 28),
        'inverse-surface': tone(neutralHue, 20, 90),
        'inverse-on-surface': tone(neutralHue, 12, 18),
        'inverse-primary': tone(seed.h, clamp(seedSat, 50, 85), 42),
        scrim: '0 0% 0%',
      }
    : {
        primary: tone(seed.h, clamp(seedSat, 45, 92), 42),
        'on-primary': tone(seed.h, 100, 100),
        'primary-container': tone(seed.h, clamp(seedSat, 60, 100), 90),
        'on-primary-container': tone(seed.h, clamp(seedSat * 0.7, 40, 70), 20),
        secondary: tone(neutralHue, 12, 38),
        'on-secondary': '0 0% 100%',
        'secondary-container': tone(neutralHue, 26, 90),
        'on-secondary-container': tone(neutralHue, 18, 22),
        tertiary: tone(seed.h + 150, 30, 36),
        'on-tertiary': '0 0% 100%',
        'tertiary-container': tone(seed.h + 150, 34, 88),
        'on-tertiary-container': tone(seed.h + 150, 30, 20),
        error: tone(0, 72, 44),
        'on-error': '0 0% 100%',
        'error-container': tone(0, 100, 92),
        'on-error-container': tone(0, 62, 22),
        surface: tone(neutralHue, 42, 98),
        'surface-dim': tone(neutralHue, 20, 87),
        'surface-bright': tone(neutralHue, 42, 99),
        'surface-container-lowest': tone(neutralHue, 30, 100),
        'surface-container-low': tone(neutralHue, 40, 96),
        'surface-container': tone(neutralHue, 36, 94),
        'surface-container-high': tone(neutralHue, 32, 92),
        'surface-container-highest': tone(neutralHue, 28, 90),
        'on-surface': tone(neutralHue, 16, 11),
        'on-surface-variant': tone(neutralHue, 12, 36),
        outline: tone(neutralHue, 10, 50),
        'outline-variant': tone(neutralHue, 18, 87),
        'inverse-surface': tone(neutralHue, 12, 20),
        'inverse-on-surface': tone(neutralHue, 30, 95),
        'inverse-primary': tone(seed.h, clamp(seedSat, 45, 80), 80),
        scrim: '0 0% 0%',
      };

  const tokenName = (role: string) => `--md-sys-color-${role}`;

  // Expose the raw Material 3 roles…
  const palette: M3ColorRoles = {};
  for (const [role, value] of Object.entries(roles)) {
    palette[tokenName(role)] = value;
  }

  // …and map them onto the legacy semantic variables the shared screens use,
  // so that chat / settings / dialogs follow Material 3 without being rewritten.
  const onSurface = roles['on-surface'];
  const onSurfaceVariant = roles['on-surface-variant'];
  const semantic: M3ColorRoles = {
    '--background': roles.surface,
    '--foreground': onSurface,
    '--card': dark ? roles['surface-container-high'] : roles['surface-container-lowest'],
    '--card-foreground': onSurface,
    '--popover': dark ? roles['surface-container'] : roles['surface-container-low'],
    '--popover-foreground': onSurface,
    '--primary': roles.primary,
    '--primary-foreground': roles['on-primary'],
    '--secondary': roles['secondary-container'],
    '--secondary-foreground': roles['on-secondary-container'],
    '--muted': roles['surface-container-high'],
    '--muted-foreground': onSurfaceVariant,
    '--accent': roles['primary-container'],
    '--accent-foreground': roles['on-primary-container'],
    '--destructive': roles.error,
    '--destructive-foreground': roles['on-error'],
    '--border': roles['outline-variant'],
    '--input': roles['outline-variant'],
    '--ring': roles.primary,
    '--sidebar-background': roles['surface-container-low'],
    '--sidebar-foreground': onSurface,
    '--sidebar-primary': roles.primary,
    '--sidebar-primary-foreground': roles['on-primary'],
    '--sidebar-accent': roles['secondary-container'],
    '--sidebar-accent-foreground': roles['on-secondary-container'],
    '--sidebar-border': roles['outline-variant'],
    '--sidebar-ring': roles.primary,
  };

  return { ...palette, ...semantic };
}

/** Applies the palette to a root element (`<html>`) as CSS custom properties. */
export function applyM3Palette(
  root: HTMLElement,
  seedPrimary: string | undefined | null,
  dark: boolean
): void {
  const palette = createM3Palette(seedPrimary, dark);
  for (const [property, value] of Object.entries(palette)) {
    root.style.setProperty(property, value);
  }
}
