import { randomUUID } from 'node:crypto';
import type { Sql } from 'postgres';

export const SESSION_COOKIE = 'authjs.session-token';

/** Creates (or reuses) a user row and a live session row; returns the session cookie value. */
export async function createAdminSession(sql: Sql, email: string): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into "user" (id, email, "emailVerified") values (${randomUUID()}, ${email}, now())
    on conflict (email) do update set email = excluded.email
    returning id`;
  const token = randomUUID();
  await sql`insert into session ("sessionToken", "userId", expires)
            values (${token}, ${rows[0].id}, ${new Date(Date.now() + 86_400_000).toISOString()}::timestamp)`;
  return token;
}

export async function deleteUserByEmail(sql: Sql, email: string): Promise<void> {
  await sql`delete from "user" where email = ${email}`;
}
