/** Building blocks shared by both templates. */
import type { CSSProperties, FC, ReactNode } from 'react';
import { t, type Lang, type MessageKey } from '@/i18n/core';
import type { Design } from '@/lib/design';
import type { CalendarSnapshot, SnapshotEvent, SnapshotMonth } from '@/lib/snapshot-core';
import {
  daySpan,
  docLangs,
  docTitle,
  eventColor,
  eventDescription,
  eventTitle,
  hijriDay,
  kindColor,
  kindLabel,
  KINDS,
  monthOccasions,
  orgName,
  readableOn,
  type DocLangs,
} from './doc';

/** Everything a template needs, computed once per document. */
export type DocContext = {
  snap: CalendarSnapshot;
  design: Design;
  langs: DocLangs;
  /** Copy in the main document language. */
  t: (key: MessageKey) => string;
  /** Copy in the bilingual companion language, or null. */
  t2: (key: MessageKey) => string | null;
  logo: string | null;
  org: string;
  org2: string | null;
  title: string;
  colorOf: (ev: SnapshotEvent) => string;
};

export function makeContext(snap: CalendarSnapshot): DocContext {
  const { design } = snap;
  const langs = docLangs(design.language);
  const org = orgName(design, langs.main);
  const org2 = langs.second ? orgName(design, langs.second) : null;
  return {
    snap,
    design,
    langs,
    t: (key) => t(langs.main, key),
    t2: (key) => (langs.second ? t(langs.second, key) : null),
    logo: snap.logoDataUrl,
    org,
    org2: org2 && org2 !== org ? org2 : null,
    title: docTitle(design, langs.main, snap),
    colorOf: (ev) => eventColor(ev, design),
  };
}

export type CoverProps = { ctx: DocContext };
export type MonthProps = { ctx: DocContext; month: SnapshotMonth; index: number };
export type Template = { labelAr: string; labelEn: string; Cover: FC<CoverProps>; Month: FC<MonthProps> };

/**
 * Secondary-language text (bilingual mode), in its own direction; CSS keeps it aligned with the
 * main text (so an English line under Arabic still sits on the right).
 */
export function Second({ lang, children, className = '' }: { lang: Lang | null; children: ReactNode; className?: string }) {
  if (!lang || !children) return null;
  return (
    <span lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className={`rz-second ${className}`}>
      {children}
    </span>
  );
}

export function OrgLogo({ ctx, className = '' }: { ctx: DocContext; className?: string }) {
  if (!ctx.logo) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img data-logo className={`rz-logo ${className}`} src={ctx.logo} alt={ctx.org} />;
}

/** Gregorian day + optional small Hijri day (month name on the 1st). */
export function DayNumbers({ ctx, iso }: { ctx: DocContext; iso: string }) {
  const h = ctx.design.showHijri ? hijriDay(ctx.langs.main, iso) : null;
  return (
    <div className="rz-daynums">
      <span className="rz-gday">{Number(iso.slice(8, 10))}</span>
      {h && (
        <span className="hijri">
          {h.month ? `${h.day} ${h.month}` : h.day}
        </span>
      )}
    </div>
  );
}

/*
 * Day-cell budget, in mm: the height under the day numbers, measured on the A4 artboard with a full
 * descriptions list (8 items), minus a 1.5 mm safety margin. Occasions are laid out to fit it, so
 * the printed cell never cuts a label in half; the «+N» line sits outside the clipped area.
 * (Measured: modern 16.3 / official 19.8 with descriptions and notes on; the list adds ~7.4, the
 * notes area ~3.8.) tests/e2e/studio.spec.ts checks the densest case renders whole labels.
 */
export function cellBudgetMm(design: Design): number {
  const base = design.template === 'official' ? 19.8 : 16.3;
  return base + (design.showDescriptions ? 0 : 7.4) + (design.notesArea ? 0 : 3.8) - 1.5;
}
const TITLE_LINE_MM = 2.75; // 6.1pt × 1.28
const SECOND_LINE_MM = 2.4; // 5.3pt × 1.28
const GAP_MM = 0.6;
const MORE_MM = 2.6;

export type CellLayout = { shown: number; clamps: number[]; more: number };

/** How many occasions a cell shows, and how many title lines each may use. */
export function cellLayout(count: number, bilingual: boolean, variant: 'pill' | 'line', budget: number): CellLayout {
  const pad = variant === 'pill' ? 1 : 0.2;
  const cost = pad + TITLE_LINE_MM + (bilingual ? SECOND_LINE_MM : 0) + GAP_MM;
  const fit = Math.max(1, Math.floor((budget + GAP_MM) / cost));
  const shown = count <= fit ? count : Math.max(1, Math.floor((budget - MORE_MM) / cost));
  const more = count - shown;
  let spare = budget + GAP_MM - shown * cost - (more ? MORE_MM + GAP_MM : 0);
  const clamps = Array.from({ length: shown }, () => {
    if (spare >= TITLE_LINE_MM) {
      spare -= TITLE_LINE_MM;
      return 2;
    }
    return 1;
  });
  return { shown, clamps, more };
}

/** An occasion inside a day cell: a filled pill (modern) or a marked line (official). */
export function EventLabel({
  ctx,
  ev,
  variant,
  lines,
}: {
  ctx: DocContext;
  ev: SnapshotEvent;
  variant: 'pill' | 'line';
  /** Title lines this label may use (1 or 2). */
  lines: number;
}) {
  const color = ctx.colorOf(ev);
  const estimated = ev.status === 'estimated';
  const style = {
    '--ev': color,
    '--ev-ink': readableOn(color),
    '--clamp': lines,
  } as CSSProperties;
  const second = ctx.langs.second ? eventTitle(ev, ctx.langs.second) : null;
  return (
    <div
      className={`rz-ev rz-ev-${variant} ${estimated ? 'is-estimated' : ''}`}
      style={style}
      data-status={ev.status}
    >
      {variant === 'line' && <span className="rz-ev-mark" aria-hidden />}
      <span className="rz-ev-text">
        <span className="rz-ev-title">{eventTitle(ev, ctx.langs.main)}</span>
        {second && second !== eventTitle(ev, ctx.langs.main) && (
          <Second lang={ctx.langs.second} className="rz-ev-title2">
            {second}
          </Second>
        )}
      </span>
      {estimated && <span className="rz-est-dot" aria-hidden />}
    </div>
  );
}

/** A day's occasions: whole labels that fit the cell, then a never-clipped «+N» line. */
export function CellEvents({ ctx, events, variant }: { ctx: DocContext; events: SnapshotEvent[]; variant: 'pill' | 'line' }) {
  if (!events.length) return null;
  const { shown, clamps, more } = cellLayout(events.length, !!ctx.langs.second, variant, cellBudgetMm(ctx.design));
  return (
    <>
      <div className="rz-cell-events">
        {events.slice(0, shown).map((ev, i) => (
          <EventLabel key={`${ev.id}-${ev.start}`} ctx={ctx} ev={ev} variant={variant} lines={clamps[i]} />
        ))}
      </div>
      {more > 0 && (
        <span className="rz-more">
          +{more} {ctx.t('doc.more')}
        </span>
      )}
    </>
  );
}

const MAX_NOTES = 8;

/** The month's occasions with a short description (design.showDescriptions). */
export function OccasionNotes({ ctx, month, variant }: { ctx: DocContext; month: SnapshotMonth; variant: 'modern' | 'official' }) {
  const items = monthOccasions(month);
  if (!ctx.design.showDescriptions || !items.length) return null;
  const shown = items.slice(0, MAX_NOTES);
  return (
    <section className={`rz-notes rz-notes-${variant}`}>
      <h3 className="rz-section-title">
        {ctx.t('doc.occasions')}
        <Second lang={ctx.langs.second}>{ctx.t2('doc.occasions')}</Second>
      </h3>
      <ol className="rz-notes-list">
        {shown.map((ev) => {
          const description = eventDescription(ev, ctx.langs.main);
          return (
            <li
              key={`${ev.id}-${ev.start}`}
              className="rz-note"
              style={{ '--ev': ctx.colorOf(ev), '--ev-ink': readableOn(ctx.colorOf(ev)) } as CSSProperties}
            >
              <span className="rz-note-day">{daySpan(ev)}</span>
              <span className="rz-note-body">
                <span className="rz-note-title">
                  {eventTitle(ev, ctx.langs.main)}
                  {ctx.langs.second && (
                    <Second lang={ctx.langs.second} className="rz-note-title2">
                      {eventTitle(ev, ctx.langs.second)}
                    </Second>
                  )}
                </span>
                {description && <span className="rz-note-desc">{description}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {items.length > MAX_NOTES && (
        <p className="rz-notes-more">
          +{items.length - MAX_NOTES} {ctx.t('doc.more')}
        </p>
      )}
    </section>
  );
}

export function NotesArea({ ctx, lines = 3 }: { ctx: DocContext; lines?: number }) {
  if (!ctx.design.notesArea) return null;
  return (
    <section className="rz-notes-area">
      <h3 className="rz-section-title">
        {ctx.t('doc.notes')}
        <Second lang={ctx.langs.second}>{ctx.t2('doc.notes')}</Second>
      </h3>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="rz-rule" />
      ))}
    </section>
  );
}

/** Estimated-date key and (when coloring by kind) the kind colors used this month. */
export function Legend({ ctx, month }: { ctx: DocContext; month?: SnapshotMonth }) {
  const events = month ? monthOccasions(month) : [];
  const hasEstimated = events.some((e) => e.status === 'estimated');
  const kinds = ctx.design.colorByKind ? KINDS.filter((k) => events.some((e) => e.kind === k)) : [];
  if (!hasEstimated && !kinds.length) return <div className="rz-legend" />;
  return (
    <div className="rz-legend">
      {kinds.map((k) => (
        <span key={k} className="rz-legend-item">
          <span className="rz-legend-swatch" style={{ background: kindColor(k, ctx.design) }} />
          {kindLabel(k, ctx.langs.main)}
        </span>
      ))}
      {hasEstimated && (
        <span className="rz-legend-item">
          <span className="rz-est-dot" aria-hidden />
          {ctx.t('doc.estimated')}
        </span>
      )}
    </div>
  );
}
