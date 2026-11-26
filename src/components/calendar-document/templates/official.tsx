/**
 * Official: a double-ruled frame, a centered letterhead with the logo, formal Noto Kufi headings
 * and a ruled table grid with marked lines for occasions.
 */
import { toHijri } from '@/lib/dates/hijri';
import type { SnapshotMonth } from '@/lib/snapshot-core';
import { hijriRange, isWeekend, monthName, monthOccasions, gridDays, weekDows, weekdayName, yearRange } from '../doc';
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

const Ornament = () => (
  <div className="rzo-ornament" aria-hidden>
    <span className="rzo-ornament-line" />
    <span className="rzo-ornament-diamond" />
    <span className="rzo-ornament-line" />
  </div>
);

function Frame() {
  return (
    <div className="rzo-frame" aria-hidden>
      {['ts', 'te', 'bs', 'be'].map((c) => (
        <span key={c} className={`rzo-corner rzo-corner-${c}`} />
      ))}
    </div>
  );
}

function Footer({ ctx, month, page }: { ctx: DocContext; month?: SnapshotMonth; page?: string }) {
  return (
    <footer className="rzo-footer">
      <div className="rzo-footer-side">
        <Legend ctx={ctx} month={month} />
      </div>
      <WavesStamp lang={ctx.langs.main} />
      <div className="rzo-footer-side rzo-footer-end">
        <span dir="ltr">{page}</span>
      </div>
    </footer>
  );
}

function Month({ ctx, month, index }: MonthProps) {
  const { design, langs } = ctx;
  const dows = weekDows(design.weekStart);
  const weeks = gridDays(month);
  return (
    <>
      <Frame />
      <header className="rzo-head">
        <div className="rzo-letterhead">
          <OrgLogo ctx={ctx} className="rzo-logo" />
          {ctx.org && <span className="rzo-org">{ctx.org}</span>}
        </div>
        <div className="rzo-title-row">
          <span className="rzo-title-rule" />
          <h2 className="rzo-month">
            {monthName(langs.main, month.year, month.month0)} <span className="rzo-month-year">{month.year}</span>
          </h2>
          <span className="rzo-title-rule" />
        </div>
        <div className="rzo-subtitle-row">
          {langs.second && (
            <Second lang={langs.second} className="rzo-month2">
              {monthName(langs.second, month.year, month.month0)} {month.year}
            </Second>
          )}
          {design.showHijri && <span className="rzo-hijri-range">{hijriRange(langs.main, month.year, month.month0)}</span>}
        </div>
      </header>

      <div className="rzo-table">
        {dows.map((dow) => (
          <div key={`h${dow}`} className={`rzo-th ${isWeekend(dow) ? 'is-weekend' : ''}`}>
            {weekdayName(langs.main, dow)}
            <Second lang={langs.second}>{langs.second && weekdayName(langs.second, dow, 'short')}</Second>
          </div>
        ))}
        {weeks.map((week) =>
          week.map(({ iso, inMonth }, ci) => (
            <div
              key={iso}
              className={`rzo-td ${isWeekend(dows[ci]) ? 'is-weekend' : ''} ${inMonth ? '' : 'is-outside'}`}
              data-date={inMonth ? iso : undefined}
              aria-hidden={inMonth ? undefined : true}
            >
              {inMonth ? (
                <>
                  <DayNumbers ctx={ctx} iso={iso} />
                  <CellEvents ctx={ctx} events={month.events[iso] ?? []} variant="line" />
                </>
              ) : (
                <span className="rz-gday">{Number(iso.slice(8))}</span>
              )}
            </div>
          )),
        )}
      </div>

      <div className="rzo-bottom">
        <OccasionNotes ctx={ctx} month={month} variant="official" />
        <NotesArea ctx={ctx} lines={2} />
      </div>
      <Footer ctx={ctx} month={month} page={`${index + 1} / 12`} />
    </>
  );
}

function Cover({ ctx }: CoverProps) {
  const { design, langs, snap } = ctx;
  const first = snap.months[0];
  const last = snap.months[snap.months.length - 1];
  const h0 = toHijri(new Date(Date.UTC(first.year, first.month0, 1, 12))).year;
  const h1 = toHijri(new Date(Date.UTC(last.year, last.month0 + 1, 0, 12))).year;
  return (
    <>
      <Frame />
      <section className="rzo-cover">
        <div className="rzo-cover-head">
          <OrgLogo ctx={ctx} className="rzo-cover-logo" />
          {ctx.org && <p className="rzo-cover-org">{ctx.org}</p>}
          {ctx.org2 && (
            <Second lang={langs.second} className="rzo-cover-org2">
              {ctx.org2}
            </Second>
          )}
        </div>
        <Ornament />
        <h1 className="rzo-cover-title">{ctx.title}</h1>
        {design.subtitle && <p className="rzo-cover-subtitle">{design.subtitle}</p>}
        <p className="rzo-cover-range">{yearRange(langs.main, snap)}</p>
        {langs.second && (
          <Second lang={langs.second} className="rzo-cover-range2">
            {yearRange(langs.second, snap)}
          </Second>
        )}
        {design.showHijri && (
          <p className="rzo-cover-hijri">
            {h0 === h1 ? h0 : `${h0} – ${h1}`} {ctx.t('doc.hijriEra')}
          </p>
        )}
        <Ornament />
        <table className="rzo-cover-months">
          <tbody>
            {[snap.months.slice(0, 6), snap.months.slice(6)].map((row, ri) => (
              <tr key={ri}>
                {row.map((m) => (
                  <td key={`${m.year}-${m.month0}`}>
                    <span className="rzo-cm-name">{monthName(langs.main, m.year, m.month0)}</span>
                    <span className="rzo-cm-count">{monthOccasions(m).length}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rzo-cover-caption">{ctx.t('doc.perMonth')}</p>
      </section>
      <Footer ctx={ctx} />
    </>
  );
}

export const official: Template = { labelAr: 'رسمي', labelEn: 'Official', Cover, Month };
