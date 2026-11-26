import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { calendars } from '@/db/schema';
import { draftFromRequest, withDraftCookie } from '@/lib/draft';
import { deleteLogo, LogoError, logoUrlFor, MAX_LOGO_BYTES, processLogo, readLogo } from '@/lib/logo';
import { renderSecretMatches } from '@/lib/render-secret';
import { ownLogoPath } from '@/lib/snapshot';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Updates only design.logoPath, so a concurrent design PATCH is not overwritten. */
const setLogoPath = (path: string | null) =>
  sql`jsonb_set(${calendars.design}, '{logoPath}', ${JSON.stringify(path)}::jsonb)`;

const notFound = () => NextResponse.json({ error: 'not_found' }, { status: 404 });

/** Serves the logo of the visitor's own draft, or of any calendar to the print renderer (render secret). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  let calendar: { id: string; logoPath: string | null } | null = null;
  const calendarId = url.searchParams.get('calendarId');
  if (calendarId) {
    if (!UUID.test(calendarId) || !renderSecretMatches(url.searchParams.get('secret'))) return notFound();
    const [row] = await db.select().from(calendars).where(eq(calendars.id, calendarId));
    if (row) calendar = { id: row.id, logoPath: row.design.logoPath };
  } else {
    const draft = await draftFromRequest(req, false);
    if (draft) calendar = { id: draft.calendar.id, logoPath: draft.calendar.design.logoPath };
  }
  const logo = calendar ? await readLogo(ownLogoPath(calendar.id, calendar.logoPath)) : null;
  if (!logo) return notFound();
  return new NextResponse(new Uint8Array(logo.bytes), {
    headers: {
      'content-type': logo.mime,
      'cache-control': 'private, max-age=86400',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'",
    },
  });
}

const errorStatus = { TOO_LARGE: 413, BAD_TYPE: 400, CORRUPT: 400 } as const;

export async function POST(req: Request) {
  // Refuse oversized bodies before buffering them (multipart overhead allowance).
  if (Number(req.headers.get('content-length') ?? 0) > MAX_LOGO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 });
  }
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get('file');
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  if (file.size > MAX_LOGO_BYTES) return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 });

  const draft = (await draftFromRequest(req, true))!;
  const { calendar } = draft;
  const previous = ownLogoPath(calendar.id, calendar.design.logoPath);
  let out: Awaited<ReturnType<typeof processLogo>>;
  try {
    out = await processLogo(
      { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type, name: file.name },
      { calendarId: calendar.id },
    );
  } catch (e) {
    if (e instanceof LogoError) {
      return withDraftCookie(NextResponse.json({ error: e.code }, { status: errorStatus[e.code] }), draft);
    }
    throw e;
  }
  try {
    await db
      .update(calendars)
      .set({ design: setLogoPath(out.path), updatedAt: new Date() })
      .where(eq(calendars.id, calendar.id));
  } catch (e) {
    await deleteLogo(out.path); // the new file is not referenced; the old one stays in use
    throw e;
  }
  // Only now that the new path is saved is the old file unreferenced.
  if (previous && previous !== out.path) await deleteLogo(previous);
  return withDraftCookie(NextResponse.json({ logoUrl: logoUrlFor(out.path), palette: out.palette }), draft);
}

export async function DELETE(req: Request) {
  const draft = await draftFromRequest(req, false);
  if (!draft) return NextResponse.json({ ok: true });
  const { calendar } = draft;
  await deleteLogo(ownLogoPath(calendar.id, calendar.design.logoPath));
  await db
    .update(calendars)
    .set({ design: setLogoPath(null), updatedAt: new Date() })
    .where(eq(calendars.id, calendar.id));
  return NextResponse.json({ ok: true });
}
