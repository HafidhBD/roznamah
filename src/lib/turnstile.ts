/** Cloudflare Turnstile: required only when TURNSTILE_SECRET_KEY is set. */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const turnstileRequired = () => Boolean(process.env.TURNSTILE_SECRET_KEY);
/** Public site key for the widget, or null when the check is off. */
export const turnstileSiteKey = () =>
  turnstileRequired() ? process.env.TURNSTILE_SITE_KEY || null : null;

/** True when the check is off, or Cloudflare accepts `token`. Network errors fail closed. */
export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
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
