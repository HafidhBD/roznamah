import type { Metadata } from 'next';
import Link from 'next/link';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '../globals.css';
import { getLang, t, type MessageKey } from '@/i18n';
import { toggleLang } from '../lang-actions';

export const metadata: Metadata = { title: 'Roznamah | رَزنامة' };

const NAV: { href: string; key: MessageKey; id: string }[] = [
  { href: '/', key: 'nav.home', id: 'home' },
  { href: '/calendar', key: 'nav.calendar', id: 'calendar' },
  { href: '/studio', key: 'nav.studio', id: 'studio' },
];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={lang} dir={dir}>
      <body className="min-h-screen pb-16 md:pb-0">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
          <Link href="/" data-testid="brand" className="text-xl font-semibold text-brand">
            {t(lang, 'brand.name')}
          </Link>
          <nav aria-label={t(lang, 'nav.primary')} className="hidden gap-6 md:flex">
            {NAV.map((n) => (
              <Link key={n.id} href={n.href} data-testid={`nav-${n.id}`} className="text-ink hover:text-brand">
                {t(lang, n.key)}
              </Link>
            ))}
          </nav>
          <form action={toggleLang}>
            <button
              type="submit"
              data-testid="lang-toggle"
              aria-label={t(lang, 'lang.toggleLabel')}
              className="rounded-full border border-line px-3 py-1 text-sm hover:border-brand"
            >
              {t(lang, 'lang.toggle')}
            </button>
          </form>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <nav
          aria-label={t(lang, 'nav.mobile')}
          className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t border-line bg-surface md:hidden"
        >
          {NAV.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              data-testid={`bottom-nav-${n.id}`}
              className="py-3 text-center text-sm text-ink hover:text-brand"
            >
              {t(lang, n.key)}
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}
