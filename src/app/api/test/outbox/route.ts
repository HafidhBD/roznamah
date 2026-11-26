import { NextResponse } from 'next/server';
import { outbox, outboxExposed } from '@/lib/email';

export const dynamic = 'force-dynamic';

/** GET /api/test/outbox[?to=] — the in-memory email outbox; only for tests / EMAIL_TRANSPORT=memory. */
export async function GET(req: Request) {
  if (!outboxExposed()) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const to = new URL(req.url).searchParams.get('to')?.toLowerCase();
  return NextResponse.json({ messages: to ? outbox.filter((m) => m.to.includes(to)) : outbox });
}
