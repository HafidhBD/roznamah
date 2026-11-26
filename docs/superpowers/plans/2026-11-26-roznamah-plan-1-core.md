# Roznamah — Plan 1: Core Journey, Wall PDF, Admin, Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor without an account picks their profile, gets ranked Saudi + international occasions on a 12-month calendar, brands it (name, logo, colors, font, template), and receives a print-ready wall-calendar PDF by email. Waves staff manage occasions and see the leads in a protected admin panel. Everything runs on the Waves VPS.

**Architecture:** A single Next.js (App Router, TypeScript) app with PostgreSQL via Drizzle. One `CalendarDocument` React component renders both the live studio preview and the print pages. A separate worker process (the same image, a different command) pulls jobs from pg-boss and drives Playwright/Chromium to turn the print route into a PDF. Anonymous work lives in a server-side draft keyed by an httpOnly cookie token. Email goes through Resend.

**Tech Stack:** Node 22, Next.js 15, React 19, TypeScript strict, Tailwind CSS 4, Drizzle ORM + drizzle-kit, PostgreSQL 17, pg-boss 10, Playwright (Chromium), Auth.js v5 (email/magic link via Resend, admin only in this plan), Resend SDK, ExcelJS (leads export), zod, sharp (logo processing), node-vibrant (palette extraction), @fontsource fonts, Vitest, @playwright/test.

**Spec:** `docs/superpowers/specs/2026-11-26-roznamah-design.md`

**Later plans (not in this one):**
- **Plan 2:**
  - The desk calendar A5 and the yearly page A3/A2.
  - ICS, PNG share images, Excel content plan and the ZIP bundle.
  - Templates 3–6.
  - The cover image library.
- **Plan 3:**
  - Customer accounts (magic link), multiple calendars per account, moving a draft into an account.
  - Date-change email alerts and the ICS subscription URL.
  - Retention cleanup jobs, data deletion and admin stats.

## Global Constraints

- **Language and direction:**
  - Arabic is the default language. The `<html lang="ar" dir="rtl">` attribute is set on first load, and English is complete with `dir="ltr"`.
  - All copy lives in `src/i18n/{ar,en}.ts`. No hard-coded UI strings in components.
- **Dates:**
  - Hijri dates use the Umm al-Qura calendar (`islamic-umalqura` via `Intl`).
  - A Hijri-derived date is `estimated` until an admin override marks it `confirmed`.
- **Calendar span:** always 12 consecutive Gregorian months starting on day 1 of `startMonth`. Default `startMonth` = January of next year.
- **Week start:** the default first weekday is Sunday. Friday and Saturday are weekend days.
- **Draft isolation:** a visitor can only ever read or write the calendar whose `draftToken` matches their cookie `rz_draft`, which is httpOnly, SameSite=Lax and lasts 90 days. Calendar IDs never appear in client-writable APIs without a token check.
- **Admin access:**
  - `/admin/**` and `/api/admin/**` require an Auth.js session whose email is in the `ADMIN_EMAILS` env (comma-separated, lowercased).
  - All other emails get 403.
- **Download form:**
  - Fields: email (required), organization name (required, prefilled), sector (prefilled), phone (optional, Saudi format `05XXXXXXXX` or `+9665XXXXXXXX`).
  - **No consent checkbox.** Under the submit button, show this exact text:
    - ar: «بإرسالك توافق على سياسة الخصوصية، وقد تتواصل معك ويفز بخصوص خدماتها»
    - en: "By submitting you agree to the privacy policy, and Waves may contact you about its services"
    - The text links to `/privacy`.
- **Download links:** valid for 7 days, then the page shows "expired" with a button to request again.
- **Rate limits:** at most 5 download requests per email per hour and 20 per IP per hour. When `TURNSTILE_SECRET_KEY` is set, a Cloudflare Turnstile check is required.
- **Waves stamp:** present on every rendered page and not removable by any setting.
- **Logo upload:**
  - PNG, JPG or SVG, max 5 MB, stored as a file under `UPLOAD_DIR`, never in the DB.
  - An SVG is rasterized to a PNG of at most 2000 px wide by sharp, so no SVG markup is ever served back.
- **Generated files:** stored under `FILES_DIR/<downloadId>/`.
- **Worker:** concurrency 1. The worker container has a memory limit of 2g.
- **Isolation on the VPS:** don't touch the other Compose projects on the VPS (odoo, snipe-it, waves-hr, wsc, traefik). Only attach to Traefik's existing network.
- **Brand color:** the default brand color is `#6d3df5`.

## Review Focus

1. **A Hijri occasion falls twice in one 12-month span.** The Hijri year is about 11 days shorter, so a span such as Mar 2027–Feb 2028 can contain two Ramadan starts. Both must appear. Test in Task 3.
2. **Arabic shaping and mixed Arabic/Latin/digits in the PDF.** Letters must stay joined, and org names like "Waves للتقنية 2027" must not be reordered. Test in Task 10, which checks the extracted PDF text.
3. **A malicious or huge logo.** An SVG with `<script>`, a 20 MB PNG, or a .exe renamed .png must be rejected or sanitized, never served raw. Test in Task 9.
4. **A missing or forged draft cookie.** A forged token creates a new empty draft, never another visitor's calendar. Test in Task 6.
5. **A double-clicked or repeated download.** The same calendar and email within 2 minutes reuses the existing pending download instead of queueing a duplicate job. An expired token shows the expired page. Test in Task 11.

---

## File Structure

```
src/
  app/
    (site)/layout.tsx              shell, header, lang toggle, bottom nav (mobile)
    (site)/page.tsx                landing + plan builder + recommendations
    (site)/calendar/page.tsx       month/list calendar of the draft
    (site)/studio/page.tsx         identity studio + live preview + download button
    (site)/download/[token]/page.tsx  download status / files / expired
    (site)/privacy/page.tsx
    print/[downloadId]/page.tsx    print-only render (render-secret protected)
    admin/**                       admin pages
    api/draft/route.ts             GET/PATCH draft
    api/draft/events/route.ts      POST/DELETE calendar events (incl. custom)
    api/draft/logo/route.ts        POST logo upload
    api/recommendations/route.ts   POST
    api/downloads/route.ts         POST create download
    api/downloads/[token]/route.ts GET status
    api/files/[token]/[name]/route.ts  GET file stream
    api/admin/**                   events CRUD, occurrences, leads export
    api/auth/[...nextauth]/route.ts
  db/schema.ts, db/client.ts, db/seed/{taxonomy,events}.ts, db/seed/run.ts
  lib/dates/hijri.ts               Umm al-Qura conversion
  lib/dates/occurrences.ts         resolve event dates inside a span
  lib/dates/month-grid.ts          weeks matrix for a month
  lib/recommend.ts                 scoring + reasons
  lib/draft.ts                     cookie token → calendar row
  lib/design.ts                    Design type, zod schema, defaults, templates/fonts registry
  lib/logo.ts                      validate/sanitize/store logo, palette extraction
  lib/downloads.ts                 create/reuse download, rate limits, tokens
  lib/email.ts                     Resend wrappers + email templates
  lib/auth.ts                      Auth.js config, isAdmin()
  lib/print-sizes.ts               page sizes and bleed in mm
  components/calendar-document/    CalendarDocument + templates/{modern,official}.tsx + CropMarks
  components/...                   UI pieces (ChoiceChip, MonthView, ListView, StudioPanel, …)
  i18n/{ar,en,index}.ts
worker/index.ts                    pg-boss worker: render-wall-pdf job
tests/unit/**  tests/e2e/**
Dockerfile, docker-compose.yml (dev db), deploy/docker-compose.prod.yml, .env.example
```

---

### Task 1: Project scaffold, RTL shell, test tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/(site)/layout.tsx`, `src/app/(site)/page.tsx` (placeholder), `src/i18n/{ar,en,index}.ts`, `vitest.config.ts`, `playwright.config.ts`, `docker-compose.yml` (postgres:17-alpine on 5432, db `roznamah`), `.env.example`, `tests/e2e/shell.spec.ts`

**Interfaces:**
- Produces:
  - `t(lang: Lang, key: MessageKey): string` and `type Lang = 'ar' | 'en'` from `src/i18n/index.ts`.
  - `getLang(): Promise<Lang>`, which reads the `rz_lang` cookie and defaults to `'ar'`.
  - `MessageKey = keyof typeof ar`. `en` must satisfy `Record<MessageKey, string>`, which is a compile-time check that the two match.
- `.env.example` keys: `DATABASE_URL`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS`, `AUTH_SECRET`, `RENDER_SECRET`, `UPLOAD_DIR`, `FILES_DIR`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `LEAD_NOTIFY_EMAILS`.

- [ ] **Step 1:** Scaffold Next.js 15 (TypeScript, App Router, Tailwind 4, `src/` dir) and install Vitest and @playwright/test. Configure Playwright with `executablePath` only when `/opt/pw-browsers/chromium` exists.
- [ ] **Step 2: Write the failing e2e test `tests/e2e/shell.spec.ts`:**
  - `/` has `html[dir=rtl][lang=ar]` and the brand text «رَزنامة».
  - Clicking the lang toggle sets `html[dir=ltr][lang=en]` and the text "Roznamah".
  - After a reload, it is still `en`.
  - At a 390 px viewport, `document.documentElement.scrollWidth === 390`.
- [ ] **Step 3:** Run `npx playwright test tests/e2e/shell.spec.ts --trace off`. Expected: FAIL.
- [ ] **Step 4:** Implement the layout: header with brand, nav (Home, Calendar, Studio), lang toggle (server action that sets the `rz_lang` cookie), mobile bottom nav, IBM Plex Sans Arabic via @fontsource as the UI font, and CSS tokens on `:root` with `--brand: #6d3df5`. Navigation uses real routes, so browser back/forward works.
- [ ] **Step 5:** Run the e2e test again. Expected: PASS.
- [ ] **Step 6:** Commit with `chore: scaffold Next.js app with RTL shell and test tooling`.

### Task 2: Database schema and migrations

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `drizzle/` (generated), `tests/unit/db.test.ts`

**Interfaces:**
- Produces these tables and exported row types:
  - `taxonomyTerms`
    - `id` serial, `group` enum `sector|field|audience|use`, `key` text, `labelAr`, `labelEn`, `sort` int, `active` bool.
    - Unique on (`group`, `key`).
  - `events`
    - `id` uuid, `slug` unique.
    - Text fields: `titleAr`, `titleEn`, `descriptionAr`, `descriptionEn`.
    - `kind` enum `national|religious|international|field|commercial`.
    - `recurrence` enum `gregorian_fixed|hijri_fixed|annual_manual`.
    - Nullable ints: `gMonth`, `gDay`, `hMonth`, `hDay`.
    - `durationDays` int, default 1.
    - Display: `icon`, `color`.
    - Content planning: `contentIdeaAr`, `contentIdeaEn`, `prepDays` int, default 14.
    - Source: `sourceName`, `sourceUrl`.
    - `active` bool, `updatedAt`.
  - `eventTags`: (`eventId`, `termId`, `weight` int 1–3), primary key (`eventId`, `termId`).
  - `eventOccurrences`
    - `eventId`, `year` int, `startDate` date, `status` enum `confirmed|estimated`, `sourceUrl`, `updatedAt`.
    - Primary key (`eventId`, `year`). This is an admin override or a manual date.
  - `calendars`
    - `id` uuid, `draftToken` text unique nullable, `userId` text nullable.
    - `startMonth` date.
    - `selections` jsonb (`Selections`), `design` jsonb (`Design`).
    - `createdAt`, `updatedAt`.
  - `calendarEvents`
    - `id` uuid, `calendarId`, `eventId` nullable.
    - Custom-event fields: `customTitleAr`, `customTitleEn`, `customDate` date, `customColor`.
    - `addedAt`.
    - Unique on (`calendarId`, `eventId`) where `eventId` is not null.
  - `leads`
    - `id` uuid, `email`, `orgName`, `sector`, `fields` jsonb, `phone` nullable.
    - `calendarId`, `ip`, `createdAt`.
  - `downloads`
    - `id` uuid, `token` text unique, `leadId`, `calendarId`.
    - `formats` jsonb (`FormatRequest[]`), `snapshot` jsonb (`CalendarSnapshot`).
    - `status` enum `queued|rendering|ready|failed`, `files` jsonb (`{name, size}[]`), `error` text.
    - `expiresAt`, `createdAt`.
  - Auth.js Drizzle adapter tables: `users`, `accounts`, `sessions`, `verificationTokens`.
- `db` from `src/db/client.ts`, a postgres-js Drizzle instance built from `DATABASE_URL`.

- [ ] **Step 1:** Write `tests/unit/db.test.ts`. Against the dev DB, it inserts a calendar with `draftToken: 'x'` and asserts that a second insert with the same token throws a unique violation.
- [ ] **Step 2:** Run `docker compose up -d db && npx vitest run tests/unit/db.test.ts`. Expected: FAIL (tables missing).
- [ ] **Step 3:** Write the schema, then run `npx drizzle-kit generate && npx drizzle-kit migrate`.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: database schema`.

### Task 3: Hijri conversion and occurrence resolution

**Files:**
- Create: `src/lib/dates/hijri.ts`, `src/lib/dates/occurrences.ts`, `src/lib/dates/month-grid.ts`, `tests/unit/dates.test.ts`

**Interfaces:**
- Produces:
  - `toHijri(d: Date): { year: number; month: number; day: number }`
  - `hijriToGregorian(hYear: number, hMonth: number, hDay: number): Date`
  - `formatHijri(d: Date, lang: Lang): string`
  - `type Occurrence = { eventId: string; start: string /* YYYY-MM-DD */; end: string; status: 'confirmed' | 'estimated' }`
  - `resolveOccurrences(event: EventRow, overrides: OccurrenceRow[], spanStart: string, months: number): Occurrence[]`
  - `spanEnd(spanStart: string, months: number): string`, which returns the last day of the span.
  - `monthGrid(year: number, month0: number, weekStart: 0 | 1 | 6): (string | null)[][]`, a list of weeks of 7 ISO dates, with `null` for days outside the month.

- [ ] **Step 1: Write the failing tests.**
  - `toHijri(new Date('2027-03-10T12:00:00Z'))` → `{year:1448, month:10, day:2}`. This value was verified against Node 22 `Intl`.
  - `hijriToGregorian(1448, 10, 1)` → `2027-03-09`.
  - Round trip: `toHijri(hijriToGregorian(1448, 9, 1))` is `{1448, 9, 1}`.
  - **Gregorian fixed:** the National Day (gMonth 9, gDay 23) in span `2027-01-01`/12 gives one occurrence `2027-09-23`, `confirmed`.
  - **Two Ramadan starts in one span:** `ramadan-start` (hijri_fixed 9/1) in span `2027-03-01`/12 gives exactly `['2028-01-28']`, and span `2030-01-01`/12 gives exactly `['2030-01-05', '2030-12-26']`. These values were verified with Node 22 `Intl`.
  - **Override wins:** an `eventOccurrences` row for that year replaces the computed date and sets `status: 'confirmed'`.
  - **annual_manual:** an `annual_manual` event with no override yields `[]`.
  - **Duration:** `durationDays: 3` gives `end = start + 2 days`.
  - **Month grid:** `monthGrid(2027, 1, 0)`, which is February 2027, has its first row starting with `null` × 1 and Monday `2027-02-01` in position 1.
- [ ] **Step 2:** Run `npx vitest run tests/unit/dates.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `toHijri` uses `Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {timeZone:'UTC', year:'numeric', month:'numeric', day:'numeric'}).formatToParts` and parses the numbers.
  - `hijriToGregorian`:
    1. Estimate the date as `622-07-16 + ((hYear-1)*354.367 + (hMonth-1)*29.53 + hDay-1)` days.
    2. Scan ±20 days with `toHijri` for an exact match.
    3. If none is found, throw.
  - `resolveOccurrences` for `hijri_fixed`: for each Hijri year whose month could intersect the span (`toHijri(spanStart).year` to `toHijri(spanEnd).year`), convert the date and keep it if it falls inside the span. An override for that Gregorian year and event replaces the computed date.
  - All date math is in UTC at noon, to avoid timezone day shifts.
- [ ] **Step 4:** Run the tests again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: Umm al-Qura conversion and occurrence resolution`.

### Task 4: Taxonomy and occasions seed

**Files:**
- Create: `src/db/seed/taxonomy.ts`, `src/db/seed/events.ts`, `src/db/seed/run.ts`, `tests/unit/seed.test.ts`. Add the script `"db:seed": "tsx src/db/seed/run.ts"`.

**Interfaces:**
- Produces seed data, idempotent: an upsert by (`group`, `key`) and by `slug`.
- **Taxonomy keys** (spec §6.1):
  - **sector:** `government`, `private`, `nonprofit`, `semi_government`.
  - **field:** `health`, `education`, `environment`, `culture`, `tourism`, `sports`, `technology`, `finance`, `retail`, `energy`, `real_estate`, `logistics`, `food_hospitality`, `hr`.
  - **audience:** `general`, `families`, `children`, `youth`, `women`, `elderly`, `disability`, `employees`, `professionals`, `customers`.
  - **use:** `awareness`, `marketing`, `event`, `internal`, `csr`.
  - Arabic labels are taken from spec §6.1.
- **Events (at least 60).** Each one has a `sourceUrl` to an official page (gov.sa, un.org, who.int, unesco.org) and an Arabic `contentIdeaAr` of one sentence.
  - **Must include, national:**
    - `founding-day` (2/22)
    - `flag-day` (3/11)
    - `national-day` (9/23)
  - **Must include, religious, `hijri_fixed`:**
    - `ramadan-start` (9/1)
    - `eid-al-fitr` (10/1, 3 days)
    - `arafah-day` (12/9)
    - `eid-al-adha` (12/10, 4 days)
    - `hijri-new-year` (1/1)
  - **Must include:** all 19 occasions from the old site, with the same UN dates.
  - **The rest:** field days covering every field key at least twice, and commercial seasons: back to school, White Friday, Riyadh Season start, and year end. Each is `annual_manual` with an override for 2026 and 2027 when its date is known, otherwise left without an occurrence.
  - **Tags:**
    - `sector` tags carry real differences. Commercial events get government weight 1 and private weight 3. National events are tagged for all sectors with weight 3.
    - Every event has at least one `field` or `kind` that is `national` or `religious`.

- [ ] **Step 1: Write the failing test `seed.test.ts`.**
  - Run the seed twice and assert the counts are unchanged, which shows it is idempotent.
  - `events.count >= 60`.
  - Every field key has at least 2 tagged events.
  - The `national-day` slug exists with gMonth 9 and gDay 23.
  - No event has every sector at an equal weight unless its kind is `national` or `religious`.
- [ ] **Step 2:** Run it and confirm it fails.
- [ ] **Step 3:** Write the seed data and the runner.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: taxonomy and Saudi-first occasions seed`.

### Task 5: Recommendation engine

**Files:**
- Create: `src/lib/recommend.ts`, `src/app/api/recommendations/route.ts`, `tests/unit/recommend.test.ts`

**Interfaces:**
- Consumes: `resolveOccurrences` (Task 3) and the schema (Task 2).
- Produces:
  - `type Selections = { sector: string | null; fields: string[]; audiences: string[]; uses: string[] }`
  - `type Recommendation = { eventId: string; score: number /*0-100*/; band: 'high' | 'good' | 'low'; reasons: { ar: string; en: string }[]; occurrences: Occurrence[] }`
  - `scoreEvent(event: EventWithTags, sel: Selections): { score: number; reasons: {ar,en}[] }`, a pure function.
  - `recommend(sel: Selections, spanStart: string): Promise<Recommendation[]>`. It is sorted by score, then by first occurrence date, and excludes events with no occurrence in the span.
  - `POST /api/recommendations` takes `{selections, startMonth}` and returns `{items: Recommendation[]}`.

- [ ] **Step 1: Write the failing tests for `scoreEvent`.** Use these fixture events built inline.

  **Scoring rule** (raw maximum 100, then multiplied by the sector factor and clamped to 0–100):

  | Component | Points |
  |---|---|
  | National or religious kind | base 35 |
  | Field match | 40 × (max matched weight / 3) |
  | Audience match | 15 × (max matched weight / 3) |
  | Use match | 10 × (max matched weight / 3) |
  | Sector factor | weight 3 → 1.0, 2 → 0.85, 1 → 0.6, untagged → 0.9 |

  For national and religious events, field, audience and use can add up to the remaining 65, scaled the same way.

  **Bands:** high ≥ 70, good ≥ 40, otherwise low.

  **Tests:**
  - With `{sector:'government', fields:['health']}`, the World Health Day fixture (field health w3) scores higher than World Water Day (environment).
  - The National Day scores ≥ 35 for any selection.
  - The White Friday fixture scores lower for `government` than for `private` with the same fields.
  - Reasons include, in Arabic, «يتوافق مع مجال: الصحة» when the health field matches, and «مناسبة وطنية» for the national kind.
  - Empty selections are allowed: only national and religious events score > 0.
- [ ] **Step 2:** Run `npx vitest run tests/unit/recommend.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `scoreEvent`, `recommend` and the route, validating the body with zod and returning 400 on an invalid body.
- [ ] **Step 4:** Run the tests again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: weighted recommendations with reasons`.

### Task 6: Draft (anonymous calendar) API with isolation

**Files:**
- Create: `src/lib/draft.ts`, `src/lib/design.ts`, `src/app/api/draft/route.ts`, `src/app/api/draft/events/route.ts`, `tests/unit/draft.test.ts`

**Interfaces:**
- Produces:
  - `getOrCreateDraft(): Promise<CalendarRow>`. It reads the `rz_draft` cookie. If the cookie is missing or doesn't match any row, it creates a new calendar with a fresh `crypto.randomBytes(32).toString('base64url')` token and sets the cookie.
  - `getDraft(): Promise<CalendarRow | null>`, read-only.
  - `type Design = { orgNameAr: string; orgNameEn: string; logoPath: string | null; primary: string; secondary: string; font: FontKey; template: TemplateKey; title: string; subtitle: string; showHijri: boolean; weekStart: 0 | 1 | 6; language: 'ar' | 'en' | 'bi'; showDescriptions: boolean; colorByKind: boolean; notesArea: boolean }`
  - `designSchema` (zod) and `defaultDesign`:
    - `primary` `#6d3df5`, `secondary` `#d8a54f`, `font` `'plex'`, `template` `'modern'`.
    - `showHijri` true, `weekStart` 0, `language` `'ar'`.
  - `FontKey = 'plex' | 'tajawal' | 'cairo' | 'readex' | 'kufi'`
  - `TemplateKey = 'modern' | 'official'`. Plan 2 extends this.
  - `GET /api/draft` returns `{calendar: {startMonth, selections, design}, events: CalendarEventView[]}`.
  - `PATCH /api/draft` accepts a partial `{startMonth?, selections?, design?}`. Each part is validated, and `startMonth` is normalized to day 1.
  - `POST /api/draft/events` accepts `{eventIds: string[]}` or `{custom: {titleAr, titleEn?, date, color?}}`. A custom date must fall inside the span.
  - `DELETE /api/draft/events?id=`.
  - `CalendarEventView = { id: string; eventId: string | null; title: string; kind: string; color: string; icon: string; occurrences: Occurrence[]; custom: boolean }`

- [ ] **Step 1: Write the failing route-handler tests**, calling the handlers directly with constructed `Request` objects and cookies.
  - **No cookie:** the response sets `rz_draft` (httpOnly, `Max-Age=7776000`).
  - **Isolation:** two different cookies yield different calendars. Adding an event under cookie A doesn't show it under cookie B.
  - **Forged cookie:** a value matching no row creates a new empty draft and never returns an existing one.
  - **Invalid design:** a PATCH with `design.primary: 'red'` returns 400.
  - **Custom date outside span:** a custom event dated outside the span returns 400.
  - **Duplicate add:** adding the same `eventId` twice is idempotent.
- [ ] **Step 2:** Run the tests and confirm they fail.
- [ ] **Step 3:** Implement the draft library and routes.
- [ ] **Step 4:** Run the tests again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: isolated anonymous drafts`.

### Task 7: Plan builder and recommendations UI

**Files:**
- Create: `src/app/(site)/page.tsx`, `src/components/plan-builder/{PlanBuilder,ChoiceChip,RecommendationCard}.tsx`, `tests/e2e/plan.spec.ts`

**Interfaces:**
- Consumes: `/api/recommendations`, `/api/draft`, `/api/draft/events` and the taxonomy (server-loaded from `taxonomyTerms`).

**What the page shows:**
- A short hero with one line of value and the stats: the number of occasions and how many are national.
- **The builder:**
  - Sector: single choice, shown as cards.
  - Field, audience and use: multi-choice chips.
  - Start month: select, next 12 months plus "January of next year", which is the default.
- Selections are saved to the draft on change, debounced by 500 ms.
- The «اقترح المناسبات» button shows ranked cards. Each card has the title, the Gregorian date, the Hijri date, a status badge (مؤكد or تقديري), a score ring, the reasons and an add/remove toggle.
- An «أضف كل الملاءمة العالية» button.
- A sticky bar shows «N مناسبة في تقويمك» with a link to `/calendar`.

- [ ] **Step 1: Write the failing e2e test `plan.spec.ts`.**
  - Pick الحكومي + الصحة + حملة توعوية, then click recommend.
  - The first card's reasons contain «الصحة».
  - A card «اليوم الوطني» is present.
  - Add 2 cards, and the sticky bar shows 2.
  - Reload, and the selections and the count of 2 persist.
  - In a new browser context, the count is 0, which is the isolation check.
- [ ] **Step 2:** Run it and confirm it fails.
- [ ] **Step 3:** Implement the page and components.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: plan builder and recommendations`.

### Task 8: Calendar page (month and list views, custom occasions)

**Files:**
- Create: `src/app/(site)/calendar/page.tsx`, `src/components/calendar/{MonthView,ListView,DayPanel,CustomEventForm}.tsx`, `tests/e2e/calendar.spec.ts`

**Interfaces:**
- Consumes: `monthGrid` and `formatHijri` (Task 3), and `/api/draft*` (Task 6).

**What the page shows:**
- Month view across the 12-month span, with prev/next limited to the span. Each cell shows the Gregorian day plus the small Hijri day.
- Occasion pills are colored by event color. Estimated dates get a dashed border.
- Clicking a day opens a `DayPanel`. It lists the day's occasions, which can be removed, and the recommended occasions not yet added, with an add button.
- The list view shows the occasions grouped by month.
- «أضف مناسبة خاصة» opens a form with Arabic title, optional English title, date and color.

- [ ] **Step 1: Write the failing e2e test.**
  - Seed a draft through the API with the National Day.
  - Navigate to September and see the «اليوم الوطني» pill on the 23rd.
  - Add a custom «ذكرى تأسيس الشركة» on 2027-05-10 and see it in May.
  - Remove it, and it is gone.
  - The list view shows the months in order.
  - Browser back returns to `/`.
- [ ] **Step 2:** Run it and confirm it fails.
- [ ] **Step 3:** Implement the page and components.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: calendar month/list views and custom occasions`.

### Task 9: Identity studio, logo handling, CalendarDocument with 2 templates

**Files:**
- Create: `src/lib/logo.ts`, `src/app/api/draft/logo/route.ts`, `src/app/(site)/studio/page.tsx`, `src/components/studio/StudioPanel.tsx`, `src/components/calendar-document/{CalendarDocument,CoverPage,MonthPage,WavesStamp,fonts}.tsx`, `src/components/calendar-document/templates/{modern,official}.tsx`, `tests/unit/logo.test.ts`, `tests/e2e/studio.spec.ts`

**Interfaces:**
- Produces:
  - `processLogo(file: { bytes: Buffer; mime: string; name: string }): Promise<{ path: string; palette: string[] }>`
    - It throws `LogoError` with code `TOO_LARGE`, `BAD_TYPE` or `CORRUPT`.
    - The type is checked by magic bytes using sharp metadata, not by the extension.
    - An SVG is rasterized by sharp to a PNG of at most 2000 px wide, and the original markup is discarded.
    - Raster images are re-encoded to PNG or WebP, which also strips metadata.
    - The palette has up to 5 hex colors, from node-vibrant.
  - `POST /api/draft/logo` takes multipart `file` and returns `{logoUrl, palette}`. Logos are served by `GET /api/draft/logo`, which checks the draft cookie, or by a render-secret query for the print route.
  - `<CalendarDocument data={CalendarSnapshot} format={PageFormat} mode="preview" | "print" />`
  - `type CalendarSnapshot = { design: Design; startMonth: string; months: { year: number; month0: number; weeks: (string | null)[][]; events: Record<string /*date*/, CalendarEventView[]> }[]; logoDataUrl: string | null }`
  - `buildSnapshot(calendarId: string): Promise<CalendarSnapshot>` in `src/lib/snapshot.ts`.
  - `type PageFormat = { kind: 'wall'; size: 'A4' | 'A3'; bleed: boolean }`. Plan 2 extends this.
  - Template registry: `templates: Record<TemplateKey, { labelAr, labelEn, Cover: FC, Month: FC }>`.

**What the studio shows:**
- **Settings panel:**
  - Org names (Arabic and English) and logo upload.
  - Suggested colors from the palette as one-click swatches, plus primary/secondary pickers.
  - Font select (5 fonts, each previewed in its own face).
  - Template cards and the title/subtitle.
  - Toggles: Hijri, week start, language (ar, en or bilingual), descriptions, color by kind, notes area.
- **Live preview:** cover and month pages with prev/next. It is scaled from the real mm-sized page to fit, so the preview matches the print exactly. The Waves stamp is always rendered and has no toggle.

- [ ] **Step 1: Write the failing unit tests `logo.test.ts`.**
  - A 6 MB buffer gives `TOO_LARGE`.
  - A text file renamed `.png` gives `BAD_TYPE`.
  - An SVG containing `<script>alert(1)</script>` is stored as a `.png`, and the stored file contains no `<script` bytes.
  - A PNG of a solid `#0a7f5a` square returns a palette whose first color is within ΔE < 10 of `#0a7f5a`.
- [ ] **Step 2: Write the failing e2e test `studio.spec.ts`.**
  - Type the org name «شركة الاختبار». The preview cover contains it.
  - Upload the fixture `tests/fixtures/logo.png`. The preview `img` is visible and the palette swatches appear.
  - Pick the official template. The preview root has `data-template="official"`.
  - Toggle Hijri off. The month cells have no `.hijri` elements.
  - `[data-waves-stamp]` is visible on every preview page.
  - Reload, and all settings persist.
- [ ] **Step 3:** Run both and confirm they fail.
- [ ] **Step 4:** Implement the logo processing, the snapshot builder, the CalendarDocument and the two templates, and the studio.
  - The two templates must differ in layout, not only in color:
    - **modern:** large month name, a colored band and rounded event pills.
    - **official:** centered logo header, a ruled grid and a formal serif-like Arabic heading in Noto Kufi.
  - Fonts are bundled through @fontsource as local files, so print rendering never depends on the network.
- [ ] **Step 5:** Run the tests again. Expected: PASS.
- [ ] **Step 6:** Commit with `feat: identity studio, safe logo processing, two calendar templates`.

### Task 10: Print route and wall-calendar PDF rendering

**Files:**
- Create: `src/lib/print-sizes.ts`, `src/app/print/[downloadId]/page.tsx`, `src/components/calendar-document/CropMarks.tsx`, `src/lib/render/pdf.ts`, `tests/unit/pdf.test.ts`

**Interfaces:**
- Produces:
  - `pageSizeMm(f: PageFormat): { width: number; height: number; bleed: number }`
    - A4 is 210×297 and A3 is 297×420.
    - `bleed` is 3 when `f.bleed` is true, otherwise 0. The width and height include 2×bleed.
  - Print route: `GET /print/<downloadId>?format=<base64url JSON PageFormat>&key=<RENDER_SECRET>`.
    - A wrong or missing key returns 404.
    - It renders the snapshot stored on the download row, not the live draft, so later edits don't change a requested file.
    - It sets `@page { size: Wmm Hmm; margin: 0 }`. Each page is a `section` with `break-after: page`.
    - With bleed on, the background extends into the bleed and the crop marks sit in the bleed corners.
  - `renderPdf(downloadId: string, format: PageFormat, outPath: string): Promise<{ pages: number; bytes: number }>`. It launches Chromium, navigates to the print route, waits for `document.fonts.ready`, then runs `page.pdf({ width:'Wmm', height:'Hmm', printBackground:true, preferCSSPageSize:true })`.

- [ ] **Step 1: Write the failing test `pdf.test.ts`.** It is an integration test: it creates a download row with a snapshot fixture (org «Waves للتقنية 2027», the National Day and Eid al-Fitr), then calls `renderPdf` for A4 with no bleed and for A3 with bleed.
  - **Pages:** 13 pages each (cover + 12 months).
  - **A4 size:** the first page MediaBox is 595.3×841.9 pt (±1), read with pdf-lib.
  - **A3 with bleed:** the first page is (297+6)×(420+6) mm in pt (±1).
  - **Arabic text:** `pdftotext` (poppler-utils) output contains «اليوم الوطني» as contiguous characters.
  - **Mixed text:** the output contains «Waves للتقنية 2027» in logical order.
- [ ] **Step 2:** Run it and confirm it fails.
- [ ] **Step 3:** Implement the print sizes, the print route, the crop marks and `renderPdf`.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: print route and wall-calendar PDF rendering`.

### Task 11: Download flow (form, queue, worker, email, download page)

**Files:**
- Create: `src/lib/downloads.ts`, `src/lib/email.ts`, `src/lib/turnstile.ts`, `src/app/api/downloads/route.ts`, `src/app/api/downloads/[token]/route.ts`, `src/app/api/files/[token]/[name]/route.ts`, `src/components/studio/DownloadDialog.tsx`, `src/app/(site)/download/[token]/page.tsx`, `src/app/(site)/privacy/page.tsx`, `worker/index.ts`, `tests/unit/downloads.test.ts`, `tests/e2e/download.spec.ts`

**Interfaces:**
- Consumes: `buildSnapshot` (Task 9), `renderPdf` (Task 10) and `getDraft` (Task 6).
- Produces:
  - `type FormatRequest = { kind: 'wall'; size: 'A4' | 'A3'; bleed: boolean }`
  - `createDownload(input: { calendarId: string; email: string; orgName: string; sector: string | null; fields: string[]; phone?: string; formats: FormatRequest[]; ip: string }): Promise<{ token: string; reused: boolean }>`
    - It throws `RateLimitError` past 5/hour for the email or 20/hour for the IP.
    - It reuses a non-failed download for the same `calendarId` and email created less than 2 minutes earlier.
    - Otherwise it inserts a lead and a download (`snapshot = buildSnapshot`, a 32-byte base64url token, `expiresAt = now + 7 days`), enqueues the pg-boss job `render-download` `{downloadId}`, and sends the email.
  - `sendDownloadEmail(to: string, lang: Lang, link: string, orgName: string)` uses Resend from `EMAIL_FROM`. The subject is «تقويم {orgName} جاهز للتحميل». The body is RTL HTML with the Waves logo, a button and a 7-day validity note.
  - `notifyNewLead(lead)` emails `LEAD_NOTIFY_EMAILS` when it is set. A failure is logged and never blocks the download.
  - The worker job `render-download` sets the status to `rendering`, renders each format to `FILES_DIR/<id>/roznamah-wall-<size>[-bleed].pdf`, then sets `ready` with the file list. On error it sets `failed` with `error`, retried twice by pg-boss.
  - `GET /api/downloads/:token` returns `{status, files, expired}`.
  - `GET /api/files/:token/:name` streams the file with `Content-Disposition: attachment`. It returns 410 if expired and 404 if the name is not in the files list, which also guards against path traversal.

**The download dialog:**
- Format checkboxes: wall A4, wall A3, and a print-shop version (bleed). The default is A4 without bleed.
- The fields and the notice text exactly as in Global Constraints, plus the Turnstile widget when configured.
- On success it shows «أرسلنا رابط التحميل إلى بريدك» with the email address.

**The download page** polls `/api/downloads/:token` every 3 s while the status is `queued` or `rendering`. It then lists the files, and shows an expired or failed state with a «اطلب مرة أخرى» button that links to the studio.

- [ ] **Step 1: Write the failing unit tests `downloads.test.ts`.** Mock the email module and the queue.
  - **Reuse:** two calls within 2 minutes with the same calendar and email return the same token and `reused: true`, with 1 job enqueued.
  - **Email rate limit:** the 6th call in an hour for one email throws `RateLimitError`.
  - **Snapshot frozen:** the snapshot is stored, and a later change to the draft design doesn't change `downloads.snapshot`.
  - **Expired link:** an expired token gives `expired: true` from the status route and 410 from the files route.
  - **Traversal:** the files route with name `../../etc/passwd` returns 404.
  - **Phone:** `0512345678` is valid and `12345` returns 400.
- [ ] **Step 2: Write the failing e2e test `download.spec.ts`.**
  - Run with a test worker and `EMAIL_TRANSPORT=memory`. In memory mode `email.ts` records messages in a module array exposed via `GET /api/test/outbox`, which exists only when `NODE_ENV=test`.
  - Build the draft, open the studio, then download A4 with the email `test@example.com`.
  - The outbox has one message to that address, and its link opens the download page.
  - Within 60 s the page lists `roznamah-wall-A4.pdf`, and downloading it gives a PDF of more than 50 KB.
- [ ] **Step 3:** Run both and confirm they fail.
- [ ] **Step 4:** Implement the download library, the email and Turnstile helpers, the routes, the dialog, the download page, the privacy page and the worker.
  - The privacy page is short Arabic and English text: what is collected (email, org, sector, phone), why (delivery and Waves contacting the customer about its services), the retention times from spec §12.1, and how to request deletion (an email to Waves).
- [ ] **Step 5:** Run the tests again. Expected: PASS.
- [ ] **Step 6:** Commit with `feat: email-gated download flow with background rendering`.

### Task 12: Admin panel (auth, occasions, leads)

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/app/admin/{layout,page}.tsx`, `src/app/admin/events/{page,[id]/page}.tsx`, `src/app/admin/leads/page.tsx`, `src/app/admin/taxonomy/page.tsx`, `src/app/api/admin/events/route.ts`, `src/app/api/admin/events/[id]/route.ts`, `src/app/api/admin/events/[id]/occurrences/route.ts`, `src/app/api/admin/leads/export/route.ts`, `tests/unit/admin.test.ts`, `tests/e2e/admin.spec.ts`

**Interfaces:**
- Produces:
  - `isAdmin(email: string | null | undefined): boolean`, which checks against `ADMIN_EMAILS`.
  - `requireAdmin(): Promise<Session>`, which throws a 403 response otherwise.
- Auth.js uses the Resend magic-link provider. Sign-in is refused at the `signIn` callback for non-admins, so no account is created for them.

**What the admin panel shows:**
- **Overview:** total occasions, estimated dates in the next 6 months that need confirming, leads this week and in total.
- **Occasions:**
  - A table with search and filters by kind and active status.
  - An edit form for every event field, plus tags with weights.
  - Per-year occurrences: add or override a date and its status.
- **Taxonomy:** edit the labels and order, and activate or deactivate terms. Deleting a term is not allowed, only deactivating it.
- **Leads:**
  - A paginated table, newest first, with columns: org, sector, fields, email, phone, formats and date.
  - Filters by sector and date range.
  - «تصدير Excel» via ExcelJS, with the same columns and Arabic headers.

- [ ] **Step 1: Write the failing tests.**
  - **Unit:** `isAdmin('A@Waves.sa')` is true when `ADMIN_EMAILS='a@waves.sa'`. The admin events POST without a session returns 403. Overriding the occurrence for (`eid-al-fitr`, 2027) to `2027-03-10` makes `resolveOccurrences` return it as `confirmed`.
  - **e2e:** an unauthenticated `/admin` redirects to sign-in. With a seeded admin session cookie (a test helper that creates a session row): edit the Arabic title of `flag-day`, and the public recommendations show the new title. The leads export downloads a `.xlsx` whose first sheet row 1 contains «الجهة».
- [ ] **Step 2:** Run them and confirm they fail.
- [ ] **Step 3:** Implement auth, the middleware, the pages and the routes.
- [ ] **Step 4:** Run the tests again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: protected admin for occasions, taxonomy and leads`.

### Task 13: Full-journey e2e and polish pass

**Files:**
- Create: `tests/e2e/journey.spec.ts`
- Modify: any component the test exposes as broken

- [ ] **Step 1: Write `journey.spec.ts`** at a 390×844 viewport in Arabic.
  - Landing, then choose the private sector + التجزئة + محتوى تسويقي.
  - Recommend and add all high matches.
  - Calendar: open November and see that White Friday is present.
  - Studio: set the name and logo, and pick the official template.
  - Download A4, open the emailed link, and see the file listed.
  - No horizontal scroll on any page.
  - No console errors.
  - Repeat the same flow in English at 1366×900.
- [ ] **Step 2:** Run `npx playwright test --trace off`. All the spec files pass.
- [ ] **Step 3:** Commit with `test: full customer journey e2e`.

### Task 14: Production deployment on the Waves VPS

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `deploy/docker-compose.prod.yml`, `deploy/README.md`, `.github/workflows/image.yml`

**Interfaces:**
- **Image:** multi-stage. The build stage is `node:22-bookworm` and runs `next build` with `output: 'standalone'`. The runtime stage is `mcr.microsoft.com/playwright:v1.<same as package>-noble`, so Chromium and its deps are included, plus `poppler-utils` is not needed in production.
- **Commands:** `node server.js` for the app and `node worker/dist/index.js` for the worker, with the worker compiled via tsup.
- **Compose project `roznamah`:**
  - `db`: postgres:17-alpine with the volume `roznamah-db`.
  - `migrate`: a one-shot that runs `drizzle-kit migrate && npm run db:seed`.
  - `app`: Traefik labels for host `${APP_HOST}` with TLS via the existing certresolver, and the volume `roznamah-data:/data`.
  - `worker`: `mem_limit: 2g`, the same volume.
  - `UPLOAD_DIR=/data/uploads` and `FILES_DIR=/data/files`.
  - `app` joins Traefik's external network. Read its name from `/docker/traefik/docker-compose.yml` on the VPS before writing the labels.
  - Nightly DB backup: a `backup` service running `pg_dump` to `/data/backups`, keeping 14 days.
- **Image publishing:** GitHub Actions builds and pushes `ghcr.io/<owner>/roznamah:<sha>` and `:latest`.

- [ ] **Step 1: Prerequisites from Waves**, blocking:
  - The GitHub repo owner/name to push to.
  - `APP_HOST` (domain) with its DNS A record pointing to `186.240.150.99`.
  - The verified Resend sending domain and `EMAIL_FROM`.
  - `ADMIN_EMAILS`.
  - The Waves logo and stamp files, which replace the placeholder in `WavesStamp`.
- [ ] **Step 2:** Build the image locally and run the compose file against it. Expected: `curl -fsS localhost:3000/` returns 200 and the journey e2e passes against it.
- [ ] **Step 3:** Push the repo and confirm the workflow publishes the image.
- [ ] **Step 4:** Create the `roznamah` Compose project on VM `1881963` with the Hostinger `vps_docker` create operation and the prod compose. Set the secrets as environment values in the project, never committed.
- [ ] **Step 5:** Verify:
  - `https://<APP_HOST>/` returns 200 with a valid certificate.
  - A real download email arrives at a Waves inbox and its PDF opens.
  - `vps_docker_list` shows the other projects (odoo-sz5m, snipe-it-2rrb, traefik, waves-hr, wsc) still `running` with unchanged container counts.
- [ ] **Step 6:** Commit with `chore: production deployment`.
