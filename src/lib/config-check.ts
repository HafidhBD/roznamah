/**
 * Startup configuration check (app via src/instrumentation.ts, and the worker). Misconfiguration
 * that would otherwise fail silently per request is logged loudly once at boot.
 */
type Env = Record<string, string | undefined>;

export function configProblems(env: Env = process.env): string[] {
  const out: string[] = [];
  const set = (k: string) => Boolean(env[k]?.trim());
  if (env.NODE_ENV === 'production') {
    if (!set('RESEND_API_KEY')) out.push('RESEND_API_KEY is not set: admin sign-in and download emails will fail');
    if (!set('EMAIL_FROM')) out.push('EMAIL_FROM is not set: admin sign-in and download emails will fail');
    if (!set('PRIVACY_EMAIL')) out.push('PRIVACY_EMAIL is not set: /privacy shows a placeholder address');
  }
  const site = set('TURNSTILE_SITE_KEY');
  const secret = set('TURNSTILE_SECRET_KEY');
  if (site !== secret) {
    out.push(
      `${site ? 'TURNSTILE_SITE_KEY' : 'TURNSTILE_SECRET_KEY'} is set without ${site ? 'TURNSTILE_SECRET_KEY' : 'TURNSTILE_SITE_KEY'}: every download request will be refused (captcha_failed) until both are set or both are empty`,
    );
  }
  return out;
}

export function logConfigProblems(who: string, env: Env = process.env): void {
  for (const p of configProblems(env)) console.error(`[${who}] CONFIG ERROR: ${p}`);
}
