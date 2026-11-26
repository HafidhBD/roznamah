'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { t, type Lang } from '@/i18n/core';
import type { CalendarEventView } from '@/lib/draft';
import type { Recommendation, Selections } from '@/lib/recommend';
import { ChoiceChip } from './ChoiceChip';
import { DraftFailureAlert } from './DraftFailureAlert';
import { RecommendationCard } from './RecommendationCard';
import { useDraftEvents } from './useDraftEvents';

export type TaxonomyOption = { key: string; label: string };
export type Taxonomy = Record<'sector' | 'field' | 'audience' | 'use', TaxonomyOption[]>;
export type MonthOption = { value: string; label: string };

type Props = {
  lang: Lang;
  taxonomy: Taxonomy;
  months: MonthOption[];
  initial: { selections: Selections; startMonth: string; events: CalendarEventView[] };
};

const SAVE_DELAY_MS = 500;
const PAGE_SIZE = 12;
const toggleIn = (list: string[], key: string) =>
  list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

export function PlanBuilder({ lang, taxonomy, months, initial }: Props) {
  const [sel, setSel] = useState(initial.selections);
  const [startMonth, setStartMonth] = useState(initial.startMonth);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const draft = useDraftEvents(initial.events);

  const latest = useRef({ sel, startMonth });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const save = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dirty.current = false;
    const { sel: selections, startMonth: month } = latest.current;
    await fetch('/api/draft', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selections, startMonth: month }),
    }).catch(() => {});
  };

  const change = (nextSel: Selections, nextMonth: string) => {
    setSel(nextSel);
    setStartMonth(nextMonth);
    latest.current = { sel: nextSel, startMonth: nextMonth };
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };

  // Flush a pending save if the visitor leaves within the debounce window.
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      const { sel: selections, startMonth: month } = latest.current;
      fetch('/api/draft', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selections, startMonth: month }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const recommend = async () => {
    setLoading(true);
    setFailed(false);
    try {
      await save();
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selections: sel, startMonth }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setRecs((await res.json()).items);
      setVisible(PAGE_SIZE);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  // Returning visitors with saved choices see their suggestions straight away.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (initial.selections.sector || initial.selections.fields.length) void recommend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const highNotAdded = (recs ?? []).filter((r) => r.band === 'high' && !draft.has(r.eventId));
  const hasHigh = (recs ?? []).some((r) => r.band === 'high');

  const step = (title: string, hint: string, children: React.ReactNode) => (
    <fieldset className="flex flex-col gap-3">
      <legend className="flex flex-wrap items-baseline gap-x-2 text-lg font-semibold">
        {title}
        <span className="text-sm font-normal text-muted">{hint}</span>
      </legend>
      {children}
    </fieldset>
  );

  const chips = (group: 'field' | 'audience' | 'use', selKey: 'fields' | 'audiences' | 'uses') => (
    <div className="flex flex-wrap gap-2">
      {taxonomy[group].map((o) => (
        <ChoiceChip
          key={o.key}
          id={o.key}
          testId={`chip-${o.key}`}
          label={o.label}
          selected={sel[selKey].includes(o.key)}
          onToggle={() => change({ ...sel, [selKey]: toggleIn(sel[selKey], o.key) }, startMonth)}
        />
      ))}
    </div>
  );

  return (
    <>
      <section className="flex flex-col gap-8 rounded-3xl border border-line bg-surface p-5 shadow-sm md:p-8">
        {step(
          t(lang, 'plan.step.sector'),
          '',
          <div className="grid grid-cols-2 gap-3">
            {taxonomy.sector.map((o) => (
              <ChoiceChip
                key={o.key}
                id={o.key}
                testId={`sector-${o.key}`}
                variant="card"
                label={o.label}
                selected={sel.sector === o.key}
                onToggle={() => change({ ...sel, sector: sel.sector === o.key ? null : o.key }, startMonth)}
              />
            ))}
          </div>,
        )}
        {step(t(lang, 'plan.step.field'), t(lang, 'plan.hint.multi'), chips('field', 'fields'))}
        {step(
          t(lang, 'plan.step.audience'),
          `${t(lang, 'plan.hint.multi')} · ${t(lang, 'plan.hint.optional')}`,
          chips('audience', 'audiences'),
        )}
        {step(
          t(lang, 'plan.step.use'),
          `${t(lang, 'plan.hint.multi')} · ${t(lang, 'plan.hint.optional')}`,
          chips('use', 'uses'),
        )}

        <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex flex-col gap-2 text-sm font-semibold sm:w-64">
            {t(lang, 'plan.startMonth')}
            <select
              data-testid="start-month"
              value={startMonth}
              onChange={(e) => change(sel, e.target.value)}
              className="min-h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="recommend-btn"
            onClick={recommend}
            disabled={loading}
            className="min-h-12 rounded-xl bg-brand px-8 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {t(lang, loading ? 'plan.recommending' : 'plan.recommend')}
          </button>
        </div>
      </section>

      {failed && (
        <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {t(lang, 'plan.results.error')}
        </p>
      )}

      {recs && (
        <section className="mt-10" aria-live="polite" data-testid="results">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">
              {t(lang, 'plan.results.title')}
              <span className="ms-2 text-sm font-normal text-muted">
                {recs.length} {t(lang, 'plan.results.count')}
              </span>
            </h2>
            <button
              type="button"
              data-testid="add-high"
              disabled={highNotAdded.length === 0}
              onClick={() => draft.add(highNotAdded.map((r) => r.eventId))}
              className="min-h-11 rounded-xl border border-brand px-5 text-sm font-semibold text-brand transition hover:bg-[#f1ecff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t(lang, hasHigh ? 'plan.addAllHigh' : 'plan.addAllHigh.none')}
            </button>
          </div>
          {recs.length === 0 ? (
            <p className="text-muted">{t(lang, 'plan.results.empty')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {recs.slice(0, visible).map((r) => (
                <RecommendationCard
                  key={r.eventId}
                  rec={r}
                  lang={lang}
                  added={draft.has(r.eventId)}
                  busy={draft.isBusy(r.eventId)}
                  onToggle={() => (draft.has(r.eventId) ? draft.remove(r.eventId) : draft.add([r.eventId]))}
                />
              ))}
            </div>
          )}
          {recs.length > visible && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                data-testid="show-more"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="min-h-11 rounded-xl border border-line bg-surface px-8 text-sm font-semibold hover:border-brand hover:text-brand"
              >
                {t(lang, 'plan.showMore')}
              </button>
            </div>
          )}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-12 z-10 border-t border-line bg-surface/95 backdrop-blur md:bottom-0">
        {draft.failure && (
          <div className="mx-auto max-w-5xl px-4 pt-3">
            <DraftFailureAlert lang={lang} failure={draft.failure} onDismiss={draft.clearFailure} testId="plan-error" />
          </div>
        )}
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-semibold" data-testid="plan-bar">
            <span data-testid="plan-count" className="text-brand">
              {draft.count}
            </span>{' '}
            {t(lang, 'plan.bar.suffix')}
          </p>
          <Link
            href="/calendar"
            data-testid="plan-bar-link"
            className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {t(lang, 'plan.bar.open')}
          </Link>
        </div>
      </div>
    </>
  );
}
