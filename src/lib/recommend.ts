import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { eventOccurrences, eventTags, events, taxonomyTerms, type EventRow } from '@/db/schema';
import { resolveOccurrences, type Occurrence } from '@/lib/dates/occurrences';

export type Selections = { sector: string | null; fields: string[]; audiences: string[]; uses: string[] };
export type Reason = { ar: string; en: string };
export type Recommendation = {
  eventId: string;
  titleAr: string;
  titleEn: string;
  kind: EventRow['kind'];
  icon: string;
  color: string | null;
  score: number;
  band: 'high' | 'good' | 'low';
  reasons: Reason[];
  occurrences: Occurrence[];
};
export type EventWithTags = EventRow & {
  tags: { group: 'sector' | 'field' | 'audience' | 'use'; key: string; labelAr: string; labelEn: string; weight: number }[];
};

type Tag = EventWithTags['tags'][number];

const SECTOR_FACTOR: Record<number, number> = { 3: 1, 2: 0.85, 1: 0.6 };
const UNTAGGED_SECTOR_FACTOR = 0.9;

/** Highest-weight tag of `group` whose key is selected, if any. */
function bestMatch(tags: Tag[], group: Tag['group'], keys: string[]): Tag | null {
  let best: Tag | null = null;
  for (const t of tags) {
    if (t.group === group && keys.includes(t.key) && (!best || t.weight > best.weight)) best = t;
  }
  return best;
}

export function bandOf(score: number): Recommendation['band'] {
  return score >= 70 ? 'high' : score >= 40 ? 'good' : 'low';
}

export function scoreEvent(event: EventWithTags, sel: Selections): { score: number; reasons: Reason[] } {
  const field = bestMatch(event.tags, 'field', sel.fields);
  const audience = bestMatch(event.tags, 'audience', sel.audiences);
  const use = bestMatch(event.tags, 'use', sel.uses);
  const norm = (t: Tag | null) => (t ? t.weight / 3 : 0);
  const match = 40 * norm(field) + 15 * norm(audience) + 10 * norm(use);

  const special = event.kind === 'national' || event.kind === 'religious';
  const raw = special ? 35 + match : (match * 100) / 65;

  let factor = 1;
  if (sel.sector) {
    const st = event.tags.find((t) => t.group === 'sector' && t.key === sel.sector);
    factor = st ? (SECTOR_FACTOR[st.weight] ?? UNTAGGED_SECTOR_FACTOR) : UNTAGGED_SECTOR_FACTOR;
  }
  const clamped = Math.min(100, Math.max(0, Math.round(raw * factor)));
  // National and religious occasions are never scored below their base, whatever the sector.
  const score = special ? Math.max(35, clamped) : clamped;

  const reasons: Reason[] = [];
  if (event.kind === 'national') reasons.push({ ar: 'مناسبة وطنية', en: 'National occasion' });
  if (event.kind === 'religious') reasons.push({ ar: 'مناسبة دينية', en: 'Religious occasion' });
  if (field) reasons.push({ ar: `يتوافق مع مجال: ${field.labelAr}`, en: `Matches field: ${field.labelEn}` });
  if (audience) reasons.push({ ar: `يناسب جمهور: ${audience.labelAr}`, en: `Suits audience: ${audience.labelEn}` });
  if (use) reasons.push({ ar: `مناسب لـ: ${use.labelAr}`, en: `Fits: ${use.labelEn}` });
  return { score, reasons };
}

export async function recommend(sel: Selections, spanStart: string): Promise<Recommendation[]> {
  const [eventRows, tagRows, overrides] = await Promise.all([
    db.select().from(events).where(eq(events.active, true)),
    db
      .select({
        eventId: eventTags.eventId,
        group: taxonomyTerms.group,
        key: taxonomyTerms.key,
        labelAr: taxonomyTerms.labelAr,
        labelEn: taxonomyTerms.labelEn,
        weight: eventTags.weight,
      })
      .from(eventTags)
      .innerJoin(taxonomyTerms, eq(eventTags.termId, taxonomyTerms.id)),
    db.select().from(eventOccurrences),
  ]);

  const tagsByEvent = new Map<string, Tag[]>();
  for (const { eventId, ...tag } of tagRows) {
    const list = tagsByEvent.get(eventId);
    if (list) list.push(tag);
    else tagsByEvent.set(eventId, [tag]);
  }

  const items: Recommendation[] = [];
  for (const row of eventRows) {
    const occurrences = resolveOccurrences(row, overrides, spanStart, 12);
    if (occurrences.length === 0) continue;
    const { score, reasons } = scoreEvent({ ...row, tags: tagsByEvent.get(row.id) ?? [] }, sel);
    if (score <= 0) continue;
    items.push({
      eventId: row.id,
      titleAr: row.titleAr,
      titleEn: row.titleEn || row.titleAr,
      kind: row.kind,
      icon: row.icon ?? '★',
      color: row.color,
      score, band: bandOf(score),
      reasons,
      occurrences,
    });
  }
  items.sort((a, b) => b.score - a.score || a.occurrences[0].start.localeCompare(b.occurrences[0].start));
  return items;
}
