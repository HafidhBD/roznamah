import { z } from 'zod';

export const FONT_KEYS = ['plex', 'tajawal', 'cairo', 'readex', 'kufi'] as const;
export const TEMPLATE_KEYS = ['modern', 'official'] as const;
export type FontKey = (typeof FONT_KEYS)[number];
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type Design = {
  orgNameAr: string;
  orgNameEn: string;
  logoPath: string | null;
  primary: string;
  secondary: string;
  font: FontKey;
  template: TemplateKey;
  title: string;
  subtitle: string;
  showHijri: boolean;
  weekStart: 0 | 1 | 6;
  language: 'ar' | 'en' | 'bi';
  showDescriptions: boolean;
  colorByKind: boolean;
  notesArea: boolean;
};

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const text = z.string().max(120);
const hex = z.string().regex(HEX_COLOR);

export const designSchema = z.object({
  orgNameAr: text,
  orgNameEn: text,
  logoPath: z.string().max(300).nullable(),
  primary: hex,
  secondary: hex,
  font: z.enum(FONT_KEYS),
  template: z.enum(TEMPLATE_KEYS),
  title: text,
  subtitle: text,
  showHijri: z.boolean(),
  weekStart: z.union([z.literal(0), z.literal(1), z.literal(6)]),
  language: z.enum(['ar', 'en', 'bi']),
  showDescriptions: z.boolean(),
  colorByKind: z.boolean(),
  notesArea: z.boolean(),
}) satisfies z.ZodType<Design>;

export const designPatchSchema = designSchema.partial().strict();

export const defaultDesign: Design = {
  orgNameAr: '',
  orgNameEn: '',
  logoPath: null,
  primary: '#6d3df5',
  secondary: '#d8a54f',
  font: 'plex',
  template: 'modern',
  title: '',
  subtitle: '',
  showHijri: true,
  weekStart: 0,
  language: 'ar',
  showDescriptions: true,
  colorByKind: false,
  notesArea: true,
};
