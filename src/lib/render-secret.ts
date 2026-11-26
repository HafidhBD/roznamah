import { timingSafeEqual } from 'node:crypto';

/** True only when RENDER_SECRET is set and `given` equals it (constant-time comparison). */
export function renderSecretMatches(given: string | null | undefined): boolean {
  const secret = process.env.RENDER_SECRET;
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
