import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphAuth, GraphAuthError } from '@/lib/mail/graph-auth';
import { GraphMailClient, GraphMailError } from '@/lib/mail/graph-mail';
import { graphBaseUrls, graphCreds, graphSender, mailDriver, saveToSent } from '@/lib/mail/env';
import { downloadEmail, memoryTransport, notifyNewLead, outbox, outboxExposed, sendDownloadEmail, sendEmail } from '@/lib/email';
import { startFakeGraph, type FakeGraph, type FakeGraphOptions } from '../helpers/fake-graph';

const CREDS = { tenantId: 'tenant-1', clientId: 'client-1', clientSecret: 's3cret-value' };
const SENDER = 'calendar@waves.test';

let fake: FakeGraph | undefined;
afterEach(async () => {
  await fake?.close();
  fake = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const start = async (over: Partial<FakeGraphOptions> = {}) => (fake = await startFakeGraph({ ...CREDS, mailboxes: [SENDER], ...over }));
const caught = async <E = GraphMailError>(p: Promise<unknown>): Promise<E> => {
  try {
    await p;
  } catch (e) {
    return e as E;
  }
  throw new Error('expected an error');
};

describe('GraphAuth (app-only token)', () => {
  const auth = (over: Partial<ConstructorParameters<typeof GraphAuth>[0]> = {}) =>
    new GraphAuth({ ...CREDS, loginBaseUrl: fake!.url, timeoutMs: 2000, ...over });

  it('asks for a client-credentials token for the Graph default scope, at the tenant endpoint', async () => {
    await start();
    await auth().token();
    expect(fake!.requests).toEqual(['POST /tenant-1/oauth2/v2.0/token']);
    expect(fake!.tokenRequests).toEqual([
      { client_id: 'client-1', client_secret: 's3cret-value', scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' },
    ]);
  });

  it('caches the token; concurrent cold callers share one request', async () => {
    await start({ delayMs: 50 });
    const a = auth();
    const [t1, t2, t3] = await Promise.all([a.token(), a.token(), a.token()]);
    expect(new Set([t1, t2, t3]).size).toBe(1);
    expect(await a.token()).toBe(t1);
    expect(fake!.tokenRequests).toHaveLength(1);
  });

  it('refreshes a token within 5 minutes of expiry', async () => {
    await start({ expiresIn: 299 });
    const a = auth();
    const t1 = await a.token();
    const t2 = await a.token();
    expect(t2).not.toBe(t1);
    expect(fake!.tokenRequests).toHaveLength(2);
  });

  it('keeps a token that is valid for longer than the margin, until Date.now passes it', async () => {
    await start({ expiresIn: 301 });
    const a = auth();
    const t1 = await a.token();
    expect(await a.token()).toBe(t1);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 2000);
    expect(await a.token()).not.toBe(t1);
    expect(fake!.tokenRequests).toHaveLength(2);
  });

  it('a bad secret: GraphAuthError with the AADSTS first line, never the secret; not cached', async () => {
    await start();
    const a = auth({ clientSecret: 'wrong-secret-xyz' });
    const e = await caught<GraphAuthError>(a.token());
    expect(e).toBeInstanceOf(GraphAuthError);
    expect(e.status).toBe(401);
    expect(e.message).toBe('invalid_client: AADSTS7000215: Invalid client secret provided.');
    expect(e.message).not.toContain('wrong-secret-xyz');
    await caught(a.token());
    expect(fake!.tokenRequests).toHaveLength(2);
  });

  it('times out instead of hanging', async () => {
    await start({ delayMs: 400 });
    const e = await caught<GraphAuthError>(auth({ timeoutMs: 100 }).token());
    expect(e.network).toBe(true);
    expect(e.message).toContain('100 ms');
  });
});

describe('GraphMailClient', () => {
  const client = (over: Partial<ConstructorParameters<typeof GraphMailClient>[0]> = {}) =>
    new GraphMailClient({ ...CREDS, sender: SENDER, saveToSentItems: false, loginBaseUrl: fake!.url, graphBaseUrl: fake!.url, timeoutMs: 2000, ...over });

  it('posts subject, HTML body, toRecipients and saveToSentItems to /users/{sender}/sendMail', async () => {
    await start();
    await client().send({ to: ['A@b.sa', 'c@d.sa'], subject: 'تقويمك جاهز', html: '<p>رابط</p>', text: 'رابط' });
    expect(fake!.requests[1]).toBe(`POST /v1.0/users/${encodeURIComponent(SENDER)}/sendMail`);
    expect(fake!.sent).toHaveLength(1);
    const { mailbox, body } = fake!.sent[0]!;
    expect(mailbox).toBe(SENDER);
    expect(body).toEqual({
      message: {
        subject: 'تقويمك جاهز',
        body: { contentType: 'HTML', content: '<p>رابط</p>' },
        toRecipients: [{ emailAddress: { address: 'A@b.sa' } }, { emailAddress: { address: 'c@d.sa' } }],
      },
      saveToSentItems: false,
    });
  });

  it('plain text without HTML; saveToSentItems true when asked', async () => {
    await start();
    await client({ saveToSentItems: true }).send({ to: ['a@b.sa'], subject: 's', text: 'نص' });
    expect(fake!.sent[0]!.body.message.body).toEqual({ contentType: 'Text', content: 'نص' });
    expect(fake!.sent[0]!.body.saveToSentItems).toBe(true);
  });

  it('reuses one token across sends', async () => {
    await start();
    const c = client();
    await c.send({ to: ['a@b.sa'], subject: '1', text: '1' });
    await c.send({ to: ['a@b.sa'], subject: '2', text: '2' });
    expect(fake!.tokenRequests).toHaveLength(1);
    expect(fake!.sent).toHaveLength(2);
  });

  it('on a 401 drops the token, logs in again and retries once', async () => {
    await start({ rejectTokens: 1 });
    await client().send({ to: ['a@b.sa'], subject: 'x', text: 'x' });
    expect(fake!.tokenRequests).toHaveLength(2);
    expect(fake!.sent).toHaveLength(1);
  });

  it('a second 401 is an error, not a retry loop', async () => {
    await start({ rejectTokens: 5 });
    const e = await caught(client().send({ to: ['a@b.sa'], subject: 'x', text: 'x' }));
    expect(e.status).toBe(401);
    expect(e.message).toContain('InvalidAuthenticationToken');
    expect(fake!.tokenRequests).toHaveLength(2);
  });

  it('a bad secret is an auth error that never contains the secret or a token', async () => {
    await start();
    const e = await caught(client({ clientSecret: 'wrong-secret-xyz' }).send({ to: ['a@b.sa'], subject: 'x', text: 'x' }));
    expect(e).toBeInstanceOf(GraphMailError);
    expect(e.kind).toBe('auth');
    expect(e.message).toContain('invalid_client');
    expect(e.message).not.toContain('wrong-secret-xyz');
    expect(e.message).not.toContain('s3cret-value');
    expect(fake!.sent).toHaveLength(0);
  });

  it('Graph errors carry the code and status (unknown mailbox, missing Mail.Send, throttling) without secrets', async () => {
    await start();
    const e1 = await caught(client({ sender: 'nobody@waves.test' }).send({ to: ['a@b.sa'], subject: 'x', text: 'x' }));
    expect([e1.kind, e1.status]).toEqual(['send', 404]);
    expect(e1.message).toContain('ErrorInvalidUser');
    await fake!.close();
    await start({ sendError: { status: 403, code: 'ErrorAccessDenied', message: 'Access is denied.' } });
    const e2 = await caught(client().send({ to: ['a@b.sa'], subject: 'x', text: 'x' }));
    expect(e2.status).toBe(403);
    expect(e2.message).toContain('ErrorAccessDenied');
    expect(e2.retryable).toBe(false);
    await fake!.close();
    await start({ sendError: { status: 429, code: 'ApplicationThrottled', message: 'Too many requests' } });
    const e3 = await caught(client().send({ to: ['a@b.sa'], subject: 'x', text: 'x' }));
    expect(e3.retryable).toBe(true);
    for (const e of [e1, e2, e3]) {
      expect(e.message).not.toContain('s3cret-value');
      expect(e.message).not.toMatch(/Bearer/);
    }
  });

  it('times out instead of hanging, and an unreachable host is a network error', async () => {
    await start({ delayMs: 400 });
    const e = await caught(client({ timeoutMs: 100 }).send({ to: ['a@b.sa'], subject: 'x', text: 'x' }));
    expect(e.kind).toBe('network');
    expect(e.retryable).toBe(true);
    const e2 = await caught(client({ loginBaseUrl: 'http://127.0.0.1:1', graphBaseUrl: 'http://127.0.0.1:1' }).send({ to: ['a@b.sa'], subject: 'x', text: 'x' }));
    expect(e2.kind).toBe('network');
    expect(e2.message).not.toContain('s3cret-value');
  });
});

describe('driver selection (MAIL_DRIVER)', () => {
  const ms = { MS_TENANT_ID: 't', MS_CLIENT_ID: 'c', MS_CLIENT_SECRET: 's' };
  it('defaults: graph with the full MS trio, else resend with a key, else none', () => {
    expect(mailDriver({ ...ms, RESEND_API_KEY: 're_x' })).toBe('graph');
    expect(mailDriver({ MS_TENANT_ID: 't', MS_CLIENT_ID: 'c', RESEND_API_KEY: 're_x' })).toBe('resend');
    expect(mailDriver({ MS_TENANT_ID: 't', MS_CLIENT_ID: 'c', MS_CLIENT_SECRET: ' ' })).toBeNull();
    expect(mailDriver({})).toBeNull();
  });
  it('an explicit MAIL_DRIVER wins over the credentials', () => {
    expect(mailDriver({ ...ms, RESEND_API_KEY: 're_x', MAIL_DRIVER: 'resend' })).toBe('resend');
    expect(mailDriver({ RESEND_API_KEY: 're_x', MAIL_DRIVER: 'GRAPH' })).toBe('graph');
  });
  it('memory (MAIL_DRIVER or EMAIL_TRANSPORT) outside production only', () => {
    expect(mailDriver({ ...ms, EMAIL_TRANSPORT: 'memory' })).toBe('memory');
    expect(mailDriver({ MAIL_DRIVER: 'memory' })).toBe('memory');
    expect(mailDriver({ ...ms, NODE_ENV: 'production', EMAIL_TRANSPORT: 'memory' })).toBe('graph');
    expect(mailDriver({ RESEND_API_KEY: 'k', NODE_ENV: 'production', MAIL_DRIVER: 'memory' })).toBe('resend');
  });
  it('the Graph sender is MAIL_GRAPH_SENDER, else the address inside EMAIL_FROM', () => {
    expect(graphSender({ MAIL_GRAPH_SENDER: 'box@x.sa', EMAIL_FROM: 'R <no-reply@x.sa>' })).toBe('box@x.sa');
    expect(graphSender({ EMAIL_FROM: 'Roznamah <no-reply@x.sa>' })).toBe('no-reply@x.sa');
    expect(graphSender({ EMAIL_FROM: 'no-reply@x.sa' })).toBe('no-reply@x.sa');
    expect(graphSender({ EMAIL_FROM: 'Roznamah' })).toBeUndefined();
  });
  it('saveToSent defaults off; base URL overrides are ignored in production', () => {
    expect(saveToSent({})).toBe(false);
    expect(saveToSent({ MAIL_SAVE_TO_SENT: 'true' })).toBe(true);
    expect(graphCreds({ ...ms })).toEqual({ tenantId: 't', clientId: 'c', clientSecret: 's' });
    expect(graphBaseUrls({ MS_GRAPH_BASE_URL: 'http://g', MS_LOGIN_BASE_URL: 'http://l' })).toEqual({ graphBaseUrl: 'http://g', loginBaseUrl: 'http://l' });
    expect(graphBaseUrls({ NODE_ENV: 'production', MS_GRAPH_BASE_URL: 'http://g' })).toEqual({});
  });
});

describe('sendEmail through the Graph driver', () => {
  beforeEach(async () => {
    await start({ mailboxes: [SENDER, 'no-reply@roznamah.test'] });
    vi.stubEnv('EMAIL_TRANSPORT', '');
    vi.stubEnv('MAIL_DRIVER', '');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('MS_TENANT_ID', CREDS.tenantId);
    vi.stubEnv('MS_CLIENT_ID', CREDS.clientId);
    vi.stubEnv('MS_CLIENT_SECRET', CREDS.clientSecret);
    vi.stubEnv('MS_LOGIN_BASE_URL', fake!.url);
    vi.stubEnv('MS_GRAPH_BASE_URL', fake!.url);
    vi.stubEnv('MAIL_GRAPH_SENDER', SENDER);
    vi.stubEnv('MAIL_SAVE_TO_SENT', '');
    vi.stubEnv('EMAIL_FROM', 'Roznamah <no-reply@roznamah.test>');
    vi.stubEnv('APP_URL', 'https://roznamah.test');
    outbox.length = 0;
  });

  it('download email: escaped HTML and a control-free subject go to Graph, not the outbox', async () => {
    expect(memoryTransport()).toBe(false);
    expect(outboxExposed()).toBe(true); // NODE_ENV=test
    await sendDownloadEmail('a@b.sa', 'ar', 'https://roznamah.test/download/abc', 'شركة <ويفز>\r\nBcc: x@evil.test');
    expect(outbox).toHaveLength(0);
    const { mailbox, body } = fake!.sent[0]!;
    expect(mailbox).toBe(SENDER);
    const expected = downloadEmail('ar', 'https://roznamah.test/download/abc', 'شركة <ويفز>\r\nBcc: x@evil.test');
    expect(body.message.subject).toBe(expected.subject);
    expect(body.message.subject).not.toMatch(/[\r\n]/);
    expect(body.message.body).toEqual({ contentType: 'HTML', content: expected.html });
    expect(body.message.body.content).toContain('شركة &lt;ويفز&gt;');
    expect(body.message.toRecipients).toEqual([{ emailAddress: { address: 'a@b.sa' } }]);
    expect(body.saveToSentItems).toBe(false);
  });

  it('lead notifications go through Graph; MAIL_SAVE_TO_SENT=true is honoured', async () => {
    vi.stubEnv('LEAD_NOTIFY_EMAILS', 'sales@waves.test, ops@waves.test');
    vi.stubEnv('MAIL_SAVE_TO_SENT', 'true');
    await notifyNewLead({ email: 'a@b.sa', orgName: 'Org', sector: null, fields: [], phone: null, formats: [{ kind: 'wall', size: 'A4', bleed: false }] });
    const { body } = fake!.sent[0]!;
    expect(body.message.toRecipients.map((r) => r.emailAddress.address)).toEqual(['sales@waves.test', 'ops@waves.test']);
    expect(body.saveToSentItems).toBe(true);
  });

  it('the sender falls back to the address in EMAIL_FROM', async () => {
    vi.stubEnv('MAIL_GRAPH_SENDER', '');
    await sendEmail({ to: ['a@b.sa'], subject: 's', html: '<p>h</p>', text: 't' });
    expect(fake!.sent[0]!.mailbox).toBe('no-reply@roznamah.test');
  });

  it('the client (and its token) is reused across sends while the config is unchanged', async () => {
    await sendEmail({ to: ['a@b.sa'], subject: '1', html: '1', text: '1' });
    await sendEmail({ to: ['a@b.sa'], subject: '2', html: '2', text: '2' });
    expect(fake!.tokenRequests).toHaveLength(1);
    expect(fake!.sent).toHaveLength(2);
  });

  it('works in production without RESEND_API_KEY; a wrong secret fails without leaking it', async () => {
    // Production ignores the base URL overrides, so stub fetch to route Microsoft hosts to the fake.
    vi.stubEnv('NODE_ENV', 'production');
    const real = globalThis.fetch;
    const seen: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const u = new URL(String(input));
      seen.push(u.host);
      return real(`${fake!.url}${u.pathname}${u.search}`, init);
    });
    await sendEmail({ to: ['a@b.sa'], subject: 's', html: '<p>h</p>', text: 't' });
    expect(seen).toEqual(['login.microsoftonline.com', 'graph.microsoft.com']);
    expect(fake!.sent).toHaveLength(1);
    vi.stubEnv('MS_CLIENT_SECRET', 'wrong-secret-xyz');
    const e = await caught<Error>(sendEmail({ to: ['a@b.sa'], subject: 's', html: 'h', text: 't' }));
    expect(e.message).toContain('Microsoft login failed');
    expect(e.message).not.toContain('wrong-secret-xyz');
  });

  it('MAIL_DRIVER=graph without credentials names what is missing (never values)', async () => {
    vi.stubEnv('MAIL_DRIVER', 'graph');
    vi.stubEnv('MS_CLIENT_SECRET', '');
    vi.stubEnv('MS_TENANT_ID', '');
    const e = await caught<Error>(sendEmail({ to: ['a@b.sa'], subject: 's', html: 'h', text: 't' }));
    expect(e.message).toBe('MAIL_DRIVER=graph needs MS_TENANT_ID, MS_CLIENT_SECRET');
    expect(e.message).not.toContain(CREDS.clientId);
  });

  it('EMAIL_TRANSPORT=memory still wins outside production (tests / e2e)', async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'memory');
    await sendEmail({ to: ['a@b.sa'], subject: 's', html: 'h', text: 't' });
    expect(outbox).toHaveLength(1);
    expect(fake!.sent).toHaveLength(0);
  });
});
