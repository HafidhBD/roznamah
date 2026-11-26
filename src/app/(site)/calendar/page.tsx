import { getLang, t } from '@/i18n';

export default async function Page() {
  const lang = await getLang();
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t(lang, 'calendar.title')}</h1>
      <p className="mt-2 text-muted">{t(lang, 'calendar.placeholder')}</p>
    </section>
  );
}
