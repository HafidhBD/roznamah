/** Printed page formats: trim sizes and bleed in mm, and the `format` URL parameter codec. */
import { z } from 'zod';

export const pageFormatSchema = z
  .object({ kind: z.literal('wall'), size: z.enum(['A4', 'A3']), bleed: z.boolean() })
  .strict();
export type PageFormat = z.infer<typeof pageFormatSchema>;
export const DEFAULT_FORMAT: PageFormat = { kind: 'wall', size: 'A4', bleed: false };

/** Trim size in mm (portrait). */
export const PAGE_MM: Record<PageFormat['size'], { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
};
export const BLEED_MM = 3;

/** Outer page size in mm: the trim plus `bleed` on every side. */
export function pageSizeMm(f: PageFormat): { width: number; height: number; bleed: number } {
  const trim = PAGE_MM[f.size];
  const bleed = f.bleed ? BLEED_MM : 0;
  return { width: trim.w + 2 * bleed, height: trim.h + 2 * bleed, bleed };
}

export const encodePageFormat = (f: PageFormat) => Buffer.from(JSON.stringify(f)).toString('base64url');

/** Parses a base64url JSON PageFormat; null when missing or invalid. */
export function decodePageFormat(param: string | null | undefined): PageFormat | null {
  if (!param || !/^[A-Za-z0-9_-]+$/.test(param)) return null;
  try {
    const parsed = pageFormatSchema.safeParse(JSON.parse(Buffer.from(param, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
