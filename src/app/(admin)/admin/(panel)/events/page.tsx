import Link from 'next/link';
import { and, asc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { events } from '@/db/schema';
import { requirePageAdmin } from '@/lib/auth';
import { t, type MessageKey } from '@/i18n/core';

export const dynamic = 'force-dynamic';

const KINDS = ['national', 'religious', 'international', 'field', 'commercial'] as const;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; active?: string }>;
}) {
  await requirePageAdmin();
  const { q, kind, active } = await searchParams;
  const conds: SQL[] = [];
  if (q?.trim()) {
    const like = `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(events.titleAr, like), ilike(events.titleEn, like), ilike(events.slug, like))!);
  }
  if (KINDS.includes(kind as (typeof KINDS)[number])) conds.push(eq(events.kind, kind as (typeof KINDS)[number]));
  if (active === '1') conds.push(eq(events.active, true));
  if (active === '0') conds.push(eq(events.active, false));
  const rows = await db
    .select()
    .from(events)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(events.titleAr))
    .limit(500);

  const dateText = (e: (typeof rows)[number]) =>
    e.recurrence === 'gregorian_fixed' ? `${e.gDay}/${e.gMonth}` : e.recurrence === 'hijri_fixed' ? `${e.hDay}/${e.hMonth}` : '';
  const input = 'rounded-lg border border-line bg-surface px-3 py-2 text-sm';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('ar', 'admin.events.title')}</h1>
        <Link href="/admin/events/new" data-testid="event-new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
          {t('ar', 'admin.events.new')}
        </Link>
      </div>
      <form className="flex flex-wrap items-end gap-2" role="search">
        <input name="q" defaultValue={q ?? ''} placeholder={t('ar', 'admin.events.search')} aria-label={t('ar', 'admin.events.search')} className={`${input} min-w-48 flex-1`} />
        <select name="kind" defaultValue={kind ?? ''} aria-label={t('ar', 'admin.events.kind')} className={input}>
          <option value="">{t('ar', 'admin.events.allKinds')}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t('ar', `admin.kind.${k}` as MessageKey)}
            </option>
          ))}
        </select>
        <select name="active" defaultValue={active ?? ''} aria-label={t('ar', 'admin.events.status')} className={input}>
          <option value="">{t('ar', 'admin.events.allStatus')}</option>
          <option value="1">{t('ar', 'admin.events.active')}</option>
          <option value="0">{t('ar', 'admin.events.inactive')}</option>
        </select>
        <button type="submit" className="rounded-lg border border-line px-4 py-2 text-sm hover:border-brand">
          {t('ar', 'admin.events.apply')}
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-muted">{t('ar', 'admin.events.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-start text-sm" data-testid="events-table">
            <thead className="bg-bg text-muted">
              <tr>
                {(['colTitle', 'colKind', 'colRecurrence', 'colDate', 'colStatus'] as const).map((k) => (
                  <th key={k} className="px-3 py-2 text-start font-medium">
                    {t('ar', `admin.events.${k}`)}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2">{e.titleAr}</td>
                  <td className="px-3 py-2">{t('ar', `admin.kind.${e.kind}` as MessageKey)}</td>
                  <td className="px-3 py-2">{t('ar', `admin.recurrence.${e.recurrence}` as MessageKey)}</td>
                  <td className="px-3 py-2" dir="ltr">
                    {dateText(e)}
                  </td>
                  <td className="px-3 py-2">{t('ar', e.active ? 'admin.events.active' : 'admin.events.inactive')}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/events/${e.id}`} data-testid={`edit-${e.slug}`} className="text-brand hover:underline">
                      {t('ar', 'admin.events.edit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
