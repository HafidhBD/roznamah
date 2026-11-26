import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { taxonomyTerms } from '@/db/schema';
import { requirePageAdmin } from '@/lib/auth';
import { t } from '@/i18n/core';
import { LEADS_PAGE_SIZE, LEAD_COLUMNS, listLeads } from '@/lib/admin/leads';

export const dynamic = 'force-dynamic';

type SP = { sector?: string; from?: string; to?: string; page?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filters = { sector: sp.sector || undefined, from: sp.from || undefined, to: sp.to || undefined };
  const [{ rows, total }, sectors] = await Promise.all([
    listLeads(filters, page),
    db.select().from(taxonomyTerms).where(and(eq(taxonomyTerms.group, 'sector'))).orderBy(asc(taxonomyTerms.sort)),
  ]);
  const pages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const qs = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
    if (p > 1) q.set('page', String(p));
    return `?${q}`;
  };
  const exportQs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  const input = 'rounded-lg border border-line bg-surface px-3 py-2 text-sm';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('ar', 'admin.leads.title')}</h1>
        <a
          href={`/api/admin/leads/export${exportQs ? `?${exportQs}` : ''}`}
          data-testid="leads-export"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          {t('ar', 'admin.leads.export')}
        </a>
      </div>
      <form className="flex flex-wrap items-end gap-2">
        <select name="sector" defaultValue={sp.sector ?? ''} aria-label={t('ar', 'admin.leads.sector')} className={input}>
          <option value="">{t('ar', 'admin.leads.allSectors')}</option>
          {sectors.map((s) => (
            <option key={s.key} value={s.key}>
              {s.labelAr}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('ar', 'admin.leads.from')}
          <input type="date" name="from" defaultValue={sp.from ?? ''} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('ar', 'admin.leads.to')}
          <input type="date" name="to" defaultValue={sp.to ?? ''} className={input} />
        </label>
        <button type="submit" className="rounded-lg border border-line px-4 py-2 text-sm hover:border-brand">
          {t('ar', 'admin.leads.apply')}
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-muted">{t('ar', 'admin.leads.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-start text-sm" data-testid="leads-table">
            <thead className="bg-bg text-muted">
              <tr>
                {LEAD_COLUMNS.map(([key, msg]) => (
                  <th key={key} className="px-3 py-2 text-start font-medium">
                    {t('ar', msg)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  {LEAD_COLUMNS.map(([key]) => (
                    <td key={key} className="px-3 py-2" dir={key === 'email' || key === 'phone' || key === 'date' ? 'ltr' : undefined}>
                      {r[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="flex items-center justify-between text-sm" aria-label={t('ar', 'admin.leads.page')}>
        <span className="text-muted">
          {t('ar', 'admin.leads.total')}: {total} - {t('ar', 'admin.leads.page')} {page}/{pages}
        </span>
        <span className="flex gap-3">
          {page > 1 && (
            <Link href={qs(page - 1)} className="text-brand hover:underline">
              {t('ar', 'admin.leads.prev')}
            </Link>
          )}
          {page < pages && (
            <Link href={qs(page + 1)} data-testid="leads-next" className="text-brand hover:underline">
              {t('ar', 'admin.leads.next')}
            </Link>
          )}
        </span>
      </nav>
    </div>
  );
}
