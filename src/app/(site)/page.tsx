import { asc, count, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { events, taxonomyTerms } from '@/db/schema';
import { PlanBuilder, type MonthOption, type Taxonomy } from '@/components/plan-builder/PlanBuilder';
import { getDraft, listEventViews } from '@/lib/draft';
import { getLang, t, type Lang } from '@/i18n';
import type { Selections } from '@/lib/recommend';

export const dynamic = 'force-dynamic';

const emptySelections: Selections = { sector: null, fields: [], audiences: [], uses: [] };

/** The next 12 months from today, plus January of next year (the default) if it is not among them. */
function monthOptions(lang: Lang, current: string): MonthOption[] {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
  const values: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    values.push(d.toISOString().slice(0, 10));
  }
  const janNext = `${now.getUTCFullYear() + 1}-01-01`;
  for (const v of [janNext, current]) if (!values.includes(v)) values.push(v);
  values.sort();
  return values.map((value) => ({
    value,
    label:
      fmt.format(new Date(`${value}T12:00:00Z`)) + (value === janNext ? ` (${t(lang, 'plan.startMonth.janNext')})` : ''),
  }));
}

export default async function Page() {
  const lang = await getLang();
  const [terms, [{ total }], [{ national }], draft] = await Promise.all([
    db.select().from(taxonomyTerms).where(eq(taxonomyTerms.active, true)).orderBy(asc(taxonomyTerms.sort)),
    db.select({ total: count() }).from(events).where(eq(events.active, true)),
    db.select({ national: count() }).from(events).where(eq(events.kind, 'national')),
    getDraft(),
  ]);

  const taxonomy: Taxonomy = { sector: [], field: [], audience: [], use: [] };
  for (const term of terms) {
    taxonomy[term.group].push({ key: term.key, label: lang === 'en' ? term.labelEn : term.labelAr });
  }

  const defaultMonth = `${new Date().getUTCFullYear() + 1}-01-01`;
  const startMonth = draft?.startMonth ?? defaultMonth;
  const views = draft ? await listEventViews(draft, lang) : [];

  const stats = [
    { value: total, label: t(lang, 'plan.stat.occasions') },
    { value: national, label: t(lang, 'plan.stat.national') },
  ];

  return (
    <div className="pb-24">
      <section className="mb-10 flex flex-col gap-5 pt-2 md:mb-12">
        <h1 className="text-3xl font-semibold leading-tight text-ink md:text-5xl md:leading-tight">
          {t(lang, 'plan.hero.title')}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted md:text-lg">{t(lang, 'plan.hero.subtitle')}</p>
        <dl className="flex gap-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2 rounded-2xl bg-[#f1ecff] px-4 py-2.5">
              <dt className="order-2 text-sm text-brand">{s.label}</dt>
              <dd className="order-1 text-2xl font-semibold text-brand">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <PlanBuilder
        lang={lang}
        taxonomy={taxonomy}
        months={monthOptions(lang, startMonth)}
        initial={{ selections: draft?.selections ?? emptySelections, startMonth, events: views }}
      />
    </div>
  );
}
