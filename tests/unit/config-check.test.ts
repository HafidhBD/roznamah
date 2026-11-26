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
