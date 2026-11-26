/**
 * Renders a download's print route to PDF with headless Chromium (Playwright). The worker keeps
 * one browser alive via `launchBrowser()` and passes it in; standalone calls launch their own.
 */
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { chromium, type Browser } from 'playwright';
import { encodePageFormat, pageSizeMm, type PageFormat } from '@/lib/print-sizes';

const BUNDLED_CHROMIUM = '/opt/pw-browsers/chromium';
const NAV_TIMEOUT_MS = 120_000;

export function launchBrowser(): Promise<Browser> {
  return chromium.launch(existsSync(BUNDLED_CHROMIUM) ? { executablePath: BUNDLED_CHROMIUM } : {});
}

export function printUrl(downloadId: string, format: PageFormat): string {
  const secret = process.env.RENDER_SECRET;
  if (!secret) throw new Error('RENDER_SECRET is not set');
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const query = new URLSearchParams({ format: encodePageFormat(format), key: secret });
  return `${base}/print/${encodeURIComponent(downloadId)}?${query}`;
}

export async function renderPdf(
  downloadId: string,
  format: PageFormat,
  outPath: string,
  opts: { browser?: Browser } = {},
): Promise<{ pages: number; bytes: number }> {
  const browser = opts.browser ?? (await launchBrowser());
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const res = await page.goto(printUrl(downloadId, format), { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    if (!res?.ok()) throw new Error(`print route returned ${res?.status() ?? 'no response'}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete
            ? null
            : new Promise((done) => {
                img.addEventListener('load', done);
                img.addEventListener('error', done);
              }),
        ),
      );
    });
    const { width, height } = pageSizeMm(format);
    const pdf = await page.pdf({
      width: `${width}mm`,
      height: `${height}mm`,
      printBackground: true,
      preferCSSPageSize: true,
    });
    await writeFile(outPath, pdf);
    const pages = (await PDFDocument.load(pdf)).getPageCount();
    return { pages, bytes: pdf.length };
  } finally {
    await context.close().catch(() => {});
    if (!opts.browser) await browser.close();
  }
}
