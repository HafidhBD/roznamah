import ExcelJS from 'exceljs';
import { and, desc, eq, gte, inArray, lt, type SQL, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { downloads, leads, taxonomyTerms, type FormatRequest } from '@/db/schema';
import { t } from '@/i18n/core';

export const LEADS_PAGE_SIZE = 25;
const EXPORT_LIMIT = 20000;

export type LeadFilters = { sector?: string; from?: string; to?: string };

export type LeadView = {
  id: string;
  org: string;
  sector: string;
  fields: string;
  email: string;
  phone: string;
  formats: string;
  date: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function leadWhere(f: LeadFilters): SQL | undefined {
  const conds: SQL[] = [];
  if (f.sector) conds.push(eq(leads.sector, f.sector));
  // Day boundaries follow Saudi time (UTC+3).
  if (f.from && ISO.test(f.from)) conds.push(gte(leads.createdAt, new Date(`${f.from}T00:00:00+03:00`)));
  if (f.to && ISO.test(f.to)) conds.push(lt(leads.createdAt, new Date(new Date(`${f.to}T00:00:00+03:00`).getTime() + DAY_MS)));
  return conds.length ? and(...conds) : undefined;
}

const riyadhDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

function formatLabel(f: FormatRequest): string {
  const base = `${t('ar', 'admin.leads.format.wall')} ${f.size}`;
  return f.bleed ? `${base} (${t('ar', 'admin.leads.format.bleed')})` : base;
}

async function toViews(rows: (typeof leads.$inferSelect)[]): Promise<LeadView[]> {
  if (!rows.length) return [];
  const terms = await db.select().from(taxonomyTerms).where(inArray(taxonomyTerms.group, ['sector', 'field']));
  const label = (group: string, key: string) => terms.find((x) => x.group === group && x.key === key)?.labelAr ?? key;
  const dls = await db
    .select({ leadId: downloads.leadId, formats: downloads.formats })
    .from(downloads)
    .where(inArray(downloads.leadId, rows.map((r) => r.id)));
  return rows.map((r) => {
    const formats = [...new Set(dls.filter((d) => d.leadId === r.id).flatMap((d) => d.formats.map(formatLabel)))];
    return {
      id: r.id,
      org: r.orgName,
      sector: r.sector ? label('sector', r.sector) : '',
      fields: r.fields.map((k) => label('field', k)).join('، '),
      email: r.email,
      phone: r.phone ?? '',
      formats: formats.join('، '),
      date: riyadhDate(r.createdAt),
    };
  });
}

export async function listLeads(f: LeadFilters, page: number): Promise<{ rows: LeadView[]; total: number }> {
  const where = leadWhere(f);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(leads).where(where);
  const rows = await db
    .select()
    .from(leads)
    .where(where)
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(LEADS_PAGE_SIZE)
    .offset((Math.max(1, page) - 1) * LEADS_PAGE_SIZE);
  return { rows: await toViews(rows), total: count };
}

export async function allLeads(f: LeadFilters): Promise<LeadView[]> {
  const rows = await db.select().from(leads).where(leadWhere(f)).orderBy(desc(leads.createdAt), desc(leads.id)).limit(EXPORT_LIMIT);
  return toViews(rows);
}

export const LEAD_COLUMNS = [
  ['org', 'admin.leads.org'],
  ['sector', 'admin.leads.sector'],
  ['fields', 'admin.leads.fields'],
  ['email', 'admin.leads.email'],
  ['phone', 'admin.leads.phone'],
  ['formats', 'admin.leads.formats'],
  ['date', 'admin.leads.date'],
] as const;

export async function leadsWorkbook(rows: LeadView[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t('ar', 'admin.leads.sheet'), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  ws.columns = LEAD_COLUMNS.map(([key, msg]) => ({ header: t('ar', msg), key, width: key === 'email' || key === 'fields' ? 32 : 20 }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
