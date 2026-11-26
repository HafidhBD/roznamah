import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { downloads } from '@/db/schema';
import type { CalendarSnapshot } from '@/lib/snapshot-core';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The snapshot frozen on a download row (never the live draft). */
export async function downloadSnapshot(downloadId: string): Promise<CalendarSnapshot | null> {
  if (!UUID.test(downloadId)) return null;
  const [row] = await db
    .select({ snapshot: downloads.snapshot })
    .from(downloads)
    .where(eq(downloads.id, downloadId));
  return row?.snapshot ?? null;
}
