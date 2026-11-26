import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let dir: string;
let logo: typeof import('@/lib/logo');

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'rz-logo-'));
  process.env.UPLOAD_DIR = dir;
  logo = await import('@/lib/logo');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const CAL = '11111111-1111-4111-8111-111111111111';

async function code(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(logo.LogoError);
    return (e as InstanceType<typeof logo.LogoError>).code;
  }
  return 'resolved';
}

// ---- CIE76 ΔE (sRGB → XYZ D65 → Lab) ----
function toLab(hex: string): [number, number, number] {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const deltaE = (a: string, b: string) => {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

describe('processLogo', () => {
  it('rejects files over 5 MB with TOO_LARGE', async () => {
    const bytes = Buffer.alloc(6 * 1024 * 1024, 1);
    expect(await code(logo.processLogo({ bytes, mime: 'image/png', name: 'big.png' }, { calendarId: CAL }))).toBe('TOO_LARGE');
  });

  it('rejects a text file renamed .png with BAD_TYPE', async () => {
    const bytes = Buffer.from('hello, I am not an image\n'.repeat(20));
    expect(await code(logo.processLogo({ bytes, mime: 'image/png', name: 'fake.png' }, { calendarId: CAL }))).toBe('BAD_TYPE');
  });

  it('rejects a truncated PNG with CORRUPT', async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#123456' } }).png().toBuffer();
    const bytes = png.subarray(0, 60);
    expect(await code(logo.processLogo({ bytes, mime: 'image/png', name: 'cut.png' }, { calendarId: CAL }))).toBe('CORRUPT');
  });

  it('rasterizes an SVG with <script> into a PNG without any markup', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60">
      <script>alert(1)</script>
      <rect width="120" height="60" fill="#c0392b"/></svg>`;
    const out = await logo.processLogo({ bytes: Buffer.from(svg), mime: 'image/svg+xml', name: 'x.svg' }, { calendarId: CAL });
    expect(out.path).toMatch(new RegExp(`^${CAL}/[0-9a-f-]{36}\\.png$`));
    const stored = readFileSync(path.join(dir, out.path));
    expect(stored.includes('<script')).toBe(false);
    expect(stored.includes('<svg')).toBe(false);
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBeLessThanOrEqual(2000);
    expect(meta.width).toBeGreaterThanOrEqual(1000); // rasterized crisp, not at 120px
  });

  it('extracts a palette whose first color matches a solid #0a7f5a logo (ΔE < 10)', async () => {
    const bytes = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#0a7f5a' } })
      .png()
      .toBuffer();
    const out = await logo.processLogo({ bytes, mime: 'image/png', name: 'green.png' }, { calendarId: CAL });
    expect(out.palette.length).toBeGreaterThan(0);
    expect(out.palette.length).toBeLessThanOrEqual(5);
    for (const c of out.palette) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(deltaE(out.palette[0], '#0a7f5a')).toBeLessThan(10);
  });

  it('re-encodes a JPEG (stripping metadata) and deletes the replaced file', async () => {
    const jpg = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#336699' } })
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-exif' } } })
      .jpeg()
      .toBuffer();
    const first = await logo.processLogo({ bytes: jpg, mime: 'image/jpeg', name: 'a.jpg' }, { calendarId: CAL });
    const stored = readFileSync(path.join(dir, first.path));
    expect(stored.includes('secret-exif')).toBe(false);
    expect(['png', 'webp']).toContain((await sharp(stored).metadata()).format);

    const second = await logo.processLogo({ bytes: jpg, mime: 'image/jpeg', name: 'b.jpg' }, { calendarId: CAL, replaces: first.path });
    expect(second.path).not.toBe(first.path);
    expect(() => readFileSync(path.join(dir, first.path))).toThrow();
  });

  it('refuses to read or delete paths outside the upload dir', async () => {
    expect(logo.resolveLogoPath('../etc/passwd')).toBeNull();
    expect(logo.resolveLogoPath('/etc/passwd')).toBeNull();
    expect(logo.resolveLogoPath(`${CAL}/${CAL}.png`)).toBe(path.join(dir, CAL, `${CAL}.png`));
  });
});
