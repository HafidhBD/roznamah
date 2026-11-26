import type { Metadata } from 'next';
import { getLang, t, type MessageKey } from '@/i18n';

export const metadata: Metadata = { title: 'Privacy | الخصوصية — Roznamah' };

const SECTIONS: { title: MessageKey; body: MessageKey }[] = [
  { title: 'privacy.collect.title', body: 'privacy.collect.body' },
  { title: 'privacy.why.title', body: 'privacy.why.body' },
  { title: 'privacy.retention.title', body: 'privacy.retention.body' },
];

/** Where deletion requests go (set PRIVACY_EMAIL in production). */
const privacyEmail = () => process.env.PRIVACY_EMAIL || 'privacy@example.com';

export default async function Page() {
  const lang = await getLang();
  const email = privacyEmail();
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 py-4" data-testid="privacy">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">{t(lang, 'privacy.title')}</h1>
        <p className="leading-relaxed text-muted">{t(lang, 'privacy.intro')}</p>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">{t(lang, s.title)}</h2>
          <p className="leading-relaxed text-ink/90">{t(lang, s.body)}</p>
        </section>
      ))}
      <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t(lang, 'privacy.delete.title')}</h2>
        <p className="leading-relaxed text-ink/90">
          {t(lang, 'privacy.delete.body')}{' '}
          <a href={`mailto:${email}`} dir="ltr" className="font-medium text-brand hover:underline">
            {email}
          </a>
        </p>
      </section>
    </article>
  );
}
