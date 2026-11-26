import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  unique,
} from 'drizzle-orm/pg-core';

import type { Selections } from '@/lib/recommend';
import type { Design } from '@/lib/design';

// Placeholder jsonb types; later tasks will tighten them.
export type FormatRequest = Record<string, unknown>;
export type CalendarSnapshot = unknown;

export const taxonomyGroup = pgEnum('taxonomy_group', ['sector', 'field', 'audience', 'use']);
export const eventKind = pgEnum('event_kind', [
  'national',
  'religious',
  'international',
  'field',
  'commercial',
]);
export const recurrenceKind = pgEnum('recurrence_kind', [
  'gregorian_fixed',
  'hijri_fixed',
  'annual_manual',
]);
export const occurrenceStatus = pgEnum('occurrence_status', ['confirmed', 'estimated']);
export const downloadStatus = pgEnum('download_status', [
  'queued',
  'rendering',
  'ready',
  'failed',
]);

export const taxonomyTerms = pgTable(
  'taxonomy_terms',
  {
    id: serial('id').primaryKey(),
    group: taxonomyGroup('group').notNull(),
    key: text('key').notNull(),
    labelAr: text('label_ar').notNull(),
    labelEn: text('label_en').notNull(),
    sort: integer('sort').notNull().default(0),
    active: boolean('active').notNull().default(true),
  },
  (t) => [unique('taxonomy_terms_group_key_unique').on(t.group, t.key)],
);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  titleAr: text('title_ar').notNull(),
  titleEn: text('title_en').notNull(),
  descriptionAr: text('description_ar').notNull().default(''),
  descriptionEn: text('description_en').notNull().default(''),
  kind: eventKind('kind').notNull(),
  recurrence: recurrenceKind('recurrence').notNull(),
  gMonth: integer('g_month'),
  gDay: integer('g_day'),
  hMonth: integer('h_month'),
  hDay: integer('h_day'),
  durationDays: integer('duration_days').notNull().default(1),
  icon: text('icon'),
  color: text('color'),
  contentIdeaAr: text('content_idea_ar'),
  contentIdeaEn: text('content_idea_en'),
  prepDays: integer('prep_days').notNull().default(14),
  sourceName: text('source_name'),
  sourceUrl: text('source_url'),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const eventTags = pgTable(
  'event_tags',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    termId: integer('term_id')
      .notNull()
      .references(() => taxonomyTerms.id, { onDelete: 'cascade' }),
    weight: integer('weight').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.termId] }),
    check('event_tags_weight_range', sql`${t.weight} between 1 and 3`),
  ],
);

// Admin override or manual date for an event in a given year.
export const eventOccurrences = pgTable(
  'event_occurrences',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    startDate: date('start_date').notNull(),
    status: occurrenceStatus('status').notNull().default('confirmed'),
    sourceUrl: text('source_url'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.year] })],
);

export const calendars = pgTable('calendars', {
  id: uuid('id').primaryKey().defaultRandom(),
  draftToken: text('draft_token').unique(),
  userId: text('user_id'),
  startMonth: date('start_month').notNull(),
  selections: jsonb('selections').$type<Selections>().notNull().default({} as Selections),
  design: jsonb('design').$type<Design>().notNull().default({} as Design),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    calendarId: uuid('calendar_id')
      .notNull()
      .references(() => calendars.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
    customTitleAr: text('custom_title_ar'),
    customTitleEn: text('custom_title_en'),
    customDate: date('custom_date'),
    customColor: text('custom_color'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('calendar_events_calendar_event_unique')
      .on(t.calendarId, t.eventId)
      .where(sql`${t.eventId} is not null`),
    index('calendar_events_calendar_idx').on(t.calendarId),
  ],
);

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  orgName: text('org_name').notNull(),
  sector: text('sector'),
  fields: jsonb('fields').$type<string[]>().notNull().default([]),
  phone: text('phone'),
  calendarId: uuid('calendar_id').references(() => calendars.id, { onDelete: 'set null' }),
  ip: text('ip'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const downloads = pgTable('downloads', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  leadId: uuid('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  calendarId: uuid('calendar_id').references(() => calendars.id, { onDelete: 'set null' }),
  formats: jsonb('formats').$type<FormatRequest[]>().notNull().default([]),
  snapshot: jsonb('snapshot').$type<CalendarSnapshot>().notNull(),
  status: downloadStatus('status').notNull().default('queued'),
  files: jsonb('files').$type<{ name: string; size: number }[]>().notNull().default([]),
  error: text('error'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Auth.js (@auth/drizzle-adapter) Postgres schema.
export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  role: text('role').notNull().default('user'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (a) => [primaryKey({ columns: [a.provider, a.providerAccountId] })],
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (v) => [primaryKey({ columns: [v.identifier, v.token] })],
);

export type TaxonomyTermRow = typeof taxonomyTerms.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type EventTagRow = typeof eventTags.$inferSelect;
export type OccurrenceRow = typeof eventOccurrences.$inferSelect;
export type CalendarRow = typeof calendars.$inferSelect;
export type CalendarEventRow = typeof calendarEvents.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;
export type DownloadRow = typeof downloads.$inferSelect;
