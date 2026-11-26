import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarDocument } from '@/components/calendar-document/CalendarDocument';
import { decodePageFormat } from '@/lib/print-sizes';
import { renderSecretMatches } from '@/lib/render-secret';
import { downloadSnapshot } from './snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = { title: 'Roznamah print', robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null);

/** GET /print/<downloadId>?format=<base64url PageFormat>&key=<RENDER_SECRET> — the PDF renderer's page. */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ downloadId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  if (!renderSecretMatches(one(query.key))) notFound();
  const format = decodePageFormat(one(query.format));
  if (!format) notFound();
  const snapshot = await downloadSnapshot((await params).downloadId);
  if (!snapshot) notFound();
  return <CalendarDocument data={snapshot} format={format} mode="print" />;
}
