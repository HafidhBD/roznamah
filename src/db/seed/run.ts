import { eq, inArray, sql as dsql } from 'drizzle-orm';
import { db, sql } from '../client';
import { eventOccurrences, eventTags, events, taxonomyTerms } from '../schema';
import { taxonomySeed } from './taxonomy';
import { eventsSeed } from './events';

/** Idempotent: upserts taxonomy by (group, key) and events by slug; rewrites each seeded event's tags. */
export async function runSeed(): Promise<{ taxonomy: number; events: number }> {
  await db.transaction(async (tx) => {
    for (const t of taxonomySeed) {
      await tx
        .insert(taxonomyTerms)
        .values(t)
        .onConflictDoUpdate({
          target: [taxonomyTerms.group, taxonomyTerms.key],
          set: { labelAr: t.labelAr, labelEn: t.labelEn, sort: t.sort },
        });
    }
    const terms = await tx.select().from(taxonomyTerms);
    const termId = new Map(terms.map((t) => [`${t.group}:${t.key}`, t.id]));

    for (const e of eventsSeed) {
      const { tags, occurrences, ...row } = e;
      const [saved] = await tx
        .insert(events)
        .values(row)
        .onConflictDoUpdate({ target: events.slug, set: { ...row, updatedAt: dsql`now()` } })
        .returning({ id: events.id });

      await tx.delete(eventTags).where(eq(eventTags.eventId, saved.id));
      await tx.insert(eventTags).values(
        tags.map((t) => {
          const id = termId.get(`${t.group}:${t.key}`);
          if (id === undefined) throw new Error(`Taxonomy term missing: ${t.group}:${t.key}`);
          return { eventId: saved.id, termId: id, weight: t.weight };
        }),
      );
      for (const o of occurrences) {
        await tx
          .insert(eventOccurrences)
          .values({ eventId: saved.id, year: o.year, startDate: o.startDate, status: o.status, sourceUrl: o.sourceUrl })
          .onConflictDoUpdate({
            target: [eventOccurrences.eventId, eventOccurrences.year],
            set: { startDate: o.startDate, status: o.status, sourceUrl: o.sourceUrl ?? null, updatedAt: dsql`now()` },
          });
      }
    }
    // Sanity: every seeded slug exists.
    const n = await tx
      .select({ id: events.id })
      .from(events)
      .where(inArray(events.slug, eventsSeed.map((e) => e.slug)));
    if (n.length !== eventsSeed.length) throw new Error('Seed verification failed');
  });
  return { taxonomy: taxonomySeed.length, events: eventsSeed.length };
}

if (process.argv[1] && /seed[\\/]run\.[cm]?[tj]s$/.test(process.argv[1])) {
  runSeed()
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
