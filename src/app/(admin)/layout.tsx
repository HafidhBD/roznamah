import type { Metadata } from 'next';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '../globals.css';
import { t } from '@/i18n/core';

export const metadata: Metadata = { title: t('ar', 'admin.brand'), robots: { index: false, follow: false } };

// Admin owns its own root layout: Arabic, RTL, same design tokens as the public site.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
