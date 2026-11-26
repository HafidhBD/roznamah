/**
 * Email-gated downloads: create (or reuse) a download for a draft, rate limits, status and files.
 * A download freezes the calendar into `snapshot`; the worker renders it to FILES_DIR/<id>/.
 */
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { and, count, eq, gt, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { downloads, leads, type DownloadFile, type DownloadRow, type FormatRequest } from '@/db/schema';
import type { Lang } from '@/i18n/core';
import { notifyNewLead, sendDownloadEmail } from '@/lib/email';
import { pageFormatSchema } from '@/lib/print-sizes';
import { enqueueRender } from '@/lib/queue';
import { buildSnapshot } from '@/lib/snapshot';

export type { FormatRequest };

export const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REUSE_WINDOW_MS = 2 * 60 * 1000;
export const RATE_WINDOW_MS = 60 * 60 * 1000;
export const MAX_PER_EMAIL = 5;
export const MAX_PER_IP = 20;

export class RateLimitError extends Error {
  constructor(public readonly scope: 'email' | 'ip') {
    super(`rate limited (${scope})`);
    this.name = 'RateLimitError';
  }
}
/** The download was created but its email could not be sent (the download is marked failed). */
export class EmailDeliveryError extends Error {
  constructor(cause: unknown) {
    super('download email could not be sent', { cause });
    this.name = 'EmailDeliveryError';
  }
}

// ---- validation (shared by the route and the dialog) ----

/** Saudi mobile: 05XXXXXXXX or +9665XXXXXXXX (spaces and dashes ignored). */
export const SAUDI_PHONE = /^(05\d{8}|\+9665\d{8})$/;
export const normalizePhone = (s: string) => s.replace(/[\s-]/g, '');
export const isSaudiPhone = (s: string) => SAUDI_PHONE.test(normalizePhone(s));

export const formatsSchema = z
  .array(pageFormatSchema)
  .min(1)
  .max(4)
  .transform((list) => {
    const seen = new Set<string>();
    return list.filter((f) => !seen.has(fileName(f)) && Boolean(seen.add(fileName(f))));
  });

export const downloadRequestSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
  orgName: z.string().trim().min(1).max(200),
  sector: z.string().trim().min(1).max(64).nullable().optional(),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((s) => (s ? normalizePhone(s) : undefined))
    .refine((s) => s === undefined || SAUDI_PHONE.test(s), 'invalid'),
  formats: formatsSchema,
  turnstileToken: z.string().max(2048).optional(),
});
export type DownloadRequest = z.infer<typeof downloadRequestSchema>;

// ---- files ----

export const filesDir = () => path.resolve(/*turbopackIgnore: true*/ process.env.FILES_DIR || './var/files');
/** `roznamah-wall-<size>[-bleed].pdf` */
export const fileName = (f: FormatRequest) => `roznamah-wall-${f.size}${f.bleed ? '-bleed' : ''}.pdf`;
export const downloadDir = (downloadId: string) => path.join(/*turbopackIgnore: true*/ filesDir(), downloadId);

const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
export const downloadLink = (token: string) => `${appUrl()}/download/${token}`;
const newToken = () => randomBytes(32).toString('base64url');
const TOKEN = /^[A-Za-z0-9_-]{16,100}$/;

/** Client IP behind Traefik: first X-Forwarded-For entry, else X-Real-IP, else 'unknown'. */
export function clientIp(req: Request): string {
  const first = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = first || req.headers.get('x-real-ip')?.trim();
  return ip ? ip.slice(0, 64) : 'unknown';
}

// ---- create ----

export type CreateDownloadInput = {
  calendarId: string;
  email: string;
  orgName: string;
  sector: string | null;
  fields: string[];
  phone?: string;
  formats: FormatRequest[];
  ip: string;
  /** Language of the email (default Arabic). */
  lang?: Lang;
};

export async function createDownload(input: CreateDownloadInput): Promise<{ token: string; reused: boolean }> {
  const email = input.email.trim().toLowerCase();
  const now = Date.now();

  const created = await db.transaction(async (tx) => {
    // Serialize requests per email so a double-click cannot slip past the reuse check or the limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rz-download:${email}`}))`);

    const [existing] = await tx
      .select({ token: downloads.token })
      .from(downloads)
      .innerJoin(leads, eq(downloads.leadId, leads.id))
      .where(
        and(
          eq(downloads.calendarId, input.calendarId),
          eq(leads.email, email),
          ne(downloads.status, 'failed'),
          gt(downloads.createdAt, new Date(now - REUSE_WINDOW_MS)),
        ),
      )
      .limit(1);
    if (existing) return { kind: 'reused', token: existing.token } as const;

    const since = new Date(now - RATE_WINDOW_MS);
    const [{ n: byEmail }] = await tx
      .select({ n: count() })
      .from(leads)
      .where(and(eq(leads.email, email), gt(leads.createdAt, since)));
    if (byEmail >= MAX_PER_EMAIL) throw new RateLimitError('email');
    const [{ n: byIp }] = await tx
      .select({ n: count() })
      .from(leads)
      .where(and(eq(leads.ip, input.ip), gt(leads.createdAt, since)));
    if (byIp >= MAX_PER_IP) throw new RateLimitError('ip');

    const snapshot = await buildSnapshot(input.calendarId);
    const [lead] = await tx
      .insert(leads)
      .values({
        email,
        orgName: input.orgName,
        sector: input.sector,
        fields: input.fields,
        phone: input.phone ?? null,
        calendarId: input.calendarId,
        ip: input.ip,
      })
      .returning();
    const [download] = await tx
      .insert(downloads)
      .values({
        token: newToken(),
        leadId: lead.id,
        calendarId: input.calendarId,
        formats: input.formats,
        snapshot,
        expiresAt: new Date(now + LINK_TTL_MS),
      })
      .returning({ id: downloads.id, token: downloads.token });
    return { kind: 'created', lead, download } as const;
  });

  if (created.kind === 'reused') return { token: created.token, reused: true };

  const { lead, download } = created;
  const fail = (error: string) =>
    db.update(downloads).set({ status: 'failed', error }).where(eq(downloads.id, download.id));
  try {
    await enqueueRender(download.id);
  } catch (err) {
    await fail(`enqueue: ${String(err)}`);
    throw err;
  }
  try {
    await sendDownloadEmail(email, input.lang ?? 'ar', downloadLink(download.token), input.orgName);
  } catch (err) {
    // A link nobody received is useless: fail it so a retry creates a fresh download and email.
    await fail(`email: ${String(err)}`);
    throw new EmailDeliveryError(err);
  }
  void notifyNewLead({ ...lead, formats: input.formats });
  return { token: download.token, reused: false };
}

// ---- status and files ----

export type DownloadStatus = {
  status: DownloadRow['status'];
  files: (DownloadFile & { url: string })[];
  expired: boolean;
};

async function byToken(token: string) {
  if (!TOKEN.test(token)) return null;
  const [row] = await db
    .select({ id: downloads.id, status: downloads.status, files: downloads.files, expiresAt: downloads.expiresAt })
    .from(downloads)
    .where(eq(downloads.token, token));
  return row ?? null;
}

/** Public status of a download (no snapshot or lead data); null for an unknown token. */
export async function getDownloadStatus(token: string): Promise<DownloadStatus | null> {
  const row = await byToken(token);
  if (!row) return null;
  const expired = row.expiresAt.getTime() <= Date.now();
  const files =
    expired || row.status !== 'ready'
      ? []
      : row.files.map((f) => ({
          name: f.name,
          size: f.size,
          url: `/api/files/${encodeURIComponent(token)}/${encodeURIComponent(f.name)}`,
        }));
  return { status: row.status, files, expired };
}

export type FileLookup =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'ok'; path: string; name: string; size: number };

/** Resolves a file only by exact name match against the stored list (so no path traversal). */
export async function lookupFile(token: string, name: string): Promise<FileLookup> {
  const row = await byToken(token);
  if (!row) return { kind: 'not_found' };
  if (row.expiresAt.getTime() <= Date.now()) return { kind: 'expired' };
  const file = row.status === 'ready' ? row.files.find((f) => f.name === name) : undefined;
  if (!file) return { kind: 'not_found' };
  return { kind: 'ok', path: path.join(/*turbopackIgnore: true*/ downloadDir(row.id), file.name), name: file.name, size: file.size };
}
