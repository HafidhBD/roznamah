/**
 * Wall-calendar PDF: renders a stored download snapshot through the print route with real
 * Chromium (the configured dev server must have RENDER_SECRET; playwright.config sets one).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import postgres from 'postgres';
import { defaultDesign, type Design } from '../../src/lib/design';
import type { CalendarEventView } from '../../src/lib/draft';
import { encodePageFormat } from '../../src/lib/print-sizes';
import { renderPdf } from '../../src/lib/render/pdf';
import { assembleSnapshot } from '../../src/lib/snapshot-core';

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

/** pdftotext output in a given mode, NFKC-normalized, without bidi control marks. */
function pdfText(file: string, mode: '-raw' | '-layout' | null = null) {
  const args = [...(mode ? [mode] : []), file, '-'];
  return execFileSync('pdftotext', args, { encoding: 'utf8' })
    .normalize('NFKC')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}
const rendered: Record<'a4' | 'a3', string> = { a4: '', a3: '' };

async function firstPageSize(file: string) {
  const doc = await PDFDocument.load(readFileSync(file));
  const { width, height } = doc.getPage(0).getMediaBox();
  return { pages: doc.getPageCount(), width, height };
}

test.describe('wall PDF', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240_000);

  test('the print route needs the render secret and a valid format', async ({ request }) => {
    const id = downloadIds.official;
    const format = encodePageFormat({ kind: 'wall', size: 'A4', bleed: false });
    const key = encodeURIComponent(process.env.RENDER_SECRET!);
    expect((await request.get(`/print/${id}?format=${format}`)).status()).toBe(404);
    expect((await request.get(`/print/${id}?format=${format}&key=wrong`)).status()).toBe(404);
    expect((await request.get(`/print/${id}?format=bad&key=${key}`)).status()).toBe(404);
    expect((await request.get(`/print/00000000-0000-4000-8000-0000000000ff?format=${format}&key=${key}`)).status()).toBe(404);
    const ok = await request.get(`/print/${id}?format=${format}&key=${key}`);
    expect(ok.status(), 'is the dev server running with RENDER_SECRET?').toBe(200);
    const html = await ok.text();
    expect(html).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"|<html[^>]*dir="rtl"[^>]*lang="ar"/);
    expect(html).toContain('noindex');
    expect(html).not.toContain('data-testid="brand"'); // no site header
    expect(html).toContain('@page { size: 210mm 297mm; margin: 0; }');
  });

  test('A4 without bleed: 13 pages with an A4 media box and real text', async ({}, testInfo) => {
    const out = testInfo.outputPath('task-10-a4.pdf');
    const res = await renderPdf(downloadIds.official, { kind: 'wall', size: 'A4', bleed: false }, out);
    expect(res.pages).toBe(13);
    expect(res.bytes).toBe(readFileSync(out).length);
    const size = await firstPageSize(out);
    expect(size.pages).toBe(13);
    expect(size.width).toBeCloseTo(595.3, 0);
    expect(Math.abs(size.width - 595.3)).toBeLessThanOrEqual(1);
    expect(Math.abs(size.height - 841.9)).toBeLessThanOrEqual(1);
    // real (selectable) text, not outlines
    const text = pdfText(out);
    for (const word of ['Waves', '2027', 'اليوم', 'عيد الفطر']) expect(text).toContain(word);
    rendered.a4 = out;
  });

  test('A3 with bleed: 13 pages of (297+6)×(420+6) mm', async ({}, testInfo) => {
    const out = testInfo.outputPath('task-10-a3-bleed.pdf');
    const res = await renderPdf(downloadIds.modern, { kind: 'wall', size: 'A3', bleed: true }, out);
    expect(res.pages).toBe(13);
    const size = await firstPageSize(out);
    expect(Math.abs(size.width - 303 * PT_PER_MM)).toBeLessThanOrEqual(1);
    expect(Math.abs(size.height - 426 * PT_PER_MM)).toBeLessThanOrEqual(1);
    const text = pdfText(out);
    for (const word of ['Waves', '2027', 'اليوم', 'عيد الفطر']) expect(text).toContain(word);
    rendered.a3 = out;
  });

  /*
   * Known failure, kept strict on purpose (see .superpowers/sdd/…/task-10-report.md). The pages
   * render correctly shaped and ordered (checked on PNG renders), and Chromium writes the correct
   * logical text as /ActualText inside /ReversedChars spans, but poppler 24.02 reverses the
   * ActualText of ligature glyphs (IBM Plex «ني» → «ين») and resolves mixed Arabic/Latin lines
   * to visual order, so no pdftotext mode yields these strings. `test.fail` flips to an error
   * as soon as extraction succeeds, so the expectation cannot be forgotten.
   */
  test('pdftotext extracts «اليوم الوطني» and «Waves للتقنية 2027» in logical order', async () => {
    test.fail(true, 'poppler mis-extracts Chromium RTL ligatures and mixed-direction lines');
    expect(rendered.a4 && rendered.a3, 'the render tests must run first').toBeTruthy();
    for (const file of [rendered.a4, rendered.a3]) {
      const texts = (['-raw', '-layout', null] as const).map((m) => pdfText(file, m));
      expect(texts.some((t) => t.includes(NATIONAL))).toBe(true);
      expect(texts.some((t) => t.includes(ORG))).toBe(true);
    }
  });
});
