import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';
import { t } from '@/i18n/core';

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.trim().toLowerCase());
}

export const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

export type AdminSession = { user: { id: string; email: string; name: string | null }; expires: Date };

declare global {
  // Magic links captured instead of emailed (EMAIL_TRANSPORT=memory / no RESEND_API_KEY, non-production only).
  var __roznamahMail: { to: string; url: string }[] | undefined;
}

async function sendVerificationRequest({ identifier, url }: { identifier: string; url: string }) {
  const dev = process.env.NODE_ENV !== 'production';
  const apiKey = process.env.RESEND_API_KEY;
  if (dev && (process.env.EMAIL_TRANSPORT === 'memory' || !apiKey)) {
    (globalThis.__roznamahMail ??= []).push({ to: identifier, url });
    console.log(`[auth] magic link for ${identifier}: ${url}`);
    return;
  }
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: identifier,
      subject: t('ar', 'admin.email.subject'),
      html: `<div dir="rtl" style="font-family:sans-serif"><p>${t('ar', 'admin.email.body')}</p><p><a href="${url}">${t('ar', 'admin.email.cta')}</a></p></div>`,
      text: `${t('ar', 'admin.email.body')}\n${url}`,
    }),
  });
  if (!res.ok) throw new Error(`Resend error: ${res.status}`);
}

export const { handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'database' },
  trustHost: true,
  providers: [Resend({ apiKey: process.env.RESEND_API_KEY ?? 'unset', from: process.env.EMAIL_FROM, sendVerificationRequest })],
  pages: { signIn: '/admin/sign-in', verifyRequest: '/admin/sign-in?sent=1', error: '/admin/sign-in?error=1' },
  callbacks: {
    // Runs before any user/account row is created: non-admins never get one.
    signIn: ({ user }) => isAdmin(user.email),
  },
});

function cookieFromRequest(req: Request): string | undefined {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if ((SESSION_COOKIES as readonly string[]).includes(name)) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

async function cookieFromStore(): Promise<string | undefined> {
  const store = await cookies();
  for (const name of SESSION_COOKIES) {
    const v = store.get(name)?.value;
    if (v) return v;
  }
  return undefined;
}

/** The session of a signed-in admin, or null. Re-checks ADMIN_EMAILS on every call. */
export async function getAdminSession(req?: Request): Promise<AdminSession | null> {
  const token = req ? cookieFromRequest(req) : await cookieFromStore();
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, expires: sessions.expires })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.sessionToken, token), gt(sessions.expires, new Date())));
  if (!row || !isAdmin(row.email)) return null;
  return { user: { id: row.id, email: row.email!, name: row.name }, expires: row.expires };
}

export async function requireAdmin(req?: Request): Promise<AdminSession> {
  const session = await getAdminSession(req);
  if (!session) {
    throw new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
  return session;
}

/** Wraps an admin route handler: turns a thrown 403 Response into the response. */
export function adminRoute<A extends unknown[]>(
  handler: (req: Request, ...args: A) => Promise<Response>,
): (req: Request, ...args: A) => Promise<Response> {
  return async (req, ...args) => {
    try {
      await requireAdmin(req);
      return await handler(req, ...args);
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
  };
}

/** For admin pages: redirect to sign-in unless an admin session exists (layouts alone are not re-run on soft navigation). */
export async function requirePageAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in');
  return session;
}
