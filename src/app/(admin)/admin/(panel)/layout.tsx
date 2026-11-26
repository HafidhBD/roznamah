import Link from 'next/link';
import { requirePageAdmin, signOut } from '@/lib/auth';
import { t, type MessageKey } from '@/i18n/core';

const NAV: { href: string; key: MessageKey; id: string }[] = [
  { href: '/admin', key: 'admin.nav.overview', id: 'overview' },
  { href: '/admin/events', key: 'admin.nav.events', id: 'events' },
  { href: '/admin/taxonomy', key: 'admin.nav.taxonomy', id: 'taxonomy' },
  { href: '/admin/leads', key: 'admin.nav.leads', id: 'leads' },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageAdmin();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:w-56 md:border-b-0 md:border-e">
        <div className="px-4 py-3 text-lg font-semibold text-brand">{t('ar', 'admin.brand')}</div>
        <nav aria-label={t('ar', 'admin.nav.label')} className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-4">
          {NAV.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              data-testid={`admin-nav-${n.id}`}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-ink hover:bg-bg hover:text-brand"
            >
              {t('ar', n.key)}
            </Link>
          ))}
        </nav>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/admin/sign-in' });
          }}
          className="hidden px-4 pb-4 md:block"
        >
          <p className="mb-2 truncate text-xs text-muted" dir="ltr">
            {session.user.email}
          </p>
          <button type="submit" className="text-sm text-muted hover:text-brand">
            {t('ar', 'admin.signOut')}
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
