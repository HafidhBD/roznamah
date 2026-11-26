import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { calendars } from '@/db/schema';
import { defaultDesign } from '@/lib/design';
import { listEventViews } from '@/lib/draft';
import { logoDataUrl } from '@/lib/logo';
import { assembleSnapshot, type CalendarSnapshot } from '@/lib/snapshot-core';

export type { CalendarSnapshot, SnapshotEvent, SnapshotMonth } from '@/lib/snapshot-core';

/** A calendar's logo path, only if it lives in that calendar's own upload folder. */
export const ownLogoPath = (calendarId: string, logoPath: string | null | undefined) =>
  logoPath && logoPath.startsWith(`${calendarId}/`) ? logoPath : null;

/** Freezes a calendar (design, 12-month grid, events, embedded logo) for rendering. */
export async function buildSnapshot(calendarId: string): Promise<CalendarSnapshot> {
  const [row] = await db.select().from(calendars).where(eq(calendars.id, calendarId));
  if (!row) throw new Error(`calendar ${calendarId} not found`);
  const design = { ...defaultDesign, ...row.design };
  const views = await listEventViews(row, 'ar');
  const logo = await logoDataUrl(ownLogoPath(row.id, design.logoPath));
  return assembleSnapshot(design, row.startMonth, views, logo);
}
