/**
 * Calendar fonts, bundled from @fontsource as local files so print rendering never touches the
 * network. Weights: 400 (body), 500 (labels), 700 (headings).
 */
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/500.css';
import '@fontsource/cairo/700.css';
import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/500.css';
import '@fontsource/readex-pro/700.css';
import '@fontsource/noto-kufi-arabic/400.css';
import '@fontsource/noto-kufi-arabic/500.css';
import '@fontsource/noto-kufi-arabic/700.css';
import type { FontKey } from '@/lib/design';

const FALLBACK = "'IBM Plex Sans Arabic', 'Noto Kufi Arabic', sans-serif";

export const FONT_FAMILY: Record<FontKey, string> = {
  plex: `'IBM Plex Sans Arabic', ${FALLBACK}`,
  tajawal: `'Tajawal', ${FALLBACK}`,
  cairo: `'Cairo', ${FALLBACK}`,
  readex: `'Readex Pro', ${FALLBACK}`,
  kufi: `'Noto Kufi Arabic', ${FALLBACK}`,
};

/** The formal heading face of the official template, whatever body font is chosen. */
export const KUFI = FONT_FAMILY.kufi;
