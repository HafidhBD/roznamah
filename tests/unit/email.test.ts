import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadEmail, memoryTransport, notifyNewLead, outbox, outboxExposed, sendDownloadEmail } from '@/lib/email';

beforeEach(() => {
  vi.stubEnv('EMAIL_TRANSPORT', 'memory');
  vi.stubEnv('APP_URL', 'https://roznamah.test/');
  vi.stubEnv('EMAIL_FROM', 'Roznamah <no-reply@roznamah.test>');
  outbox.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe('download email', () => {
  it('Arabic: exact subject, RTL HTML with logo, button link, 7-day note and a plain-text part', async () => {
    const link = 'https://roznamah.test/download/abc';
    await sendDownloadEmail('a@b.sa', 'ar', link, 'شركة <ويفز>');
    expect(outbox).toHaveLength(1);
    const m = outbox[0];
    expect(m.from).toBe('Roznamah <no-reply@roznamah.test>');
    expect(m.to).toEqual(['a@b.sa']);
    expect(m.subject).toBe('تقويم شركة <ويفز> جاهز للتحميل');
    expect(m.html).toContain('<html lang="ar" dir="rtl">');
    expect(m.html).toContain('src="https://roznamah.test/brand/waves.png"');
    expect(m.html).toContain(`href="${link}"`);
    expect(m.html).toContain('شركة &lt;ويفز&gt;'); // escaped
    expect(m.html).not.toContain('<ويفز>');
    expect(m.html).toContain('7 أيام');
    expect(m.text).toContain(link);
    expect(m.text).toContain('7 أيام');
  });

  it('EMAIL_TRANSPORT=memory is ignored in production (real transport is used)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(memoryTransport()).toBe(false);
    await expect(sendDownloadEmail('a@b.sa', 'ar', 'https://x/download/t', 'Org')).rejects.toThrow('RESEND_API_KEY');
    expect(outbox).toHaveLength(0);
  });

  it('production without EMAIL_FROM fails clearly instead of sending from a placeholder', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', '');
    await expect(sendDownloadEmail('a@b.sa', 'ar', 'https://x/download/t', 'Org')).rejects.toThrow('EMAIL_FROM is not set');
  });

  it('control characters never reach the subject', () => {
    expect(downloadEmail('ar', 'https://x/download/t', 'Org\r\nBcc: x@evil.test').subject).toBe('تقويم OrgBcc: x@evil.test جاهز للتحميل');
  });

  it('English is LTR', () => {
    const { subject, html } = downloadEmail('en', 'https://x/download/t', 'Acme');
    expect(subject).toBe('Your Acme calendar is ready to download');
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('7 days');
  });

  it('the outbox is exposed only outside production with memory transport or NODE_ENV=test', () => {
    expect(outboxExposed()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(outboxExposed()).toBe(false);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('EMAIL_TRANSPORT', '');
    expect(outboxExposed()).toBe(false);
  });
});

describe('notifyNewLead', () => {
  const lead = {
    email: 'a@b.sa',
    orgName: 'Org',
    sector: 'private',
    fields: ['health'],
    phone: null,
    formats: [{ kind: 'wall', size: 'A4', bleed: true }] as const,
  };

  it('does nothing without LEAD_NOTIFY_EMAILS, otherwise emails the team', async () => {
    vi.stubEnv('LEAD_NOTIFY_EMAILS', '');
    await notifyNewLead({ ...lead, formats: [...lead.formats] });
    expect(outbox).toHaveLength(0);
    vi.stubEnv('LEAD_NOTIFY_EMAILS', 'sales@waves.test, ops@waves.test');
    await notifyNewLead({ ...lead, formats: [...lead.formats] });
    expect(outbox[0].to).toEqual(['sales@waves.test', 'ops@waves.test']);
    expect(outbox[0].text).toContain('A4 (bleed)');
  });

  it('never throws when sending fails', async () => {
    vi.stubEnv('LEAD_NOTIFY_EMAILS', 'sales@waves.test');
    vi.stubEnv('EMAIL_TRANSPORT', '');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('NODE_ENV', 'production'); // no key in production → send throws
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(notifyNewLead({ ...lead, formats: [...lead.formats] })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
