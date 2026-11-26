'use client';

import { formatHijri, toHijri } from '@/lib/dates/hijri';
import { monthGrid } from '@/lib/dates/month-grid';
import { t, type Lang } from '@/i18n/core';
import { covers, parseIso, weekdayLabel, type CalendarItem } from './util';

type Props = {
  lang: Lang;
  year: number;
  month0: number;
  weekStart: 0 | 1 | 6;
  items: CalendarItem[];
  today: string;
  selected: string | null;
  onSelect: (iso: string) => void;
};

const MAX_PILLS = 3;

export function Pill({ item, className = '' }: { item: CalendarItem; className?: string }) {
  const estimated = item.occ.status === 'estimated';
  const { color } = item.event;
  return (
    <span
      data-testid="pill"
      data-status={item.occ.status}
      className={`flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-start text-[11px] font-semibold leading-tight text-ink ${className}`}
      style={{
        background: `${color}22`,
        border: `1px ${estimated ? 'dashed' : 'solid'} ${estimated ? color : `${color}55`}`,
        borderInlineStartWidth: 3,
        borderInlineStartStyle: 'solid',
        borderInlineStartColor: color,
      }}
    >
      <span className="truncate">{item.event.title}</span>
    </span>
  );
}

export function MonthView({ lang, year, month0, weekStart, items, today, selected, onSelect }: Props) {
  const weeks = monthGrid(year, month0, weekStart);
  const dows = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
  const isWeekend = (dow: number) => dow === 5 || dow === 6;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" data-testid="month-grid">
      <div role="row" aria-label={t(lang, 'calendar.weekdays')} className="grid grid-cols-7 border-b border-line bg-[#f6f3fd]">
        {dows.map((dow) => (
          <div
            key={dow}
            className={`py-2 text-center text-xs font-semibold ${isWeekend(dow) ? 'text-brand' : 'text-muted'}`}
          >
            <span className="sm:hidden">{weekdayLabel(lang, dow, 'short')}</span>
            <span className="hidden sm:inline">{weekdayLabel(lang, dow, 'long')}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.map((week, wi) =>
          week.map((iso, ci) => {
            const dow = dows[ci];
            const border = `${ci < 6 ? 'border-e' : ''} ${wi < weeks.length - 1 ? 'border-b' : ''} border-line`;
            if (!iso) {
              return <div key={`${wi}-${ci}`} aria-hidden className={`${border} min-h-[4.25rem] bg-[#faf9fd] sm:min-h-28`} />;
            }
            const day = Number(iso.slice(8));
            const dayItems = items.filter((it) => covers(it.occ, iso));
            const isToday = iso === today;
            const isSelected = iso === selected;
            const hijriDay = toHijri(parseIso(iso)).day;
            return (
              <button
                key={iso}
                type="button"
                data-testid={`day-${iso}`}
                data-count={dayItems.length}
                aria-label={`${formatHijri(parseIso(iso), lang)} · ${iso}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(iso)}
                className={`${border} group relative flex min-h-[4.25rem] min-w-0 flex-col gap-1 p-1 text-start transition hover:bg-[#f1ecff] focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:min-h-28 sm:p-1.5 ${
                  isWeekend(dow) ? 'bg-[#f8f6fd]' : 'bg-surface'
                } ${isSelected ? 'bg-[#f1ecff]' : ''}`}
              >
                <span className="flex items-start justify-between gap-1">
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-sm font-semibold sm:size-7 ${
                      isToday ? 'bg-brand text-white' : 'text-ink'
                    }`}
                  >
                    {day}
                  </span>
                  <span className="pt-1 text-[10px] leading-none text-muted sm:text-[11px]">{hijriDay}</span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  {dayItems.slice(0, MAX_PILLS).map((it) => (
                    <Pill key={`${it.event.id}-${it.occ.start}`} item={it} className="max-sm:hidden" />
                  ))}
                  {dayItems.length > MAX_PILLS && (
                    <span className="px-1 text-[11px] font-semibold text-brand max-sm:hidden">
                      +{dayItems.length - MAX_PILLS} {t(lang, 'calendar.more')}
                    </span>
                  )}
                  {dayItems.length > 0 && (
                    <span className="flex flex-wrap gap-0.5 px-0.5 sm:hidden" aria-hidden>
                      {dayItems.slice(0, 4).map((it) => (
                        <span
                          key={`${it.event.id}-${it.occ.start}`}
                          className="size-1.5 rounded-full"
                          style={{
                            background: it.occ.status === 'estimated' ? 'transparent' : it.event.color,
                            boxShadow: `inset 0 0 0 1.5px ${it.event.color}`,
                          }}
                        />
                      ))}
                    </span>
                  )}
                </span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
