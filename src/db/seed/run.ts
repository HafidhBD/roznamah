import { eq, inArray, sql as dsql } from 'drizzle-orm';
import { db, sql } from '../client';
import { eventOccurrences, eventTags, events, taxonomyTerms } from '../schema';
import { taxonomySeed } from './taxonomy';
import { eventsSeed } from './events';

export interface SeedOptions {
  /** Overwrite existing rows with seed values (dev only). Default: insert-only, never touch existing rows. */
  update?: boolean;
}

/**
 * Safe to run on every release: by default it only inserts rows that do not exist yet
 * (taxonomy by group+key, events by slug) and, for newly inserted events only, their tags and
 * occurrences. It never modifies or restores admin edits. With `update: true` it upserts and rewrites tags.
 */
export async function runSeed(
  opts: SeedOptions = {},
): Promise<{ taxonomy: number; events: number }> {
  const update = opts.update === true;
  await db.transaction(async (tx) => {
    for (const t of taxonomySeed) {
      const ins = tx.insert(taxonomyTerms).values(t);
      if (update) {
        await ins.onConflictDoUpdate({
          target: [taxonomyTerms.group, taxonomyTerms.key],
          set: { labelAr: t.labelAr, labelEn: t.labelEn, sort: t.sort },
        });
      } else {
        await ins.onConflictDoNothing({ target: [taxonomyTerms.group, taxonomyTerms.key] });
      }
    }
    const terms = await tx.select().from(taxonomyTerms);
    const termId = new Map(terms.map((t) => [`${t.group}:${t.key}`, t.id]));

    for (const e of eventsSeed) {
      const { tags, occurrences, ...row } = e;
      const ins = tx.insert(events).values(row);
      const [saved] = update
        ? await ins
            .onConflictDoUpdate({ target: events.slug, set: { ...row, updatedAt: dsql`now()` } })
            .returning({ id: events.id })
        : await ins.onConflictDoNothing({ target: events.slug }).returning({ id: events.id });
      // Insert-only: an event that already exists keeps its tags and occurrences exactly as the admin left them.
      if (!update && !saved) continue;
      const eventId = saved.id;

      if (update) await tx.delete(eventTags).where(eq(eventTags.eventId, eventId));
      const tagRows = tags.map((t) => {
        const id = termId.get(`${t.group}:${t.key}`);
        if (id === undefined) throw new Error(`Taxonomy term missing: ${t.group}:${t.key}`);
        return { eventId, termId: id, weight: t.weight };
      });
      await tx.insert(eventTags).values(tagRows);

      for (const o of occurrences) {
        const oi = tx
          .insert(eventOccurrences)
          .values({ eventId, year: o.year, startDate: o.startDate, status: o.status, sourceUrl: o.sourceUrl });
        if (update) {
          await oi.onConflictDoUpdate({
            target: [eventOccurrences.eventId, eventOccurrences.year],
            set: { startDate: o.startDate, status: o.status, sourceUrl: o.sourceUrl ?? null, updatedAt: dsql`now()` },
          });
        } else {
          await oi;
        }
      }
    }
    const n = await tx
      .select({ id: events.id })
      .from(events)
      .where(inArray(events.slug, eventsSeed.map((e) => e.slug)));
    if (n.length !== eventsSeed.length) throw new Error('Seed verification failed');
  });
  return { taxonomy: taxonomySeed.length, events: eventsSeed.length };
}

if (process.argv[1] && /seed[\\/]run\.[cm]?[tj]s$/.test(process.argv[1])) {
  runSeed({ update: process.argv.includes('--update') })
    .then((r) => {
      console.log(`Seeded ${r.taxonomy} taxonomy terms and ${r.events} events`);
      return sql.end();
    })
    .catch(async (err) => {
      console.error(err);
      await sql.end();
      process.exit(1);
    });
}
