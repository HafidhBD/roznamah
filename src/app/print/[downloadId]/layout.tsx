import { docLangs } from '@/components/calendar-document/doc';
import { downloadSnapshot } from './snapshot';

/**
 * Root layout of the print renderer: a bare document (no site header or styles) whose language
 * and direction follow the calendar being printed.
 */
export default async function PrintLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ downloadId: string }>;
}) {
  const snapshot = await downloadSnapshot((await params).downloadId);
  const { main, dir } = docLangs(snapshot?.design.language ?? 'ar');
  return (
    <html lang={main} dir={dir}>
      <body style={{ margin: 0, background: '#fff' }}>{children}</body>
    </html>
  );
}
