/**
 * Root layout of the print renderer: a bare document (no site header or styles). It reads nothing
 * from the DB, so nothing leaks before the page's key check; the page sets the calendar's own
 * lang/dir on a wrapper element.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, background: '#fff' }}>{children}</body>
    </html>
  );
}
