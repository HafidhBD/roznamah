import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, sql } from '@/db/client';
import { events, users, verificationTokens } from '@/db/schema';
import { resolveOccurrences } from '@/lib/dates/occurrences';
import { hijriToGregorian } from '@/lib/dates/hijri';
import { eventInputSchema } from '@/lib/admin/event-schema';
import { createAdminSession, deleteUserByEmail } from '../helpers/admin-session';

vi.stubEnv('ADMIN_EMAILS', 'a@waves.sa, B@waves.sa');
vi.stubEnv('AUTH_SECRET', 'unit-test-secret');
vi.stubEnv('EMAIL_TRANSPORT', 'memory');
vi.stubEnv('APP_URL', 'https://app.example.test');

const ADMIN = 'a@waves.sa';
const OUTSIDER = 'outsider@example.com';

type Mail = { to: string; url: string }[];
const mailbox = () => (globalThis as { __roznamahMail?: Mail }).__roznamahMail ?? [];

afterAll(async () => {
  await deleteUserByEmail(sql, ADMIN);
  await deleteUserByEmail(sql, OUTSIDER);
  await sql.end();
});

describe('isAdmin', () => {
  it('matches ADMIN_EMAILS case-insensitively', async () => {
    const { isAdmin } = await import('@/lib/auth');
    expect(isAdmin('A@Waves.sa')).toBe(true);
    expect(isAdmin('b@waves.sa')).toBe(true);
    expect(isAdmin('c@waves.sa')).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe('admin API guards', () => {
  const post = (cookie?: string) =>
    new Request('http://x/api/admin/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: '{}',
    });

  it('POST /api/admin/events without a session is 403', async () => {
    const { POST } = await import('@/app/api/admin/events/route');
    expect((await POST(post())).status).toBe(403);
  });

  it('a non-admin session is 403; an admin session passes the guard (400 on empty body)', async () => {
    const { POST } = await import('@/app/api/admin/events/route');
    const outsider = await createAdminSession(sql, OUTSIDER);
    expect((await POST(post(`authjs.session-token=${outsider}`))).status).toBe(403);
    await deleteUserByEmail(sql, OUTSIDER);
    const admin = await createAdminSession(sql, ADMIN);
    expect((await POST(post(`authjs.session-token=${admin}`))).status).toBe(400);
  });
});

describe('sign-in', () => {
  async function requestLink(email: string, extra: Record<string, string> = {}) {
    const { handlers } = await import('@/lib/auth');
    const csrf = await handlers.GET(new NextRequest('http://localhost/api/auth/csrf'));
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    const cookie = csrf.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    return handlers.POST(
      new NextRequest('http://localhost/api/auth/signin/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, ...extra },
        body: new URLSearchParams({ csrfToken, email, callbackUrl: '/admin' }),
      }),
    );
  }

  it('non-admins get the same verify-request redirect, with no token, user row or email', async () => {
    const admin = await requestLink(ADMIN);
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, ADMIN));
    const res = await requestLink(OUTSIDER);
    expect(res.headers.get('location')).toBe(admin.headers.get('location'));
    expect(res.headers.get('location')).toContain('/api/auth/verify-request');
    expect(await db.select().from(users).where(eq(users.email, OUTSIDER))).toHaveLength(0);
    expect(await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, OUTSIDER))).toHaveLength(0);
    expect(mailbox().some((m) => m.to === OUTSIDER)).toBe(false);
  });

  it('issues a magic link for admins', async () => {
    await requestLink(ADMIN);
    expect(await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, ADMIN))).toHaveLength(1);
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, ADMIN));
    expect(mailbox().some((m) => m.to === ADMIN && m.url.includes('/api/auth/callback/resend'))).toBe(true);
  });

  it('the link origin is APP_URL even with a poisoned X-Forwarded-Host / Host', async () => {
    const before = mailbox().length;
    await requestLink(ADMIN, { 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https', host: 'evil.example' });
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, ADMIN));
    const link = mailbox().slice(before).find((m) => m.to === ADMIN);
    expect(link).toBeTruthy();
    expect(new URL(link!.url).origin).toBe('https://app.example.test');
    expect(link!.url).not.toContain('evil.example');
  });
});

describe('admin route hardening', () => {
  const req = (init: { cookie?: string; origin?: string; type?: string | null; body?: unknown; method?: string }) =>
    new Request('http://x/api/admin/events', {
      method: init.method ?? 'POST',
      headers: {
        ...(init.type === null ? {} : { 'content-type': init.type ?? 'application/json' }),
        ...(init.cookie ? { cookie: init.cookie } : {}),
        ...(init.origin ? { origin: init.origin } : {}),
      },
      body: JSON.stringify(init.body ?? {}),
    });
  const validEvent = {
    slug: 'hardening-test', titleAr: 'ا', titleEn: 'a', kind: 'national', recurrence: 'annual_manual',
    durationDays: 1, prepDays: 1, active: true, tags: [{ termId: 999999, weight: 1 }],
  };

  it('malformed session cookie is no session (403), not 500', async () => {
    const { POST } = await import('@/app/api/admin/events/route');
    expect((await POST(req({ cookie: 'authjs.session-token=%E0%A4%A' }))).status).toBe(403);
  });

  it('rejects a foreign Origin (403) and a non-JSON content type (415)', async () => {
    const { POST } = await import('@/app/api/admin/events/route');
    const cookie = `authjs.session-token=${await createAdminSession(sql, ADMIN)}`;
    expect((await POST(req({ cookie, origin: 'https://evil.example' }))).status).toBe(403);
    expect((await POST(req({ cookie, type: 'text/plain' }))).status).toBe(415);
    expect((await POST(req({ cookie, type: null }))).status).toBe(415);
    expect((await POST(req({ cookie, origin: 'https://app.example.test' }))).status).toBe(400);
  });

  it('an unknown tag termId is a 400 unknown_term', async () => {
    const { POST } = await import('@/app/api/admin/events/route');
    const cookie = `authjs.session-token=${await createAdminSession(sql, ADMIN)}`;
    const res = await POST(req({ cookie, body: validEvent }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'unknown_term' });
    expect(await db.select().from(events).where(eq(events.slug, 'hardening-test'))).toHaveLength(0);
  });
});

describe('occurrence overrides', () => {
  let eid: typeof events.$inferSelect;
  beforeAll(async () => {
    [eid] = await db.select().from(events).where(eq(events.slug, 'eid-al-fitr'));
  });

  it('an override for (eid-al-fitr, 2027) is returned as confirmed', () => {
    const override = {
      eventId: eid.id,
      year: 2027,
      startDate: '2027-03-10',
      status: 'confirmed' as const,
      sourceUrl: null,
      updatedAt: new Date(),
    };
    const before = resolveOccurrences(eid, [], '2027-01-01', 12).filter((o) => o.start.startsWith('2027'));
    expect(before[0].status).toBe('estimated');
    const after = resolveOccurrences(eid, [override], '2027-01-01', 12);
    expect(after.find((o) => o.start === '2027-03-10')).toMatchObject({ status: 'confirmed' });
  });
});

describe('resolveOccurrences with an impossible Hijri day', () => {
  it('skips occurrences whose day does not exist instead of throwing', () => {
    // Find a Hijri month in 1448 that has only 29 days.
    let month = 0;
    for (let m = 1; m <= 12 && !month; m++) {
      try {
        hijriToGregorian(1448, m, 30);
      } catch {
        month = m;
      }
    }
    expect(month).toBeGreaterThan(0);
    const start = hijriToGregorian(1448, month, 1).toISOString().slice(0, 10);
    const ev = {
      id: 'x',
      recurrence: 'hijri_fixed',
      hMonth: month,
      hDay: 30,
      gMonth: null,
      gDay: null,
      durationDays: 1,
    } as unknown as typeof events.$inferSelect;
    let out: ReturnType<typeof resolveOccurrences> = [];
    expect(() => (out = resolveOccurrences(ev, [], start, 12))).not.toThrow();
    const day29 = hijriToGregorian(1448, month, 29).toISOString().slice(0, 10);
    expect(out.some((o) => o.start === day29)).toBe(false);
  });
});

describe('eventInputSchema', () => {
  const base = {
    slug: 'test-event',
    titleAr: 'عنوان',
    titleEn: 'Title',
    kind: 'national',
    recurrence: 'gregorian_fixed',
    gMonth: 2,
    gDay: 29,
    durationDays: 1,
    prepDays: 14,
    active: true,
    tags: [{ termId: 1, weight: 3 }],
  };
  const ok = (o: object) => eventInputSchema.safeParse({ ...base, ...o }).success;

  it('accepts a valid event', () => expect(ok({})).toBe(true));
  it('validates gregorian month/day', () => {
    expect(ok({ gMonth: 13 })).toBe(false);
    expect(ok({ gMonth: 0 })).toBe(false);
    expect(ok({ gMonth: 4, gDay: 31 })).toBe(false);
    expect(ok({ gMonth: 2, gDay: 30 })).toBe(false);
    expect(ok({ gMonth: null })).toBe(false);
  });
  it('validates hijri month/day', () => {
    const h = { recurrence: 'hijri_fixed', gMonth: null, gDay: null };
    expect(ok({ ...h, hMonth: 9, hDay: 30 })).toBe(true);
    expect(ok({ ...h, hMonth: 13, hDay: 1 })).toBe(false);
    expect(ok({ ...h, hMonth: 9, hDay: 31 })).toBe(false);
    expect(ok({ ...h, hMonth: 9, hDay: 0 })).toBe(false);
  });
  it('validates weights, source url and title length', () => {
    expect(ok({ tags: [{ termId: 1, weight: 4 }] })).toBe(false);
    expect(ok({ tags: [{ termId: 1, weight: 0 }] })).toBe(false);
    expect(ok({ sourceUrl: 'http://example.com' })).toBe(false);
    expect(ok({ sourceUrl: 'javascript:alert(1)' })).toBe(false);
    expect(ok({ sourceUrl: 'https://example.com/x' })).toBe(true);
    expect(ok({ titleAr: 'ا'.repeat(201) })).toBe(false);
    expect(ok({ titleEn: 'a'.repeat(201) })).toBe(false);
  });
});
