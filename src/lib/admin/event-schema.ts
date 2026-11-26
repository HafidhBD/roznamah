import { z } from 'zod';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Feb 29: yearly dates must allow leap days

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v == null || v.trim() === '' ? null : v.trim()));

const httpsUrl = z
  .string()
  .max(500)
  .nullish()
  .transform((v) => (v == null || v.trim() === '' ? null : v.trim()))
  .refine((v) => {
    if (v === null) return true;
    try {
      return new URL(v).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'https only');

const intOrNull = z.number().int().nullish().transform((v) => v ?? null);

export const eventInputSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    titleAr: z.string().trim().min(1).max(200),
    titleEn: z.string().trim().min(1).max(200),
    descriptionAr: z.string().max(2000).default(''),
    descriptionEn: z.string().max(2000).default(''),
    kind: z.enum(['national', 'religious', 'international', 'field', 'commercial']),
    recurrence: z.enum(['gregorian_fixed', 'hijri_fixed', 'annual_manual']),
    gMonth: intOrNull,
    gDay: intOrNull,
    hMonth: intOrNull,
    hDay: intOrNull,
    durationDays: z.number().int().min(1).max(60),
    prepDays: z.number().int().min(0).max(365),
    icon: optionalText(16),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullish()
      .transform((v) => v || null),
    contentIdeaAr: optionalText(1000),
    contentIdeaEn: optionalText(1000),
    sourceName: optionalText(200),
    sourceUrl: httpsUrl,
    active: z.boolean(),
    tags: z
      .array(z.object({ termId: z.number().int().positive(), weight: z.number().int().min(1).max(3) }))
      .max(100)
      .refine((tags) => new Set(tags.map((t) => t.termId)).size === tags.length, 'duplicate term'),
  })
  .superRefine((e, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (e.recurrence === 'gregorian_fixed') {
      if (e.gMonth == null || e.gMonth < 1 || e.gMonth > 12) bad('gMonth', 'month 1-12');
      else if (e.gDay == null || e.gDay < 1 || e.gDay > DAYS_IN_MONTH[e.gMonth - 1]) bad('gDay', 'invalid day');
    } else if (e.recurrence === 'hijri_fixed') {
      if (e.hMonth == null || e.hMonth < 1 || e.hMonth > 12) bad('hMonth', 'month 1-12');
      if (e.hDay == null || e.hDay < 1 || e.hDay > 30) bad('hDay', 'day 1-30');
    }
  })
  .transform((e) => ({
    ...e,
    // Only the date fields of the chosen recurrence are kept.
    gMonth: e.recurrence === 'gregorian_fixed' ? e.gMonth : null,
    gDay: e.recurrence === 'gregorian_fixed' ? e.gDay : null,
    hMonth: e.recurrence === 'hijri_fixed' ? e.hMonth : null,
    hDay: e.recurrence === 'hijri_fixed' ? e.hDay : null,
  }));

export type EventInput = z.output<typeof eventInputSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'invalid date');

export const occurrenceInputSchema = z
  .object({
    year: z.number().int().min(2000).max(2200),
    startDate: isoDate,
    status: z.enum(['confirmed', 'estimated']),
    sourceUrl: httpsUrl,
  })
  .refine((o) => o.startDate.startsWith(`${o.year}-`), { path: ['startDate'], message: 'date must be within the year' });

export const taxonomyPatchSchema = z.object({
  labelAr: z.string().trim().min(1).max(100),
  labelEn: z.string().trim().min(1).max(100),
  sort: z.number().int().min(0).max(100000),
  active: z.boolean(),
});
