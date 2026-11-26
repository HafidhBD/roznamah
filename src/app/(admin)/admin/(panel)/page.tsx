import Link from 'next/link';
import { requirePageAdmin } from '@/lib/auth';
import { t } from '@/i18n/core';
import { estimatedDates, overviewCounts } from '@/lib/admin/overview';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  await requirePageAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const [counts, estimated] = await Promise.all([overviewCounts(), estimatedDates(today)]);
  const stats = [
    { id: 'events', label: t('ar', 'admin.overview.events'), value: counts.eventsTotal },
    { id: 'estimated', label: t('ar', 'admin.overview.estimated'), value: estimated.length },
    { id: 'leads-week', label: t('ar', 'admin.overview.leadsWeek'), value: counts.leadsWeek },
    { id: 'leads-total', label: t('ar', 'admin.overview.leadsTotal'), value: counts.leadsTotal },
  ];
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('ar', 'admin.overview.title')}</h1>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.id} className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd data-testid={`stat-${s.id}`} className="mt-1 text-3xl font-semibold text-brand">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold">{t('ar', 'admin.overview.estimated')}</h2>
        {estimated.length === 0 ? (
          <p className="text-sm text-muted">{t('ar', 'admin.overview.estimatedEmpty')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {estimated.map((e) => (
              <li key={`${e.eventId}-${e.start}`} className="flex items-center justify-between gap-3 py-2">
                <span>{e.titleAr}</span>
                <span dir="ltr" className="text-sm text-muted">
                  {e.start}
                </span>
                <Link
                  href={`/admin/events/${e.eventId}?year=${e.year}#occurrences`}
                  className="rounded-lg border border-line px-3 py-1 text-sm text-brand hover:border-brand"
                >
                  {t('ar', 'admin.overview.confirm')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
