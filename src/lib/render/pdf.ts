/**
 * Renders a download's print route to PDF with headless Chromium (Playwright). The worker keeps
 * one browser alive via `launchBrowser()` and passes it in; standalone calls launch their own.
 */
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { encodePageFormat, pageSizeMm, type PageFormat } from '@/lib/print-sizes';

const BUNDLED_CHROMIUM = '/opt/pw-browsers/chromium';
const NAV_TIMEOUT_MS = 60_000;
const ASSETS_TIMEOUT_MS = 30_000;
const PDF_TIMEOUT_MS = 120_000;

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

/** page.pdf() takes no timeout of its own; closing the context in `finally` aborts it. */
function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export async function renderPdf(
  downloadId: string,
  format: PageFormat,
  outPath: string,
  opts: { browser?: Browser } = {},
): Promise<{ pages: number; bytes: number }> {
  const browser = opts.browser ?? (await launchBrowser());
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    const res = await page.goto(printUrl(downloadId, format), { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    if (!res?.ok()) throw new Error(`print route returned ${res?.status() ?? 'no response'}`);
    // Fonts and images settled; bounded so a stalled asset fails the job instead of hanging the worker.
    await page.waitForFunction(
      () =>
        document.fonts.status === 'loaded' &&
        Array.from(document.images).every((img) => img.complete),
      undefined,
      { timeout: ASSETS_TIMEOUT_MS, polling: 100 },
    );
    const { width, height } = pageSizeMm(format);
    const pdf = await withTimeout(
      page.pdf({ width: `${width}mm`, height: `${height}mm`, printBackground: true, preferCSSPageSize: true }),
      PDF_TIMEOUT_MS,
      'page.pdf',
    );
    await writeFile(outPath, pdf);
    const pages = (await PDFDocument.load(pdf)).getPageCount();
    return { pages, bytes: pdf.length };
  } finally {
    await context?.close().catch(() => {});
    if (!opts.browser) await browser.close().catch(() => {});
  }
}
