/**
 * Startup configuration check (app via src/instrumentation.ts, and the worker). Misconfiguration
 * that would otherwise fail silently per request is logged loudly once at boot.
 */
import { GRAPH_CRED_VARS, MAIL_DRIVERS, explicitMailDriver, graphSender, mailDriver, missingGraphCreds } from '@/lib/mail/env';

type Env = Record<string, string | undefined>;

/** Email driver problems in production: either the MS_* trio and a sender (Graph), or RESEND_API_KEY. Names only, never values. */
function mailProblems(env: Env, set: (k: string) => boolean): string[] {
  const out: string[] = [];
  const fails = 'admin sign-in and download emails will fail';
  const explicit = explicitMailDriver(env);
  if (explicit && !(MAIL_DRIVERS as readonly string[]).includes(explicit)) {
    out.push(`MAIL_DRIVER must be graph, resend or memory: the driver is picked from the credentials instead`);
  } else if (explicit === 'memory') {
    out.push('MAIL_DRIVER=memory is ignored in production: the driver is picked from the credentials instead');
  }
  const missing = missingGraphCreds(env);
  const driver = mailDriver(env);
  if (driver === 'graph') {
    if (missing.length) out.push(`MAIL_DRIVER=graph but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not set: ${fails}`);
    if (!graphSender(env)) out.push(`MAIL_GRAPH_SENDER is not set and EMAIL_FROM holds no address: Microsoft Graph has no mailbox to send as, ${fails}`);
  } else if (driver === 'resend') {
    if (!set('RESEND_API_KEY')) out.push(`MAIL_DRIVER=resend but RESEND_API_KEY is not set: ${fails}`);
    if (missing.length && missing.length < GRAPH_CRED_VARS.length && explicit !== 'resend') {
      out.push(`${GRAPH_CRED_VARS.filter((k) => !missing.includes(k)).join(', ')} set without ${missing.join(', ')}: Microsoft Graph is not used, mail goes through Resend`);
    }
  } else {
    const partial = missing.length < GRAPH_CRED_VARS.length ? ` (missing ${missing.join(', ')})` : '';
    out.push(`no email driver: set MS_TENANT_ID, MS_CLIENT_ID and MS_CLIENT_SECRET (Microsoft 365; sender MAIL_GRAPH_SENDER or EMAIL_FROM)${partial}, or RESEND_API_KEY: ${fails}`);
  }
  return out;
}

export function configProblems(env: Env = process.env): string[] {
  const out: string[] = [];
  const set = (k: string) => Boolean(env[k]?.trim());
  if (env.NODE_ENV === 'production') {
    out.push(...mailProblems(env, set));
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
