import { StudioPanel } from '@/components/studio/StudioPanel';
import { getLang } from '@/i18n';
import { defaultDesign } from '@/lib/design';
import { getDraft, listEventViews } from '@/lib/draft';
import { logoUrlFor, storedPalette } from '@/lib/logo';
import { ownLogoPath } from '@/lib/snapshot';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const lang = await getLang();
  const draft = await getDraft();
  const design = { ...defaultDesign, ...draft?.design };
  const startMonth = draft?.startMonth ?? `${new Date().getUTCFullYear() + 1}-01-01`;
  const events = draft ? await listEventViews(draft, lang) : [];
  const logoPath = draft ? ownLogoPath(draft.id, design.logoPath) : null;

  return (
    <div data-wide>
      <StudioPanel
        key={lang}
        lang={lang}
        startMonth={startMonth}
        initialDesign={design}
        initialLogoUrl={logoPath ? logoUrlFor(logoPath) : null}
        initialPalette={await storedPalette(logoPath)}
        events={events}
      />
    </div>
  );
}
