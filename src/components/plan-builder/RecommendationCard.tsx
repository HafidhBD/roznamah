'use client';

import { formatHijri } from '@/lib/dates/hijri';
import { t, type Lang } from '@/i18n/core';
import type { Recommendation } from '@/lib/recommend';

type Props = {
  rec: Recommendation;
  lang: Lang;
  added: boolean;
  busy: boolean;
  onToggle: () => void;
};

const parse = (iso: string) => new Date(`${iso}T12:00:00Z`);

function formatGregorian(iso: string, lang: Lang) {
  const locale = lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(
    parse(iso),
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0" role="img" aria-label={`${label}: ${score}`}>
      <svg viewBox="0 0 48 48" className="size-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-line" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-brand"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold" data-testid="rec-score">
        {score}
      </span>
    </div>
  );
}

export function RecommendationCard({ rec, lang, added, busy, onToggle }: Props) {
  const title = lang === 'en' ? rec.titleEn : rec.titleAr;
  return (
    <article
      data-testid="rec-card"
      className={`flex flex-col gap-4 rounded-2xl border bg-surface p-5 shadow-sm transition ${
        added ? 'border-brand ring-1 ring-brand' : 'border-line'
      }`}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: `${rec.color ?? '#6d3df5'}1f` }}
        >
          {rec.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug">{title}</h3>
        </div>
        <ScoreRing score={rec.score} label={t(lang, 'plan.score')} />
      </header>

      <ul className="flex flex-col gap-2 text-sm">
        {rec.occurrences.map((o) => {
          const range = o.end !== o.start;
          return (
            <li key={o.start} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">
                {formatGregorian(o.start, lang)}
                {range ? ` – ${formatGregorian(o.end, lang)}` : ''}
              </span>
              <span className="text-muted">
                {t(lang, 'plan.hijri')}: {formatHijri(parse(o.start), lang)}
              </span>
              <span
                data-testid="rec-status"
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  o.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {t(lang, o.status === 'confirmed' ? 'plan.status.confirmed' : 'plan.status.estimated')}
              </span>
            </li>
          );
        })}
      </ul>

      <ul data-testid="rec-reasons" className="flex flex-wrap gap-2">
        {rec.reasons.map((r) => (
          <li key={r.ar} className="rounded-full bg-[#f1ecff] px-3 py-1 text-xs text-brand">
            {lang === 'en' ? r.en : r.ar}
          </li>
        ))}
      </ul>

      <button
        type="button"
        data-testid="rec-toggle"
        aria-pressed={added}
        disabled={busy}
        onClick={onToggle}
        className={`mt-auto min-h-11 rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-60 ${
          added
            ? 'border-brand bg-[#f1ecff] text-brand hover:bg-white'
            : 'border-brand bg-brand text-white hover:opacity-90'
        }`}
      >
        {added ? `✓ ${t(lang, 'plan.added')} · ${t(lang, 'plan.remove')}` : `+ ${t(lang, 'plan.add')}`}
      </button>
    </article>
  );
}
