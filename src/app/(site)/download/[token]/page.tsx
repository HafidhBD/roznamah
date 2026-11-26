import type { Metadata } from 'next';
import { DownloadStatusView } from '@/components/download/DownloadStatusView';
import { getLang } from '@/i18n';
import { getDownloadStatus } from '@/lib/downloads';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };

/** /download/<token> — the link from the email: preparing → files, or expired / failed. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [lang, status] = await Promise.all([getLang(), getDownloadStatus(token)]);
  return <DownloadStatusView lang={lang} token={token} initial={status} />;
}
