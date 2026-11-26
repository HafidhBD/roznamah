'use client';

import { formatHijri } from '@/lib/dates/hijri';
import { t, type Lang } from '@/i18n/core';
import { monthLabel, parseIso, shortDate, type CalendarItem } from './util';

type Props = {
  lang: Lang;
  items: CalendarItem[];
  isBusy: (rowId: string) => boolean;
  onRemove: (rowId: string) => void;
  onSelect: (iso: string) => void;
};

export function ListView({ lang, items, isBusy, onRemove, onSelect }: Props) {
  const groups = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const key = it.occ.start.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }

  return (
    <div className="flex flex-col gap-8" data-testid="list-view">
      {[...groups.entries()].map(([key, rows]) => (
        <section key={key} data-testid="list-month" aria-labelledby={`lm-${key}`}>
          <h3 id={`lm-${key}`} className="mb-3 flex items-center gap-3 text-lg font-semibold">
            <span>{monthLabel(lang, Number(key.slice(0, 4)), Number(key.slice(5)) - 1)}</span>
            <span className="rounded-full bg-[#f1ecff] px-2.5 py-0.5 text-xs text-brand">{rows.length}</span>
            <span aria-hidden className="h-px flex-1 bg-line" />
          </h3>
          <ul className="flex flex-col gap-2">
            {rows.map((it) => {
              const range = it.occ.end !== it.occ.start;
              const estimated = it.occ.status === 'estimated';
              return (
                <li
                  key={`${it.event.id}-${it.occ.start}`}
                  data-testid="list-item"
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(it.occ.start)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span
                      aria-hidden
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ background: `${it.event.color}22` }}
                    >
                      {it.event.icon}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-semibold">{it.event.title}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                        <span>
                          {shortDate(lang, it.occ.start)}
                          {range ? ` – ${shortDate(lang, it.occ.end)}` : ''}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{formatHijri(parseIso(it.occ.start), lang)}</span>
                        {estimated && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            {t(lang, 'plan.status.estimated')}
                          </span>
                        )}
                        {it.event.custom && (
                          <span className="rounded-full bg-[#f1ecff] px-2 py-0.5 text-xs font-semibold text-brand">
                            {t(lang, 'calendar.legend.custom')}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="list-remove"
                    disabled={isBusy(it.event.id)}
                    onClick={() => onRemove(it.event.id)}
                    className="min-h-10 shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-muted transition hover:border-red-300 hover:text-red-700 disabled:opacity-60"
                  >
                    {t(lang, 'calendar.remove')}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
