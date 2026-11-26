/**
 * Outgoing email. Every message goes through one driver (src/lib/mail/env.ts):
 * - `graph`: Microsoft 365 via Microsoft Graph sendMail (app-only token; MS_TENANT_ID, MS_CLIENT_ID,
 *   MS_CLIENT_SECRET, sender MAIL_GRAPH_SENDER or the address in EMAIL_FROM). Graph sends as that
 *   mailbox, so the display name recipients see is the mailbox's own, not the name in EMAIL_FROM.
 * - `resend`: RESEND_API_KEY, From = EMAIL_FROM.
 * - `memory` (MAIL_DRIVER=memory or EMAIL_TRANSPORT=memory): an in-process outbox (tests / e2e, read via
 *   GET /api/test/outbox); never in production.
 * Without any driver outside production, messages are logged to the console so local dev still works.
 */
import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import { t, type Lang } from '@/i18n/core';
import type { FormatRequest, LeadRow } from '@/db/schema';
import { GraphMailClient } from '@/lib/mail/graph-mail';
import { graphBaseUrls, graphCreds, graphSender, mailDriver, memoryRequested, missingGraphCreds, saveToSent } from '@/lib/mail/env';

export type OutgoingEmail = { from: string; to: string[]; subject: string; html: string; text: string };
export type SentEmail = OutgoingEmail & { at: string };

const globalForEmail = globalThis as unknown as {
  __roznamahOutbox?: SentEmail[];
  __roznamahResend?: { key: string; client: Resend };
  __roznamahGraph?: { key: string; client: GraphMailClient };
};
/** In-memory outbox (one per server process; shared across route bundles via globalThis). */
export const outbox: SentEmail[] = (globalForEmail.__roznamahOutbox ??= []);

/** In-memory transport; never in production, whatever MAIL_DRIVER / EMAIL_TRANSPORT say. */
export const memoryTransport = () => mailDriver() === 'memory';

/** Removes control characters (C0 incl. CR/LF and tab, DEL, C1). */
export const stripControl = (s: string) => s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
/** GET /api/test/outbox exists only for tests / memory transport, never in production. */
export const outboxExposed = () =>
  process.env.NODE_ENV !== 'production' && (process.env.NODE_ENV === 'test' || memoryTransport());

const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
/** Sender address. Required in production: never send from a placeholder. */
export function emailFrom(): string {
  const v = process.env.EMAIL_FROM?.trim();
  if (v) return v;
  if (process.env.NODE_ENV === 'production') throw new Error('EMAIL_FROM is not set');
  return 'Roznamah <no-reply@example.com>';
}

/** The Graph client for the current env, reused (with its cached token) while the config is unchanged. */
function graphClient(): GraphMailClient {
  const creds = graphCreds();
  if (!creds) throw new Error(`MAIL_DRIVER=graph needs ${missingGraphCreds().join(', ')}`);
  const sender = graphSender();
  if (!sender) throw new Error('MAIL_DRIVER=graph needs MAIL_GRAPH_SENDER (or an address in EMAIL_FROM)');
  const cfg = { ...creds, sender, saveToSentItems: saveToSent(), ...graphBaseUrls() };
  // Hash so the secret is not kept as a readable cache key.
  const key = createHash('sha256').update(JSON.stringify(cfg)).digest('hex');
  const cached = globalForEmail.__roznamahGraph;
  if (cached?.key === key) return cached.client;
  const client = new GraphMailClient(cfg);
  globalForEmail.__roznamahGraph = { key, client };
  return client;
}

function resendClient(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const cached = globalForEmail.__roznamahResend;
  if (cached?.key === key) return cached.client;
  const client = new Resend(key);
  globalForEmail.__roznamahResend = { key, client };
  return client;
}

export async function sendEmail(msg: Omit<OutgoingEmail, 'from'>): Promise<void> {
  const email: OutgoingEmail = { from: emailFrom(), ...msg, subject: stripControl(msg.subject) };
  if (memoryRequested() && process.env.NODE_ENV === 'production') {
    console.warn('[email] memory transport (MAIL_DRIVER / EMAIL_TRANSPORT) is ignored in production');
  }
  const driver = mailDriver();
  if (driver === 'memory') {
    outbox.push({ ...email, at: new Date().toISOString() });
    return;
  }
  if (driver === 'graph') {
    await graphClient().send({ to: email.to, subject: email.subject, html: email.html, text: email.text });
    return;
  }
  if (driver === 'resend') {
    const { error } = await resendClient().emails.send(email);
    if (error) throw new Error(`resend: ${error.name}: ${error.message}`);
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('no email driver: set MS_TENANT_ID, MS_CLIENT_ID and MS_CLIENT_SECRET (Microsoft 365), or RESEND_API_KEY');
  }
  console.info(`[email] (no email driver) to=${email.to.join(',')} subject=${email.subject}\n${email.text}`);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

/** Branded, table-based (email-client safe) HTML: logo, heading, big button, validity note. */
export function downloadEmail(lang: Lang, link: string, rawOrgName: string) {
  const orgName = stripControl(rawOrgName).trim();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'right' : 'left';
  const subject = fill(t(lang, 'email.download.subject'), { orgName });
  const heading = fill(t(lang, 'email.download.heading'), { orgName });
  const body = t(lang, 'email.download.body');
  const button = t(lang, 'email.download.button');
  const validity = t(lang, 'email.download.validity');
  const fallback = t(lang, 'email.download.fallback');
  const footer = t(lang, 'email.download.footer');
  const font = "'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif";
  const e = escapeHtml;
  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f3fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3fb;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e7e2f3;font-family:${font};color:#1b1630;text-align:${align};">
<tr><td style="padding:28px 32px 8px;"><img src="${e(appUrl())}/brand/waves.png" alt="Waves" height="36" style="height:36px;width:auto;border:0;display:block;"></td></tr>
<tr><td style="padding:8px 32px 0;"><h1 style="margin:0;font-size:22px;line-height:1.5;font-weight:700;">${e(heading)}</h1></td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.8;color:#4b4566;">${e(body)}</td></tr>
<tr><td align="center" style="padding:28px 32px;">
<a href="${e(link)}" style="display:inline-block;background:#6d3df5;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 40px;border-radius:14px;">${e(button)}</a>
</td></tr>
<tr><td style="padding:0 32px;font-size:13px;line-height:1.8;color:#6b6585;">${e(validity)}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:12px;line-height:1.7;color:#8a85a0;">${e(fallback)}<br><a href="${e(link)}" style="color:#6d3df5;word-break:break-all;" dir="ltr">${e(link)}</a></td></tr>
<tr><td style="padding:24px 32px 28px;font-size:12px;color:#8a85a0;border-top:1px solid #efecf6;margin-top:16px;">${e(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [heading, '', body, '', `${button}: ${link}`, '', validity, '', footer].join('\n');
  return { subject, html, text };
}

export async function sendDownloadEmail(to: string, lang: Lang, link: string, orgName: string): Promise<void> {
  await sendEmail({ to: [to], ...downloadEmail(lang, link, orgName) });
}

export type NewLead = Pick<LeadRow, 'email' | 'orgName' | 'sector' | 'fields' | 'phone'> & {
  formats: FormatRequest[];
};

/** Tells the Waves team about a new lead (LEAD_NOTIFY_EMAILS). Never throws: failures are logged. */
export async function notifyNewLead(lead: NewLead): Promise<void> {
  const to = (process.env.LEAD_NOTIFY_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!to.length) return;
  try {
    const formats = lead.formats.map((f) => `${f.size}${f.bleed ? ' (bleed)' : ''}`).join(', ');
    const rows: [string, string][] = [
      ['Email', lead.email],
      ['Organization', lead.orgName],
      ['Sector', lead.sector ?? '-'],
      ['Fields', lead.fields.join(', ') || '-'],
      ['Phone', lead.phone ?? '-'],
      ['Formats', formats],
    ];
    await sendEmail({
      to,
      subject: `Roznamah lead: ${lead.orgName}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
      html: `<table dir="auto" style="font-family:Arial,sans-serif;font-size:14px">${rows
        .map(([k, v]) => `<tr><th align="left" style="padding:4px 12px 4px 0">${k}</th><td dir="auto">${escapeHtml(v)}</td></tr>`)
        .join('')}</table>`,
    });
  } catch (err) {
    console.error('[email] lead notification failed', err);
  }
}
