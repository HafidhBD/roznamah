/**
 * Wall-calendar PDF: renders a stored download snapshot through the print route with real
 * Chromium (the configured dev server must have RENDER_SECRET; playwright.config sets one).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import postgres from 'postgres';
import { defaultDesign, type Design } from '../../src/lib/design';
import type { CalendarEventView } from '../../src/lib/draft';
import { encodePageFormat } from '../../src/lib/print-sizes';
import { renderPdf } from '../../src/lib/render/pdf';
import { assembleSnapshot } from '../../src/lib/snapshot-core';
import { containsArabicWord, joinSplitLetters, pdfText, tokensNear } from './pdf-text';

const ORG = 'Waves للتقنية 2027';
const NATIONAL = 'اليوم الوطني';
const PT_PER_MM = 72 / 25.4;

function view(id: string, titleAr: string, titleEn: string, kind: string, start: string, end: string, status: 'confirmed' | 'estimated'): CalendarEventView {
  return {
    id,
    eventId: null,
    title: titleAr,
    titleAr,
    titleEn,
    descriptionAr: '',
    descriptionEn: '',
    kind,
    color: '#1c7c4c',
    icon: '★',
    occurrences: [{ eventId: id, start, end, status }],
    custom: false,
  };
}

const views = [
  view('00000000-0000-4000-8000-000000000001', NATIONAL, 'Saudi National Day', 'national', '2027-09-23', '2027-09-23', 'confirmed'),
  view('00000000-0000-4000-8000-000000000002', 'عيد الفطر', 'Eid al-Fitr', 'religious', '2027-03-10', '2027-03-12', 'estimated'),
];
const snapshot = (design: Partial<Design>) =>
  assembleSnapshot({ ...defaultDesign, orgNameAr: ORG, ...design }, '2027-01-01', views, null);

let sql: ReturnType<typeof postgres>;
let leadId: string;
const downloadIds: Record<string, string> = {};

test.beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!);
  [{ id: leadId }] = await sql<{ id: string }[]>`
    insert into leads (email, org_name) values ('pdf-e2e@example.com', ${ORG}) returning id`;
  for (const [name, design] of Object.entries({ official: { template: 'official' }, modern: { template: 'modern' } } as const)) {
    const [{ id }] = await sql<{ id: string }[]>`
      insert into downloads (token, lead_id, snapshot, expires_at)
      values (${`pdf-e2e-${name}-${Date.now()}`}, ${leadId}, ${sql.json(snapshot(design))}, now() + interval '1 day')
      returning id`;
    downloadIds[name] = id;
  }
});
test.afterAll(async () => {
  if (leadId) await sql`delete from leads where id = ${leadId}`; // cascades to downloads
  await sql.end();
});

/*
 * Text checks: Poppler cannot extract Chromium's Arabic contiguously in logical order (it reverses
 * ligature ActualText and visual-orders mixed lines; see ./pdf-text.ts and the task-10 report), so
 * words are matched in logical or Poppler-reversed form. Shaping itself is verified on PNG renders.
 */
function expectArabicText(file: string) {
  const text = joinSplitLetters(pdfText(file));
  for (const word of NATIONAL.split(' ')) expect(containsArabicWord(text, word), word).toBe(true);
  expect(containsArabicWord(text, 'عيد'), 'عيد').toBe(true);
  expect(tokensNear(text, ['Waves', 'للتقنية', '2027']), 'org name tokens together').toBe(true);
}

async function firstPageSize(file: string) {
  const doc = await PDFDocument.load(readFileSync(file));
  const { width, height } = doc.getPage(0).getMediaBox();
  return { pages: doc.getPageCount(), width, height };
}

test.describe('wall PDF', () => {
  test.setTimeout(240_000);

  test('the print route needs the render secret and a valid format', async ({ request }) => {
    const id = downloadIds.official;
    const format = encodePageFormat({ kind: 'wall', size: 'A4', bleed: false });
    const key = encodeURIComponent(process.env.RENDER_SECRET!);
    const noKey = await request.get(`/print/${id}?format=${format}`);
    expect(noKey.status()).toBe(404);
    const noKeyHtml = await noKey.text();
    expect(noKeyHtml).not.toContain('للتقنية'); // nothing from the snapshot before the key check
    expect(noKeyHtml).not.toContain('Waves');
    expect((await request.get(`/print/${id}?format=${format}&key=wrong`)).status()).toBe(404);
    expect((await request.get(`/print/${id}?format=bad&key=${key}`)).status()).toBe(404);
    expect((await request.get(`/print/00000000-0000-4000-8000-0000000000ff?format=${format}&key=${key}`)).status()).toBe(404);
    const ok = await request.get(`/print/${id}?format=${format}&key=${key}`);
    expect(ok.status(), 'is the dev server running with RENDER_SECRET?').toBe(200);
    const html = await ok.text();
    expect(html).toContain('<div lang="ar" dir="rtl">'); // the calendar's own language, set by the page
    expect(html).toContain('noindex');
    expect(html).not.toContain('data-testid="brand"'); // no site header
    expect(html).toContain('@page { size: 210mm 297mm; margin: 0; }');
  });

  test('A4 without bleed: 13 pages with an A4 media box; Arabic and mixed text extract', async ({}, testInfo) => {
    const out = testInfo.outputPath('task-10-a4.pdf');
    const res = await renderPdf(downloadIds.official, { kind: 'wall', size: 'A4', bleed: false }, out);
    expect(res.pages).toBe(13);
    expect(res.bytes).toBe(readFileSync(out).length);
    const size = await firstPageSize(out);
    expect(size.pages).toBe(13);
    expect(size.width).toBeCloseTo(595.3, 0);
    expect(Math.abs(size.width - 595.3)).toBeLessThanOrEqual(1);
    expect(Math.abs(size.height - 841.9)).toBeLessThanOrEqual(1);
    expectArabicText(out);
  });

  test('A3 with bleed: 13 pages of (297+6)×(420+6) mm; Arabic and mixed text extract', async ({}, testInfo) => {
    const out = testInfo.outputPath('task-10-a3-bleed.pdf');
    const res = await renderPdf(downloadIds.modern, { kind: 'wall', size: 'A3', bleed: true }, out);
    expect(res.pages).toBe(13);
    const size = await firstPageSize(out);
    expect(Math.abs(size.width - 303 * PT_PER_MM)).toBeLessThanOrEqual(1);
    expect(Math.abs(size.height - 426 * PT_PER_MM)).toBeLessThanOrEqual(1);
    expectArabicText(out);
  });
});
