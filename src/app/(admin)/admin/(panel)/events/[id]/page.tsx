import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { eventOccurrences, eventTags, events, taxonomyTerms } from '@/db/schema';
import { requirePageAdmin } from '@/lib/auth';
import { t } from '@/i18n/core';
import { isUuid } from '@/lib/admin/events';
import { resolveOccurrences } from '@/lib/dates/occurrences';
import { EMPTY_EVENT, EventForm, type EventFormValues } from '@/components/admin/EventForm';
import { OccurrenceEditor, type OccurrenceRow } from '@/components/admin/OccurrenceEditor';

export const dynamic = 'force-dynamic';

export default async function EventEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  await requirePageAdmin();
  const { id } = await params;
  const { year: yearParam } = await searchParams;
  const terms = await db
    .select({ id: taxonomyTerms.id, group: taxonomyTerms.group, labelAr: taxonomyTerms.labelAr, active: taxonomyTerms.active })
    .from(taxonomyTerms)
    .orderBy(asc(taxonomyTerms.group), asc(taxonomyTerms.sort));
  const back = (
    <Link href="/admin/events" className="text-sm text-brand hover:underline">
      {t('ar', 'admin.form.back')}
    </Link>
  );

  if (id === 'new') {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <h1 className="text-2xl font-semibold">{t('ar', 'admin.form.new')}</h1>
        <EventForm initial={EMPTY_EVENT} terms={terms} />
      </div>
    );
  }
  if (!isUuid(id)) notFound();
  const [ev] = await db.select().from(events).where(eq(events.id, id));
  if (!ev) notFound();
  const tags = await db.select({ termId: eventTags.termId, weight: eventTags.weight }).from(eventTags).where(eq(eventTags.eventId, id));
  const overrides = await db.select().from(eventOccurrences).where(eq(eventOccurrences.eventId, id));

  const thisYear = new Date().getUTCFullYear();
  const years = [...new Set([thisYear - 1, thisYear, thisYear + 1, thisYear + 2, ...overrides.map((o) => o.year)])].sort();
  const rows: OccurrenceRow[] = years.map((y) => {
    const span = `${y}-01-01`;
    const override = overrides.find((o) => o.year === y);
    return {
      year: y,
      computed: ev.recurrence === 'annual_manual' ? [] : resolveOccurrences(ev, [], span, 12).map((o) => o.start),
      effective: resolveOccurrences(ev, overrides, span, 12).map((o) => ({ start: o.start, status: o.status })),
      override: override ? { startDate: override.startDate, status: override.status, sourceUrl: override.sourceUrl } : null,
    };
  });
  const asked = Number(yearParam);
  const initialYear = years.includes(asked) ? asked : thisYear;

  const initial: EventFormValues = { ...ev, tags };
  return (
    <div className="flex flex-col gap-4">
      {back}
      <h1 className="text-2xl font-semibold">{ev.titleAr}</h1>
      <EventForm id={ev.id} initial={initial} terms={terms} />
      <OccurrenceEditor eventId={ev.id} rows={rows} initialYear={initialYear} />
    </div>
  );
}
