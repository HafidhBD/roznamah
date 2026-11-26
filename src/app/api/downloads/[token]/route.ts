import { NextResponse } from 'next/server';
import { getDownloadStatus } from '@/lib/downloads';

/** GET /api/downloads/:token — {status, files, expired}; never snapshot or lead data. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const status = await getDownloadStatus((await params).token);
  if (!status) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(status, { headers: { 'cache-control': 'no-store' } });
}
