import { NextResponse } from 'next/server';
import {
  clientIp,
  createDownload,
  downloadRequestSchema,
  EmailDeliveryError,
  RateLimitError,
} from '@/lib/downloads';
import { draftFromRequest, langFromRequest, withDraftCookie } from '@/lib/draft';
import { verifyTurnstile } from '@/lib/turnstile';

/** POST /api/downloads — email-gated download of the visitor's draft. The link goes only by email. */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = downloadRequestSchema.safeParse(json);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? 'body')] ??= 'invalid';
    return NextResponse.json({ error: 'invalid_body', fields }, { status: 400 });
  }
  const body = parsed.data;
  const ip = clientIp(req);
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });
  }

  const draft = (await draftFromRequest(req, true))!;
  const { calendar } = draft;
  try {
    await createDownload({
      calendarId: calendar.id,
      email: body.email,
      orgName: body.orgName,
      sector: body.sector ?? calendar.selections.sector ?? null,
      fields: calendar.selections.fields ?? [],
      phone: body.phone,
      formats: body.formats,
      ip,
      lang: langFromRequest(req),
    });
  } catch (err) {
    if (err instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    if (err instanceof EmailDeliveryError) {
      console.error('[downloads]', err, err.cause);
      return NextResponse.json({ error: 'email_failed' }, { status: 502 });
    }
    throw err;
  }
  return withDraftCookie(NextResponse.json({ ok: true }), draft);
}
