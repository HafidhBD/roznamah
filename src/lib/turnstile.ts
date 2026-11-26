/**
 * Cloudflare Turnstile: on when TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are both set, off when
 * both are empty. Only one of the pair set is a misconfiguration: downloads fail closed (logged).
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const siteKey = () => process.env.TURNSTILE_SITE_KEY?.trim() || '';
const secretKey = () => process.env.TURNSTILE_SECRET_KEY?.trim() || '';

export const turnstileRequired = () => Boolean(siteKey() || secretKey());
const misconfigured = () => Boolean(siteKey()) !== Boolean(secretKey());

/** Public site key for the widget (server-rendered into the studio page), or null when the check is off. */
export const turnstileSiteKey = () => (siteKey() && secretKey() ? siteKey() : null);

/** True when the check is off, or Cloudflare accepts `token`. Network errors and half-set keys fail closed. */
export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  if (!turnstileRequired()) return true;
  if (misconfigured()) {
    console.error(
      `[turnstile] refusing download: ${siteKey() ? 'TURNSTILE_SECRET_KEY' : 'TURNSTILE_SITE_KEY'} is not set (set both keys, or neither)`,
    );
    return false;
  }
  const secret = secretKey();
  if (!token || token.length > 2048) return false;
  const form = new URLSearchParams({ secret, response: token });
  if (ip !== 'unknown') form.set('remoteip', ip);
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('[turnstile] verification failed', err);
    return false;
  }
}
