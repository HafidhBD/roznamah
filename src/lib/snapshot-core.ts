/**
 * The frozen data a calendar document renders from. Pure (no DB, no Node APIs) so the studio can
 * assemble a live preview in the browser from the same code the print route uses.
 */
import type { Design } from '@/lib/design';
import type { CalendarEventView } from '@/lib/draft';
import { monthGrid } from '@/lib/dates/month-grid';

/** One occurrence of one calendar event, as placed on the days it covers. */
export type SnapshotEvent = Omit<CalendarEventView, 'occurrences'> & {
  start: string;
  end: string;
  status: 'confirmed' | 'estimated';
};

export type SnapshotMonth = {
  year: number;
  month0: number;
  weeks: (string | null)[][];
  /** ISO date → events covering that day, ordered by start date then title. */
  events: Record<string, SnapshotEvent[]>;
};

export type CalendarSnapshot = {
  design: Design;
  startMonth: string;
  months: SnapshotMonth[];
  /**
   * The logo as a data: URL (snapshots stored for printing never depend on an authenticated URL).
   * The studio's live preview passes its own same-origin logo URL here instead.
   */
  logoDataUrl: string | null;
};

const SPAN = 12;
const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

export function assembleSnapshot(
  design: Design,
  startMonth: string,
  views: CalendarEventView[],
  logoDataUrl: string | null,
): CalendarSnapshot {
  const y0 = Number(startMonth.slice(0, 4));
  const m0 = Number(startMonth.slice(5, 7)) - 1;

  const byDate = new Map<string, SnapshotEvent[]>();
  for (const view of views) {
    const { occurrences, ...rest } = view;
    for (const occ of occurrences) {
      const ev: SnapshotEvent = { ...rest, start: occ.start, end: occ.end, status: occ.status };
      const end = Date.parse(`${occ.end}T12:00:00Z`);
      for (let t = Date.parse(`${occ.start}T12:00:00Z`); t <= end; t += DAY_MS) {
        const iso = new Date(t).toISOString().slice(0, 10);
        const list = byDate.get(iso) ?? [];
        list.push(ev);
        byDate.set(iso, list);
      }
    }
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.start.localeCompare(b.start) || a.titleAr.localeCompare(b.titleAr));
  }

  const months: SnapshotMonth[] = Array.from({ length: SPAN }, (_, i) => {
    const d = new Date(Date.UTC(y0, m0 + i, 1, 12));
    const year = d.getUTCFullYear();
    const month0 = d.getUTCMonth();
    const prefix = `${year}-${pad(month0 + 1)}-`;
    const events: Record<string, SnapshotEvent[]> = {};
    for (const [iso, list] of byDate) if (iso.startsWith(prefix)) events[iso] = list;
    return { year, month0, weeks: monthGrid(year, month0, design.weekStart), events };
  });

  return { design, startMonth, months, logoDataUrl };
}
