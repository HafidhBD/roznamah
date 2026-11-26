'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { t, type Lang, type MessageKey } from '@/i18n/core';
import type { DownloadStatus } from '@/lib/downloads';
import type { DownloadFile } from '@/db/schema';

const POLL_MS = 3000;
const AGAIN_HREF = '/studio?download=1';

type Props = { lang: Lang; token: string; initial: DownloadStatus | null };
type View = 'preparing' | 'ready' | 'expired' | 'failed' | 'notFound';

const viewOf = (s: DownloadStatus | null): View =>
  !s ? 'notFound' : s.expired ? 'expired' : s.status === 'ready' ? 'ready' : s.status === 'failed' ? 'failed' : 'preparing';

/** Polls the status every 3 s while queued / rendering. */
function useDownloadStatus(token: string, initial: DownloadStatus | null) {
  const [status, setStatus] = useState(initial);
  const view = viewOf(status);
  useEffect(() => {
    if (view !== 'preparing') return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/downloads/${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (res.ok && !stop) setStatus(await res.json());
        if (res.status === 404 && !stop) setStatus(null);
      } catch {
        // offline for a moment: keep polling
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [token, view]);
  return { status, view };
}

/** An eased, never-complete estimate (most renders finish in under a minute). */
function useEstimatedProgress(active: boolean, rendering: boolean) {
  const started = useRef<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    started.current ??= Date.now();
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  if (!active || started.current === null || !now) return 6;
  const elapsed = (now - started.current) / 1000;
  const base = rendering ? 18 : 6;
  return Math.min(94, base + (94 - base) * (1 - Math.exp(-elapsed / 25)));
}

function Icon({ kind }: { kind: 'clock' | 'check' | 'alert' | 'file' }) {
  const paths = {
    clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    check: 'm5 12.5 4.5 4.5L19 7.5',
    alert: 'M12 8v5m0 3.5h.01M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6m-6 4h4',
  };
  return (
    <svg viewBox="0 0 24 24" className="size-full" aria-hidden>
      <path d={paths[kind]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fileLabel(lang: Lang, file: DownloadFile) {
  const m = /^roznamah-wall-(A4|A3)(-bleed)?\.pdf$/.exec(file.name);
  const details = [
    file.pages ? `${file.pages} ${t(lang, 'dlp.file.pages')}` : null,
    m?.[2] ? t(lang, 'dlp.file.bleed') : null,
    mb(lang, file.size),
  ];
  return {
    title: m ? `${t(lang, 'dlp.file.wall')} ${m[1]}` : file.name,
    sub: details.filter(Boolean).join(' · '),
  };
}

const mb = (lang: Lang, bytes: number) => `${(bytes / 1048576).toFixed(1)} ${t(lang, 'dlp.mb')}`;

export function DownloadStatusView({ lang, token, initial }: Props) {
  const { status, view } = useDownloadStatus(token, initial);
  const progress = useEstimatedProgress(view === 'preparing', status?.status === 'rendering');
  const files = status?.files ?? [];

  function downloadAll() {
    files.forEach((f, i) =>
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = f.url;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 700),
    );
  }

  const header = (tone: string, icon: Parameters<typeof Icon>[0]['kind'], title: MessageKey, body: MessageKey, spin = false) => (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className={`flex size-16 items-center justify-center rounded-full p-4 ${tone} ${spin ? 'animate-pulse' : ''}`}>
        <Icon kind={icon} />
      </span>
      <h1 className="text-2xl font-semibold leading-snug md:text-3xl">{t(lang, title)}</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">{t(lang, body)}</p>
    </div>
  );

  const studioLink = (
    <Link href="/studio" className="text-sm font-medium text-brand hover:underline">
      {t(lang, 'dlp.studio')}
    </Link>
  );
  const againButton = (
    <Link
      href={AGAIN_HREF}
      data-testid="download-again"
      className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-8 text-base font-semibold text-white shadow-sm hover:bg-brand/90"
    >
      {t(lang, 'dlp.again')}
    </Link>
  );

  const steps: { key: MessageKey; state: 'done' | 'active' | 'todo' }[] = [
    { key: 'dlp.step.queued', state: status?.status === 'queued' ? 'active' : 'done' },
    { key: 'dlp.step.rendering', state: status?.status === 'rendering' ? 'active' : status?.status === 'queued' ? 'todo' : 'done' },
    { key: 'dlp.step.ready', state: view === 'ready' ? 'done' : 'todo' },
  ];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 py-6" data-testid="download-page" data-state={view}>
      <div className="flex flex-col gap-8 rounded-3xl border border-line bg-surface px-5 py-8 shadow-sm sm:px-10">
        {view === 'preparing' && (
          <>
            {header('bg-brand/10 text-brand', 'clock', 'dlp.preparing.title', 'dlp.preparing.body', true)}
            <div className="flex flex-col gap-4">
              <div
                role="progressbar"
                aria-label={t(lang, 'dlp.preparing.title')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                className="h-2.5 overflow-hidden rounded-full bg-[#ece8f6]"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-l from-brand to-[#9d7bff] transition-[width] duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <ol className="grid grid-cols-3 gap-2 text-center text-xs">
                {steps.map((s) => (
                  <li key={s.key} className="flex flex-col items-center gap-1.5" data-step-state={s.state}>
                    <span
                      className={`flex size-6 items-center justify-center rounded-full p-1 ${
                        s.state === 'done'
                          ? 'bg-brand text-white'
                          : s.state === 'active'
                            ? 'bg-brand/15 text-brand ring-2 ring-brand/40'
                            : 'bg-[#ece8f6] text-muted'
                      }`}
                    >
                      {s.state === 'done' ? <Icon kind="check" /> : <span className="size-1.5 rounded-full bg-current" />}
                    </span>
                    <span className={s.state === 'todo' ? 'text-muted' : 'font-medium text-ink'}>{t(lang, s.key)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {view === 'ready' && (
          <>
            {header('bg-emerald-50 text-emerald-600', 'check', 'dlp.ready.title', 'dlp.ready.body')}
            <ul className="flex flex-col gap-3" data-testid="download-files">
              {files.map((f) => {
                const label = fileLabel(lang, f);
                return (
                  <li key={f.name} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 sm:p-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 p-2.5 text-brand">
                      <Icon kind="file" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold text-ink">{label.title}</span>
                      <span className="truncate text-xs text-muted" data-testid="file-details">
                        {label.sub}
                      </span>
                      <span className="truncate font-mono text-[11px] text-muted/80">
                        <bdi>{f.name}</bdi>
                      </span>
                    </span>
                    <a
                      href={f.url}
                      download={f.name}
                      data-testid={`file-${f.name}`}
                      className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90"
                    >
                      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                        <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 15.5h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t(lang, 'dlp.download')}
                    </a>
                  </li>
                );
              })}
            </ul>
            {files.length > 1 && (
              <button
                type="button"
                data-testid="download-all"
                onClick={downloadAll}
                className="min-h-12 rounded-xl border-2 border-brand px-6 text-base font-semibold text-brand hover:bg-brand/5"
              >
                {t(lang, 'dlp.downloadAll')}
              </button>
            )}
          </>
        )}

        {view === 'expired' && (
          <>
            {header('bg-amber-50 text-amber-600', 'clock', 'dlp.expired.title', 'dlp.expired.body')}
            {againButton}
          </>
        )}
        {view === 'failed' && (
          <>
            {header('bg-red-50 text-red-600', 'alert', 'dlp.failed.title', 'dlp.failed.body')}
            {againButton}
          </>
        )}
        {view === 'notFound' && (
          <>
            {header('bg-[#ece8f6] text-muted', 'alert', 'dlp.notFound.title', 'dlp.notFound.body')}
            {againButton}
          </>
        )}
      </div>
      <div className="text-center">{studioLink}</div>
    </div>
  );
}
