import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

// In dev, HMR re-evaluates this module; cache the client on globalThis to avoid leaking connections.
const globalForDb = globalThis as unknown as { __roznamahSql?: ReturnType<typeof postgres> };

export const sql = globalForDb.__roznamahSql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== 'production') globalForDb.__roznamahSql = sql;
export const db = drizzle(sql, { schema });
