import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { lookupFile } from '@/lib/downloads';

/** GET /api/files/:token/:name — streams a rendered PDF; 410 once the link expired. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; name: string }> }) {
  const { token, name } = await params;
  const file = await lookupFile(token, name);
  if (file.kind === 'expired') return NextResponse.json({ error: 'expired' }, { status: 410 });
  if (file.kind === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  let size: number;
  try {
    size = (await stat(file.path)).size;
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const body = Readable.toWeb(createReadStream(file.path)) as ReadableStream<Uint8Array>;
  return new Response(body, {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(size),
      'content-disposition': `attachment; filename="${file.name}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
