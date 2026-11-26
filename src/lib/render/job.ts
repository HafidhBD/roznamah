/**
 * The `render-download` job: renders every requested format of a download to
 * FILES_DIR/<id>/roznamah-wall-<size>[-bleed].pdf and records the file list.
 */
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { and, eq, ne } from 'drizzle-orm';
import type { Browser } from 'playwright';
import { db } from '@/db/client';
import { downloads, type DownloadFile } from '@/db/schema';
import { downloadDir, fileName } from '@/lib/downloads';
import { renderPdf } from '@/lib/render/pdf';

export type Attempt = { retryCount: number; retryLimit: number };

/**
 * Throws on failure so pg-boss retries. Only the last attempt marks the download `failed`;
 * earlier ones put it back to `queued` so the download page keeps showing "preparing".
 * A download already `ready` or `failed` (e.g. its email bounced) is skipped.
 */
export async function processDownload(downloadId: string, browser: Browser, attempt: Attempt): Promise<void> {
  const [row] = await db
    .select({ id: downloads.id, status: downloads.status, formats: downloads.formats })
    .from(downloads)
    .where(eq(downloads.id, downloadId));
  if (!row) return console.warn(`[worker] download ${downloadId} not found; skipping`);
  if (row.status === 'ready' || row.status === 'failed') {
    return console.info(`[worker] download ${downloadId} is ${row.status}; skipping`);
  }

  const notFailed = and(eq(downloads.id, downloadId), ne(downloads.status, 'failed'));
  await db.update(downloads).set({ status: 'rendering', error: null }).where(notFailed);
  const dir = downloadDir(downloadId);
  try {
    await mkdir(dir, { recursive: true });
    const files: DownloadFile[] = [];
    for (const format of row.formats) {
      const name = fileName(format);
      const out = path.join(dir, name);
      const part = `${out}.part`;
      const started = Date.now();
      try {
        await renderPdf(downloadId, format, part, { browser });
        await rename(part, out);
      } finally {
        await rm(part, { force: true });
      }
      files.push({ name, size: (await stat(out)).size });
      console.info(`[worker] ${downloadId} ${name} in ${Date.now() - started} ms`);
    }
    await db.update(downloads).set({ status: 'ready', files, error: null }).where(notFailed);
  } catch (err) {
    const final = attempt.retryCount >= attempt.retryLimit;
    const error = err instanceof Error ? err.message : String(err);
    await db
      .update(downloads)
      .set({ status: final ? 'failed' : 'queued', error: error.slice(0, 2000) })
      .where(notFailed);
    if (final) await rm(dir, { recursive: true, force: true });
    throw err;
  }
}
