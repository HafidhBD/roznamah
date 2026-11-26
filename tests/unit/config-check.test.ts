import { afterEach, describe, expect, it, vi } from 'vitest';
import { configProblems } from '@/lib/config-check';
import { turnstileSiteKey, verifyTurnstile } from '@/lib/turnstile';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const prod = {
  NODE_ENV: 'production',
  APP_URL: 'https://x.test',
  RESEND_API_KEY: 're_x',
  EMAIL_FROM: 'R <no-reply@x.test>',
  PRIVACY_EMAIL: 'privacy@x.test',
};

describe('configProblems', () => {
  it('a complete production config has no problems', () => {
    expect(configProblems(prod)).toEqual([]);
    expect(configProblems({ ...prod, TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' })).toEqual([]);
  });

  it('flags a missing EMAIL_FROM / RESEND_API_KEY / PRIVACY_EMAIL in production only', () => {
    const p = configProblems({ ...prod, EMAIL_FROM: '', RESEND_API_KEY: '', PRIVACY_EMAIL: '' });
    expect(p.join('\n')).toMatch(/EMAIL_FROM/);
    expect(p.join('\n')).toMatch(/RESEND_API_KEY/);
    expect(p.join('\n')).toMatch(/PRIVACY_EMAIL/);
    expect(configProblems({ NODE_ENV: 'development' })).toEqual([]);
  });

  describe('email driver in production', () => {
    const { RESEND_API_KEY: _key, ...noResend } = prod;
    const ms = { MS_TENANT_ID: 't', MS_CLIENT_ID: 'c', MS_CLIENT_SECRET: 'super-secret-value' };
    const all = (env: Record<string, string>) => configProblems(env).join('\n');

    it('Microsoft Graph alone is complete (sender from MAIL_GRAPH_SENDER or EMAIL_FROM); Resend alone too', () => {
      expect(configProblems({ ...noResend, ...ms })).toEqual([]);
      expect(configProblems({ ...noResend, ...ms, MAIL_GRAPH_SENDER: 'box@x.test', MAIL_DRIVER: 'graph' })).toEqual([]);
      expect(configProblems({ ...prod, MAIL_DRIVER: 'resend' })).toEqual([]);
    });

    it('neither: one error naming both options', () => {
      const p = all(noResend);
      expect(p).toMatch(/no email driver/);
      expect(p).toMatch(/MS_TENANT_ID, MS_CLIENT_ID and MS_CLIENT_SECRET/);
      expect(p).toMatch(/RESEND_API_KEY/);
    });

    it('a partial MS trio names the missing ones, never the values', () => {
      const p = all({ ...noResend, MS_TENANT_ID: 't', MS_CLIENT_SECRET: 'super-secret-value' });
      expect(p).toMatch(/missing MS_CLIENT_ID/);
      expect(p).not.toContain('super-secret-value');
      const q = all({ ...prod, MS_TENANT_ID: 't', MS_CLIENT_SECRET: 'super-secret-value' });
      expect(q).toMatch(/MS_TENANT_ID, MS_CLIENT_SECRET set without MS_CLIENT_ID/);
      expect(q).not.toContain('super-secret-value');
    });

    it('MAIL_DRIVER=graph without credentials, or without a sender', () => {
      expect(all({ ...prod, MAIL_DRIVER: 'graph' })).toMatch(/MAIL_DRIVER=graph but MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET are not set/);
      expect(all({ ...noResend, ...ms, EMAIL_FROM: 'Roznamah' })).toMatch(/MAIL_GRAPH_SENDER is not set/);
    });

    it('MAIL_DRIVER=resend without a key; unknown or memory MAIL_DRIVER', () => {
      expect(all({ ...noResend, ...ms, MAIL_DRIVER: 'resend' })).toMatch(/MAIL_DRIVER=resend but RESEND_API_KEY/);
      expect(all({ ...prod, MAIL_DRIVER: 'smtp' })).toMatch(/MAIL_DRIVER must be graph, resend or memory/);
      expect(all({ ...prod, MAIL_DRIVER: 'memory' })).toMatch(/MAIL_DRIVER=memory is ignored in production/);
    });

    it('not checked outside production', () => {
      expect(configProblems({ NODE_ENV: 'development', MAIL_DRIVER: 'graph' })).toEqual([]);
    });
  });

  it('flags a Turnstile key without its pair', () => {
    expect(configProblems({ ...prod, TURNSTILE_SITE_KEY: 'site' }).join()).toMatch(/TURNSTILE_SECRET_KEY/);
    expect(configProblems({ ...prod, TURNSTILE_SECRET_KEY: 'secret' }).join()).toMatch(/TURNSTILE_SITE_KEY/);
    expect(configProblems({ NODE_ENV: 'development', TURNSTILE_SITE_KEY: 'site' })).toHaveLength(1);
  });
});

describe('Turnstile with only half the key pair', () => {
  it('only a site key: the widget is hidden and downloads fail closed with a server log', async () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', 'site');
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(turnstileSiteKey()).toBeNull();
    expect(await verifyTurnstile('token', '1.2.3.4')).toBe(false);
    expect(err.mock.calls.flat().join(' ')).toMatch(/TURNSTILE_SECRET_KEY/);
  });

  it('only a secret: fails closed with a server log (no fetch)', async () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', '');
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await verifyTurnstile('token', '1.2.3.4')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(err.mock.calls.flat().join(' ')).toMatch(/TURNSTILE_SITE_KEY/);
  });

  it('neither key: the check is off', async () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', '');
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    expect(await verifyTurnstile(undefined, '1.2.3.4')).toBe(true);
    expect(turnstileSiteKey()).toBeNull();
  });

  it('both keys: the site key reaches the client', () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', 'site');
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    expect(turnstileSiteKey()).toBe('site');
  });
});
