import { CalendarApp } from '@/components/calendar/CalendarApp';
import { getDraft, listEventViews } from '@/lib/draft';
import { defaultDesign } from '@/lib/design';
import { getLang } from '@/i18n';
import type { Selections } from '@/lib/recommend';

export const dynamic = 'force-dynamic';

const emptySelections: Selections = { sector: null, fields: [], audiences: [], uses: [] };

export default async function Page() {
  const lang = await getLang();
  const draft = await getDraft();
  const now = new Date();
  const startMonth = draft?.startMonth ?? `${now.getUTCFullYear() + 1}-01-01`;
  const design = draft?.design ?? defaultDesign;
  const events = draft ? await listEventViews(draft, lang) : [];

  return (
    <CalendarApp
      key={lang}
      lang={lang}
      startMonth={startMonth}
      weekStart={design.weekStart}
      primary={design.primary}
      today={now.toISOString().slice(0, 10)}
      selections={draft?.selections ?? emptySelections}
      initialEvents={events}
    />
  );
}
