/**
 * Which email driver sends mail, read from the environment (pure: shared by src/lib/email.ts,
 * src/lib/auth.ts and the startup config check).
 *
 * MAIL_DRIVER = graph | resend | memory. Unset: `graph` when MS_TENANT_ID, MS_CLIENT_ID and
 * MS_CLIENT_SECRET are all set, else `resend` when RESEND_API_KEY is set, else none (dev logs to the
 * console; production fails). `memory` (or the older EMAIL_TRANSPORT=memory) records mail in-process
 * for tests and is ignored in production.
 */
type Env = Record<string, string | undefined>;

export type MailDriver = 'graph' | 'resend' | 'memory';
export const MAIL_DRIVERS: readonly MailDriver[] = ['graph', 'resend', 'memory'];
export const GRAPH_CRED_VARS = ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET'] as const;

const val = (env: Env, k: string) => env[k]?.trim() || undefined;

/** MAIL_DRIVER as written (lowercased), or undefined when empty. */
export const explicitMailDriver = (env: Env = process.env) => val(env, 'MAIL_DRIVER')?.toLowerCase();

/** Memory requested via MAIL_DRIVER=memory or EMAIL_TRANSPORT=memory (whatever NODE_ENV says). */
export const memoryRequested = (env: Env = process.env) =>
  env.EMAIL_TRANSPORT === 'memory' || explicitMailDriver(env) === 'memory';

export function mailDriver(env: Env = process.env): MailDriver | null {
  const prod = env.NODE_ENV === 'production';
  if (!prod && memoryRequested(env)) return 'memory';
  const explicit = explicitMailDriver(env);
  if (explicit === 'graph' || explicit === 'resend') return explicit;
  if (graphCreds(env)) return 'graph';
  if (val(env, 'RESEND_API_KEY')) return 'resend';
  return null;
}

/** The MS_* credential names that are empty. */
export const missingGraphCreds = (env: Env = process.env) => GRAPH_CRED_VARS.filter((k) => !val(env, k));

export function graphCreds(env: Env = process.env): { tenantId: string; clientId: string; clientSecret: string } | null {
  if (missingGraphCreds(env).length) return null;
  return { tenantId: val(env, 'MS_TENANT_ID')!, clientId: val(env, 'MS_CLIENT_ID')!, clientSecret: val(env, 'MS_CLIENT_SECRET')! };
}

/** The mailbox Graph sends as: MAIL_GRAPH_SENDER, else the address in EMAIL_FROM ("Name <a@b>" or "a@b"). */
export function graphSender(env: Env = process.env): string | undefined {
  const explicit = val(env, 'MAIL_GRAPH_SENDER');
  if (explicit) return explicit;
  const from = env.EMAIL_FROM ?? '';
  const m = /<([^<>\s]+@[^<>\s]+)>\s*$/.exec(from) ?? /^\s*([^<>\s]+@[^<>\s]+)\s*$/.exec(from);
  return m?.[1];
}

/** MAIL_SAVE_TO_SENT=true keeps a copy in the sender's Sent Items (default off: magic links would pile up). */
export const saveToSent = (env: Env = process.env) => val(env, 'MAIL_SAVE_TO_SENT')?.toLowerCase() === 'true';

/** Test-only endpoint overrides (MS_LOGIN_BASE_URL / MS_GRAPH_BASE_URL); ignored in production. */
export function graphBaseUrls(env: Env = process.env): { loginBaseUrl?: string; graphBaseUrl?: string } {
  if (env.NODE_ENV === 'production') return {};
  return { loginBaseUrl: val(env, 'MS_LOGIN_BASE_URL'), graphBaseUrl: val(env, 'MS_GRAPH_BASE_URL') };
}
