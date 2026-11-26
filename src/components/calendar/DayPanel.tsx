'use client';

import { formatHijri } from '@/lib/dates/hijri';
import { t, type Lang } from '@/i18n/core';
import type { Recommendation } from '@/lib/recommend';
import { Modal } from './Modal';
import { dayLabel, parseIso, type CalendarItem } from './util';

export type RecState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: Recommendation[] };

type Props = {
  lang: Lang;
  iso: string;
  items: CalendarItem[];
  recs: RecState;
  isBusy: (id: string) => boolean;
  onRemove: (rowId: string) => void;
  onAdd: (eventId: string) => void;
  onAddCustom: () => void;
  onClose: () => void;
  error: string | null;
};

export function DayPanel({ lang, iso, items, recs, isBusy, onRemove, onAdd, onAddCustom, onClose, error }: Props) {
  const addedIds = new Set(items.flatMap((it) => (it.event.eventId ? [it.event.eventId] : [])));
  const suggestions =
    recs.status === 'ready'
      ? recs.items.filter((r) => !addedIds.has(r.eventId) && r.occurrences.some((o) => o.start <= iso && iso <= o.end))
      : [];

  return (
    <Modal title={dayLabel(lang, iso)} closeLabel={t(lang, 'calendar.day.close')} onClose={onClose} testId="day-panel">
      <p className="-mt-1 mb-4 text-sm text-muted">{formatHijri(parseIso(iso), lang)}</p>
      {error && (
        <p role="alert" data-testid="day-error" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <h3 className="mb-2 text-sm font-semibold text-muted">{t(lang, 'calendar.day.added')}</h3>
      {items.length === 0 ? (
        <p className="mb-5 rounded-xl bg-[#faf9fd] px-3 py-3 text-sm text-muted" data-testid="day-none">
          {t(lang, 'calendar.day.none')}
        </p>
      ) : (
        <ul className="mb-5 flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={`${it.event.id}-${it.occ.start}`}
              data-testid="day-item"
              className="flex items-center gap-3 rounded-xl border border-line p-2.5"
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ background: `${it.event.color}22` }}
              >
                {it.event.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{it.event.title}</span>
                {it.occ.status === 'estimated' && (
                  <span className="text-xs text-amber-700">{t(lang, 'plan.status.estimated')}</span>
                )}
              </span>
              <button
                type="button"
                data-testid="day-remove"
                disabled={isBusy(it.event.id)}
                onClick={() => onRemove(it.event.id)}
                className="min-h-10 shrink-0 rounded-lg border border-line px-3 text-sm font-semibold text-muted transition hover:border-red-300 hover:text-red-700 disabled:opacity-60"
              >
                {t(lang, 'calendar.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-2 text-sm font-semibold text-muted">{t(lang, 'calendar.day.recommended')}</h3>
      {recs.status === 'loading' && <p className="mb-5 text-sm text-muted">{t(lang, 'calendar.day.loading')}</p>}
      {recs.status === 'error' && (
        <p className="mb-5 text-sm text-red-700" data-testid="day-rec-error">
          {t(lang, 'calendar.day.recError')}
        </p>
      )}
      {recs.status === 'ready' && suggestions.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2" data-testid="day-recs">
          {suggestions.map((r) => (
            <li key={r.eventId} data-testid="day-rec" className="flex items-center gap-3 rounded-xl border border-dashed border-line p-2.5">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ background: `${r.color ?? '#6d3df5'}22` }}
              >
                {r.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{lang === 'en' ? r.titleEn : r.titleAr}</span>
              <button
                type="button"
                data-testid="day-rec-add"
                disabled={isBusy(r.eventId)}
                onClick={() => onAdd(r.eventId)}
                className="min-h-10 shrink-0 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                + {t(lang, 'plan.add')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAddCustom}
        data-testid="day-add-custom"
        className="min-h-11 w-full rounded-xl border border-brand px-4 text-sm font-semibold text-brand transition hover:bg-[#f1ecff]"
      >
        + {t(lang, 'calendar.day.addCustomHere')}
      </button>
    </Modal>
  );
}
