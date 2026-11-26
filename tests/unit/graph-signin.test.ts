import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, sql } from '@/db/client';
import { verificationTokens } from '@/db/schema';
import { startFakeGraph, type FakeGraph } from '../helpers/fake-graph';
import { deleteUserByEmail } from '../helpers/admin-session';

const ADMIN = 'graph-admin@waves.sa';
const SENDER = 'calendar@waves.test';
let fake: FakeGraph;

vi.stubEnv('ADMIN_EMAILS', ADMIN);
vi.stubEnv('AUTH_SECRET', 'unit-test-secret');
vi.stubEnv('APP_URL', 'https://app.example.test');

beforeAll(async () => {
  fake = await startFakeGraph({ tenantId: 'tenant-1', clientId: 'client-1', clientSecret: 's3cret', mailboxes: [SENDER] });
});
afterEach(async () => {
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, ADMIN));
});
afterAll(async () => {
  await fake.close();
  await deleteUserByEmail(sql, ADMIN);
  await sql.end();
  vi.unstubAllEnvs();
});

describe('admin magic link through Microsoft Graph', () => {
  it('sends the canonical-origin link via Graph, with no RESEND_API_KEY', async () => {
    vi.stubEnv('EMAIL_TRANSPORT', '');
    vi.stubEnv('MAIL_DRIVER', '');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('MS_TENANT_ID', 'tenant-1');
    vi.stubEnv('MS_CLIENT_ID', 'client-1');
    vi.stubEnv('MS_CLIENT_SECRET', 's3cret');
    vi.stubEnv('MS_LOGIN_BASE_URL', fake.url);
    vi.stubEnv('MS_GRAPH_BASE_URL', fake.url);
    vi.stubEnv('MAIL_GRAPH_SENDER', SENDER);
    vi.stubEnv('EMAIL_FROM', 'Roznamah <no-reply@waves.test>');

    const { handlers } = await import('@/lib/auth');
    const csrf = await handlers.GET(new NextRequest('http://localhost/api/auth/csrf'));
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    const cookie = csrf.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    const res = await handlers.POST(
      new NextRequest('http://localhost/api/auth/signin/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, host: 'evil.example', 'x-forwarded-host': 'evil.example' },
        body: new URLSearchParams({ csrfToken, email: ADMIN, callbackUrl: '/admin' }),
      }),
    );
    expect(res.headers.get('location')).toContain('/api/auth/verify-request');
    expect(fake.sent).toHaveLength(1);
    const { mailbox, body } = fake.sent[0]!;
    expect(mailbox).toBe(SENDER);
    expect(body.message.toRecipients).toEqual([{ emailAddress: { address: ADMIN } }]);
    expect(body.message.body.contentType).toBe('HTML');
    const href = /href="([^"]+)"/.exec(body.message.body.content)![1].replace(/&amp;/g, '&');
    expect(new URL(href).origin).toBe('https://app.example.test');
    expect(href).toContain('/api/auth/callback/resend');
    expect(body.message.body.content).not.toContain('evil.example');
    expect(body.message.body.content).not.toMatch(/href="[^"]*&(?!amp;)/); // query string escaped
  });
});
