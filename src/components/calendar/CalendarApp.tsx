'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t, type Lang } from '@/i18n/core';
import { useDraftEvents } from '@/components/plan-builder/useDraftEvents';
import type { CalendarEventView } from '@/lib/draft';
import type { Recommendation, Selections } from '@/lib/recommend';
import { CustomEventForm } from './CustomEventForm';
import { DayPanel, type RecState } from './DayPanel';
import { ListView } from './ListView';
import { MonthView } from './MonthView';
import { covers, flattenItems, monthLabel, spanBounds, spanMonths } from './util';

type Props = {
  lang: Lang;
  startMonth: string;
  weekStart: 0 | 1 | 6;
  primary: string;
  today: string;
  selections: Selections;
  initialEvents: CalendarEventView[];
};

type View = 'month' | 'list';

const Chevron = ({ flip }: { flip?: boolean }) => (
  <svg viewBox="0 0 20 20" className={`size-5 ${flip ? 'rotate-180 rtl:rotate-0' : 'rtl:rotate-180'}`} aria-hidden>
    <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function CalendarApp({ lang, startMonth, weekStart, primary, today, selections, initialEvents }: Props) {
  const draft = useDraftEvents(initialEvents);
  const months = useMemo(() => spanMonths(startMonth), [startMonth]);
  const bounds = useMemo(() => spanBounds(startMonth), [startMonth]);
  const items = useMemo(() => flattenItems(draft.events), [draft.events]);

  const [index, setIndex] = useState(() => {
    const i = months.findIndex((m) => m.key === today.slice(0, 7));
    return i >= 0 ? i : 0;
  });
  const [view, setView] = useState<View>('month');
  const [day, setDay] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [recs, setRecs] = useState<RecState>({ status: 'loading' });
  const recsRequested = useRef(false);
  const [dismissed, setDismissed] = useState(false);

  const month = months[index];
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const it of items) c.set(it.occ.start.slice(0, 7), (c.get(it.occ.start.slice(0, 7)) ?? 0) + 1);
    return c;
  }, [items]);

  // Recommendations are fetched once, the first time a day is opened.
  useEffect(() => {
    if (!day || recsRequested.current) return;
    recsRequested.current = true;
    fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selections, startMonth }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { items: Recommendation[] }) => setRecs({ status: 'ready', items: body.items }))
      .catch(() => setRecs({ status: 'error' }));
  }, [day, selections, startMonth]);

  useEffect(() => {
    if (draft.failure) setDismissed(false);
  }, [draft.failure]);

  const failureText = draft.failure && !dismissed ? t(lang, draft.failure === 'add' ? 'calendar.err.add' : 'calendar.err.remove') : null;
  const dayItems = day ? items.filter((it) => covers(it.occ, day)) : [];
  const empty = draft.events.length === 0;

  const openCustom = (date?: string) => {
    const d = date ?? (month.key === today.slice(0, 7) ? today : `${month.key}-01`);
    setCustomDate(d < bounds.min ? bounds.min : d > bounds.max ? bounds.max : d);
  };

  const select = (iso: string) => {
    setDay(iso);
  };

  const jumpFromList = (iso: string) => {
    const i = months.findIndex((m) => m.key === iso.slice(0, 7));
    if (i >= 0) setIndex(i);
    setDay(iso);
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">{t(lang, 'calendar.title')}</h1>
          <p className="text-sm text-muted">
            <span data-testid="calendar-count" className="font-semibold text-brand">
              {draft.count}
            </span>{' '}
            {t(lang, 'calendar.count')}
          </p>
        </div>
        <button
          type="button"
          data-testid="add-custom"
          onClick={() => openCustom()}
          className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          + {t(lang, 'calendar.addCustom')}
        </button>
      </header>

      {failureText && (
        <div
          role="alert"
          data-testid="calendar-error"
          className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{failureText}</span>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              draft.clearFailure();
            }}
            className="shrink-0 rounded-lg px-2 py-1 font-semibold hover:bg-red-100"
          >
            {t(lang, 'calendar.err.dismiss')}
          </button>
        </div>
      )}

      {empty ? (
        <section
          data-testid="calendar-empty"
          className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-line bg-surface px-6 py-14 text-center"
        >
          <span aria-hidden className="flex size-16 items-center justify-center rounded-2xl bg-[#f1ecff] text-3xl">
            📅
          </span>
          <h2 className="text-xl font-semibold">{t(lang, 'calendar.empty.title')}</h2>
          <p className="max-w-md text-muted">{t(lang, 'calendar.empty.body')}</p>
          <Link
            href="/"
            data-testid="calendar-empty-cta"
            className="min-h-11 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            {t(lang, 'calendar.empty.cta')}
          </Link>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label={t(lang, 'calendar.views')} className="inline-flex rounded-full border border-line bg-surface p-1">
              {(['month', 'list'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  data-testid={`view-${v}`}
                  onClick={() => setView(v)}
                  className={`min-h-9 rounded-full px-5 text-sm font-semibold transition ${
                    view === v ? 'bg-brand text-white shadow-sm' : 'text-ink hover:text-brand'
                  }`}
                >
                  {t(lang, v === 'month' ? 'calendar.view.month' : 'calendar.view.list')}
                </button>
              ))}
            </div>
            <ul className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-3 w-5 rounded-sm border border-dashed" style={{ borderColor: primary, background: `${primary}22` }} />
                {t(lang, 'calendar.legend.estimated')}
              </li>
            </ul>
          </div>

          {view === 'month' ? (
            <section aria-label={monthLabel(lang, month.year, month.month0)} className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  data-testid="month-prev"
                  aria-label={t(lang, 'calendar.prev')}
                  disabled={index === 0}
                  onClick={() => setIndex(index - 1)}
                  className="flex size-11 items-center justify-center rounded-full border border-line bg-surface transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:text-inherit"
                >
                  <Chevron />
                </button>
                <h2 data-testid="month-title" aria-live="polite" className="text-xl font-semibold md:text-2xl">
                  {monthLabel(lang, month.year, month.month0)}
                </h2>
                <button
                  type="button"
                  data-testid="month-next"
                  aria-label={t(lang, 'calendar.next')}
                  disabled={index === 11}
                  onClick={() => setIndex(index + 1)}
                  className="flex size-11 items-center justify-center rounded-full border border-line bg-surface transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:text-inherit"
                >
                  <Chevron flip />
                </button>
              </div>

              <nav aria-label={t(lang, 'calendar.monthStrip')} className="-mx-4 overflow-x-auto px-4 pb-1">
                <ol className="flex min-w-max gap-1.5">
                  {months.map((m, i) => (
                    <li key={m.key}>
                      <button
                        type="button"
                        data-testid={`strip-${m.key}`}
                        aria-current={i === index ? 'true' : undefined}
                        onClick={() => setIndex(i)}
                        className={`flex min-h-11 min-w-16 flex-col items-center justify-center rounded-xl border px-2.5 text-xs font-semibold transition ${
                          i === index
                            ? 'border-brand bg-brand text-white shadow-sm'
                            : 'border-line bg-surface text-ink hover:border-brand hover:text-brand'
                        }`}
                      >
                        <span>{monthLabel(lang, m.year, m.month0, 'short')}</span>
                        <span className={`text-[10px] font-normal ${i === index ? 'text-white/80' : 'text-muted'}`}>
                          {counts.get(m.key) ?? 0}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>

              <MonthView
                lang={lang}
                year={month.year}
                month0={month.month0}
                weekStart={weekStart}
                items={items}
                today={today}
                selected={day}
                onSelect={select}
              />
            </section>
          ) : (
            <ListView lang={lang} items={items} isBusy={draft.isBusy} onRemove={draft.removeRow} onSelect={jumpFromList} />
          )}
        </>
      )}

      {day && (
        <DayPanel
          lang={lang}
          iso={day}
          items={dayItems}
          recs={recs}
          isBusy={draft.isBusy}
          error={failureText}
          onRemove={draft.removeRow}
          onAdd={(id) => draft.add([id])}
          onAddCustom={() => {
            const d = day;
            setDay(null);
            openCustom(d);
          }}
          onClose={() => setDay(null)}
        />
      )}

      {customDate && (
        <CustomEventForm
          lang={lang}
          min={bounds.min}
          max={bounds.max}
          defaultDate={customDate}
          primary={primary}
          onClose={() => setCustomDate(null)}
          onSubmit={async (payload) => {
            const res = await draft.addCustom(payload);
            if (res.ok) {
              setCustomDate(null);
              const i = months.findIndex((m) => m.key === payload.date.slice(0, 7));
              if (i >= 0) setIndex(i);
            }
            return res;
          }}
        />
      )}
    </div>
  );
}
