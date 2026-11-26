import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Vibrant } from 'node-vibrant/node';

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_WIDTH = 2000;
/** Decompression-bomb guard: a 5 MB PNG can otherwise decode to gigabytes. */
const MAX_INPUT_PIXELS = 40_000_000;
const ACCEPTED = new Set(['png', 'jpeg', 'svg']);

export type LogoErrorCode = 'TOO_LARGE' | 'BAD_TYPE' | 'CORRUPT';
export class LogoError extends Error {
  constructor(readonly code: LogoErrorCode) {
    super(`logo rejected: ${code}`);
    this.name = 'LogoError';
  }
}

export type LogoFile = { bytes: Buffer; mime: string; name: string };
export type ProcessedLogo = { path: string; palette: string[] };

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || './var/uploads');

/** Absolute file path for a stored relative logo path, or null if it escapes UPLOAD_DIR or is malformed. */
export function resolveLogoPath(rel: string): string | null {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|webp)$/.test(rel)) return null;
  const root = uploadDir();
  const abs = path.resolve(root, rel);
  return abs.startsWith(root + path.sep) ? abs : null;
}

export async function readLogo(rel: string | null): Promise<{ bytes: Buffer; mime: string } | null> {
  const abs = rel ? resolveLogoPath(rel) : null;
  if (!abs) return null;
  try {
    const bytes = await readFile(abs);
    return { bytes, mime: abs.endsWith('.webp') ? 'image/webp' : 'image/png' };
  } catch {
    return null;
  }
}

export async function deleteLogo(rel: string | null | undefined): Promise<void> {
  const abs = rel ? resolveLogoPath(rel) : null;
  if (abs) await unlink(abs).catch(() => {});
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const looksLikeImage = (b: Buffer) =>
  b.subarray(0, 8).equals(PNG_SIG) || (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff);

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

async function extractPalette(png: Buffer): Promise<string[]> {
  const small = await sharp(png).resize(256, 256, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const palette = await Vibrant.from(small).getPalette();
  const swatches = Object.values(palette)
    .filter((s): s is NonNullable<typeof s> => !!s)
    .sort((a, b) => b.population - a.population);
  const out: string[] = [];
  for (const s of swatches) {
    const [r, g, b] = s.rgb;
    const hex = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    if (!out.includes(hex)) out.push(hex);
    if (out.length === 5) break;
  }
  return out;
}

/**
 * Validates an uploaded logo by its bytes (never the name or declared mime), re-encodes it to PNG
 * (SVG is rasterized, so no markup survives; raster metadata is stripped), stores it under
 * UPLOAD_DIR/<calendarId>/<uuid>.png and extracts up to 5 palette colors.
 */
export async function processLogo(
  file: LogoFile,
  opts: { calendarId: string; replaces?: string | null },
): Promise<ProcessedLogo> {
  if (file.bytes.length > MAX_LOGO_BYTES) throw new LogoError('TOO_LARGE');
  if (!/^[0-9a-f-]{36}$/.test(opts.calendarId)) throw new Error('invalid calendar id');

  let format: string | undefined;
  let width: number | undefined;
  try {
    const meta = await sharp(file.bytes, { limitInputPixels: false }).metadata();
    format = meta.format;
    width = meta.width;
  } catch {
    // Unreadable: a known image signature means a damaged file, anything else is the wrong type.
    throw new LogoError(looksLikeImage(file.bytes) ? 'CORRUPT' : 'BAD_TYPE');
  }
  if (!format || !ACCEPTED.has(format)) throw new LogoError('BAD_TYPE');

  let png: Buffer;
  try {
    const input =
      format === 'svg'
        ? // librsvg renders at 72 dpi by default; raise the density so the raster is crisp at 2000 px.
          sharp(file.bytes, {
            density: Math.min(2400, Math.max(72, (72 * MAX_LOGO_WIDTH) / Math.max(1, width ?? MAX_LOGO_WIDTH))),
            limitInputPixels: MAX_INPUT_PIXELS * 4,
          })
        : sharp(file.bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
    png = await input
      .rotate() // honor EXIF orientation before the metadata is dropped
      .resize({ width: MAX_LOGO_WIDTH, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (e) {
    if (e instanceof Error && /pixel limit/i.test(e.message)) throw new LogoError('TOO_LARGE');
    throw new LogoError('CORRUPT');
  }

  const palette = await extractPalette(png).catch(() => [] as string[]);

  const rel = `${opts.calendarId}/${randomUUID()}.png`;
  const abs = resolveLogoPath(rel)!;
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, png);
  if (opts.replaces && opts.replaces !== rel) await deleteLogo(opts.replaces);
  return { path: rel, palette };
}

/** data: URL of a stored logo, for embedding in snapshots (print never fetches the logo). */
export async function logoDataUrl(rel: string | null): Promise<string | null> {
  const logo = await readLogo(rel);
  return logo ? `data:${logo.mime};base64,${logo.bytes.toString('base64')}` : null;
}

/** Same-origin URL of the visitor's draft logo; the query only busts caches when the logo changes. */
export const logoUrlFor = (rel: string) => `/api/draft/logo?v=${rel.split('/')[1]?.split('.')[0] ?? ''}`;

/** Palette of an already stored logo (the studio shows it again after a reload). */
export async function storedPalette(rel: string | null): Promise<string[]> {
  const logo = await readLogo(rel);
  return logo ? extractPalette(logo.bytes).catch(() => []) : [];
}
