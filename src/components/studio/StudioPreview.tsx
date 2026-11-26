'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { CalendarDocument, pageSizeMm } from '@/components/calendar-document/CalendarDocument';
import { DEFAULT_FORMAT, monthName } from '@/components/calendar-document/doc';
import { t, type Lang } from '@/i18n/core';
import type { CalendarSnapshot } from '@/lib/snapshot-core';

const PX_PER_MM = 96 / 25.4;
const PAGES = 13;

const Chevron = ({ flip }: { flip?: boolean }) => (
  <svg viewBox="0 0 20 20" className={`size-5 ${flip ? 'rotate-180 rtl:rotate-0' : 'rtl:rotate-180'}`} aria-hidden>
    <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Shows one page of the real mm-sized document, scaled with a CSS transform to fit the column
 * width (and, on large screens, the viewport height) — so the preview is exactly what prints.
 */
export function StudioPreview({ lang, snapshot }: { lang: Lang; snapshot: CalendarSnapshot }) {
  const [index, setIndex] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const format = DEFAULT_FORMAT;
  const { width: w, height: h } = pageSizeMm(format);
  const wPx = w * PX_PER_MM;
  const hPx = h * PX_PER_MM;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const byWidth = el.clientWidth / wPx;
      const wide = window.matchMedia('(min-width: 1024px)').matches;
      const byHeight = wide ? Math.max(0.45, (window.innerHeight - 190) / hPx) : Infinity;
      setScale(Math.min(byWidth, byHeight, 1.2));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [wPx, hPx]);

  const label = (i: number) => {
    if (i === 0) return t(lang, 'studio.preview.cover');
    const m = snapshot.months[i - 1];
    return `${monthName(lang, m.year, m.month0)} ${m.year}`;
  };
  const short = (i: number) => {
    if (i === 0) return t(lang, 'studio.preview.cover');
    const m = snapshot.months[i - 1];
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      timeZone: 'UTC',
      month: 'short',
    }).format(new Date(Date.UTC(m.year, m.month0, 1, 12)));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="preview-prev"
          aria-label={t(lang, 'studio.preview.prev')}
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:border-brand hover:text-brand disabled:opacity-35 disabled:hover:border-line disabled:hover:text-ink"
        >
          <Chevron />
        </button>
        <div className="text-center">
          <p data-testid="preview-index" data-index={index} className="font-semibold" aria-live="polite">
            {label(index)}
          </p>
          <p className="text-xs text-muted">
            {index + 1} / {PAGES} · {t(lang, 'studio.preview.format')}
          </p>
        </div>
        <button
          type="button"
          data-testid="preview-next"
          aria-label={t(lang, 'studio.preview.next')}
          disabled={index === PAGES - 1}
          onClick={() => setIndex((i) => Math.min(PAGES - 1, i + 1))}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:border-brand hover:text-brand disabled:opacity-35 disabled:hover:border-line disabled:hover:text-ink"
        >
          <Chevron flip />
        </button>
      </div>

      <div ref={box} className="w-full">
        <div
          data-testid="preview"
          className="relative mx-auto overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgb(27_22_48/0.08),0_12px_32px_-8px_rgb(27_22_48/0.22)] ring-1 ring-black/5"
          style={{ width: wPx * scale, height: hPx * scale, visibility: scale ? 'visible' : 'hidden' }}
        >
          <div className="absolute left-0 top-0" style={{ width: wPx, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <CalendarDocument data={snapshot} format={format} mode="preview" pages={[index]} />
          </div>
        </div>
      </div>

      <nav aria-label={t(lang, 'studio.preview.pages')} className="flex gap-1 overflow-x-auto pb-1">
        {Array.from({ length: PAGES }, (_, i) => (
          <button
            key={i}
            type="button"
            data-testid={`preview-page-${i}`}
            aria-current={i === index ? 'page' : undefined}
            onClick={() => setIndex(i)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
              i === index ? 'bg-brand text-white' : 'bg-surface text-muted ring-1 ring-line hover:text-brand'
            }`}
          >
            {short(i)}
          </button>
        ))}
      </nav>
    </div>
  );
}
