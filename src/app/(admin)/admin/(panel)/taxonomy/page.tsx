import { asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { taxonomyTerms } from '@/db/schema';
import { requirePageAdmin } from '@/lib/auth';
import { t, type MessageKey } from '@/i18n/core';
import { TaxonomyRow } from '@/components/admin/TaxonomyRow';

export const dynamic = 'force-dynamic';

const GROUPS = ['sector', 'field', 'audience', 'use'] as const;

export default async function TaxonomyPage() {
  await requirePageAdmin();
  const terms = await db.select().from(taxonomyTerms).orderBy(asc(taxonomyTerms.sort), asc(taxonomyTerms.id));
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('ar', 'admin.taxonomy.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('ar', 'admin.taxonomy.hint')}</p>
      </div>
      {GROUPS.map((g) => (
        <section key={g} className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-semibold">{t('ar', `admin.taxonomy.group.${g}` as MessageKey)}</h2>
          {terms
            .filter((x) => x.group === g)
            .map((x) => (
              <TaxonomyRow key={x.id} term={{ id: x.id, key: `${g}-${x.key}`, labelAr: x.labelAr, labelEn: x.labelEn, sort: x.sort, active: x.active }} />
            ))}
        </section>
      ))}
    </div>
  );
}
