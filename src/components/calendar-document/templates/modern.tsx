/**
 * Modern: a full-bleed color band with a large month name, a soft card grid and rounded event
 * pills; the cover pairs a bold color field with a year-at-a-glance.
 */
import type { CSSProperties } from 'react';
import { weekdayInitial, hijriRange, isWeekend, monthName, gridDays, weekDows, weekdayName, yearRange } from '../doc';
import {
  CellEvents,
  DayNumbers,
  Legend,
  NotesArea,
  OccasionNotes,
  OrgLogo,
  Second,
  type CoverProps,
  type DocContext,
  type MonthProps,
  type Template,
} from '../primitives';
import { WavesStamp } from '../WavesStamp';
import type { SnapshotMonth } from '@/lib/snapshot-core';

function Footer({ ctx, month, page }: { ctx: DocContext; month?: SnapshotMonth; page?: string }) {
  return (
    <footer className="rzm-footer">
      <div className="rzm-footer-start">
        {page && (
          <span className="rzm-page-no" dir="ltr">
            {page}
          </span>
        )}
        <Legend ctx={ctx} month={month} />
      </div>
      <WavesStamp lang={ctx.langs.main} />
    </footer>
  );
}

function Month({ ctx, month, index }: MonthProps) {
  const { design, langs } = ctx;
  const dows = weekDows(design.weekStart);
  const weeks = gridDays(month);
  return (
    <>
      <header className="rzm-band">
        <div className="rzm-band-bg" aria-hidden>
          <span className="rzm-orb rzm-orb-a" />
          <span className="rzm-orb rzm-orb-b" />
        </div>
        <div className="rzm-band-title">
          <span className="rzm-month-no">{String(month.month0 + 1).padStart(2, '0')}</span>
          <h2 className="rzm-month">{monthName(langs.main, month.year, month.month0)}</h2>
          <div className="rzm-month-meta">
            <span className="rzm-year">{month.year}</span>
            {langs.second && (
              <Second lang={langs.second} className="rzm-month2">
                {monthName(langs.second, month.year, month.month0)}
              </Second>
            )}
            {design.showHijri && <span className="rzm-hijri-range">{hijriRange(langs.main, month.year, month.month0)}</span>}
          </div>
        </div>
        <div className="rzm-band-org">
          {ctx.logo && (
            <div className="rzm-logo-card">
              <OrgLogo ctx={ctx} />
            </div>
          )}
          {ctx.org && <span className="rzm-org">{ctx.org}</span>}
        </div>
      </header>

      <div className="rzm-body">
        <div className="rzm-weekdays">
          {dows.map((dow) => (
            <div key={dow} className={`rzm-weekday ${isWeekend(dow) ? 'is-weekend' : ''}`}>
              {weekdayName(langs.main, dow)}
              <Second lang={langs.second}>{langs.second && weekdayName(langs.second, dow, 'short')}</Second>
            </div>
          ))}
        </div>
        <div className="rzm-grid">
          {weeks.map((week) =>
            week.map(({ iso, inMonth }, ci) =>
              inMonth ? (
                <div key={iso} className={`rzm-cell ${isWeekend(dows[ci]) ? 'is-weekend' : ''}`} data-date={iso}>
                  <DayNumbers ctx={ctx} iso={iso} />
                  <CellEvents ctx={ctx} events={month.events[iso] ?? []} variant="pill" />
                </div>
              ) : (
                <div key={iso} className="rzm-cell is-outside" aria-hidden>
                  <span className="rz-gday">{Number(iso.slice(8))}</span>
                </div>
              ),
            ),
          )}
        </div>
        <OccasionNotes ctx={ctx} month={month} variant="modern" />
        <NotesArea ctx={ctx} lines={2} />
      </div>
      <Footer ctx={ctx} month={month} page={`${String(index + 1).padStart(2, '0')} / 12`} />
    </>
  );
}

function MiniMonth({ ctx, month }: { ctx: DocContext; month: SnapshotMonth }) {
  const { design, langs } = ctx;
  const dows = weekDows(design.weekStart);
  return (
    <div className="rzm-mini">
      <div className="rzm-mini-name">{monthName(langs.main, month.year, month.month0)}</div>
      <div className="rzm-mini-grid">
        {dows.map((dow) => (
          <span key={`h${dow}`} className={`rzm-mini-dow ${isWeekend(dow) ? 'is-weekend' : ''}`}>
            {weekdayInitial(langs.main, dow)}
          </span>
        ))}
        {month.weeks.flat().map((iso, i) => {
          if (!iso) return <span key={i} />;
          const evs = month.events[iso] ?? [];
          const style = evs.length ? ({ '--ev': ctx.colorOf(evs[0]) } as CSSProperties) : undefined;
          return (
            <span key={iso} className={`rzm-mini-day ${evs.length ? 'has-event' : ''}`} style={style}>
              {Number(iso.slice(8))}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Cover({ ctx }: CoverProps) {
  const { design, langs, snap } = ctx;
  const count = new Set(snap.months.flatMap((m) => Object.values(m.events).flat().map((e) => `${e.id}|${e.start}`))).size;
  return (
    <>
      <section className="rzm-cover-hero">
        <div className="rzm-cover-bg" aria-hidden>
          <span className="rzm-orb rzm-orb-c" />
          <span className="rzm-orb rzm-orb-d" />
          <span className="rzm-cover-year-ghost">{snap.months[0].year}</span>
        </div>
        <div className="rzm-cover-top">
          {ctx.logo ? (
            <div className="rzm-logo-card rzm-logo-card-lg">
              <OrgLogo ctx={ctx} />
            </div>
          ) : (
            <span />
          )}
          <span className="rzm-cover-range">{yearRange(langs.main, snap)}</span>
        </div>
        <div className="rzm-cover-text">
          {ctx.org && <p className="rzm-cover-org">{ctx.org}</p>}
          {ctx.org2 && (
            <Second lang={langs.second} className="rzm-cover-org2">
              {ctx.org2}
            </Second>
          )}
          <h1 className="rzm-cover-title">{ctx.title}</h1>
          {design.subtitle && <p className="rzm-cover-subtitle">{design.subtitle}</p>}
          {langs.second && (
            <Second lang={langs.second} className="rzm-cover-range2">
              {yearRange(langs.second, snap)}
            </Second>
          )}
        </div>
      </section>
      <section className="rzm-glance">
        <h3 className="rz-section-title">
          {ctx.t('doc.yearAtGlance')}
          <Second lang={langs.second}>{ctx.t2('doc.yearAtGlance')}</Second>
          {count > 0 && (
            <span className="rzm-glance-count">
              {count} {ctx.t('doc.occasionsCount')}
            </span>
          )}
        </h3>
        <div className="rzm-glance-grid">
          {snap.months.map((m) => (
            <MiniMonth key={`${m.year}-${m.month0}`} ctx={ctx} month={m} />
          ))}
        </div>
      </section>
      <Footer ctx={ctx} />
    </>
  );
}

export const modern: Template = { labelAr: 'عصري', labelEn: 'Modern', Cover, Month };
