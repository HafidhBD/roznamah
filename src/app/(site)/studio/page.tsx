import type { Metadata } from 'next';
import { and, asc, eq } from 'drizzle-orm';
import { StudioPanel } from '@/components/studio/StudioPanel';
import { db } from '@/db/client';
import { taxonomyTerms } from '@/db/schema';
import { getLang, t } from '@/i18n';
import { getDraft, listEventViews, newDraftDesign } from '@/lib/draft';
import { logoUrlFor, storedPalette } from '@/lib/logo';
import { ownLogoPath } from '@/lib/snapshot';
import { turnstileSiteKey } from '@/lib/turnstile';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'nav.studio') };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const lang = await getLang();
  const [draft, sectorTerms] = await Promise.all([
    getDraft(),
    db
      .select({ key: taxonomyTerms.key, labelAr: taxonomyTerms.labelAr, labelEn: taxonomyTerms.labelEn })
      .from(taxonomyTerms)
      .where(and(eq(taxonomyTerms.group, 'sector'), eq(taxonomyTerms.active, true)))
      .orderBy(asc(taxonomyTerms.sort)),
  ]);
  // No draft yet: preview what the first save will create (calendar in the visitor's UI language).
  const design = { ...newDraftDesign(lang), ...draft?.design };
  const startMonth = draft?.startMonth ?? `${new Date().getUTCFullYear() + 1}-01-01`;
  const events = draft ? await listEventViews(draft, lang) : [];
  const logoPath = draft ? ownLogoPath(draft.id, design.logoPath) : null;
  const sectors = sectorTerms.map((s) => ({ key: s.key, label: lang === 'en' ? s.labelEn : s.labelAr }));

  return (
    <div data-wide>
      <StudioPanel
        key={lang}
        lang={lang}
        sectors={sectors}
        initialSector={draft?.selections.sector ?? null}
        turnstileSiteKey={turnstileSiteKey()}
        openDownload={(await searchParams).download === '1'}
        startMonth={startMonth}
        initialDesign={design}
        initialLogoUrl={logoPath ? logoUrlFor(logoPath) : null}
        initialPalette={await storedPalette(logoPath)}
        events={events}
      />
    </div>
  );
}
