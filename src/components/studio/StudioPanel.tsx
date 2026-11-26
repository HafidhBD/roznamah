'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { docTitle, docLangs } from '@/components/calendar-document/doc';
import { FONT_FAMILY } from '@/components/calendar-document/fonts';
import { weekdayLabel } from '@/components/calendar/util';
import { t, type Lang, type MessageKey } from '@/i18n/core';
import { FONT_KEYS, HEX_COLOR, TEMPLATE_KEYS, type Design, type TemplateKey } from '@/lib/design';
import type { CalendarEventView } from '@/lib/draft';
import { assembleSnapshot } from '@/lib/snapshot-core';
import { DownloadDialog, type SectorOption } from './DownloadDialog';
import { StudioPreview } from './StudioPreview';

type Props = {
  lang: Lang;
  sectors: SectorOption[];
  initialSector: string | null;
  turnstileSiteKey: string | null;
  /** Open the download dialog on load (the download page's «اطلب مرة أخرى» link). */
  openDownload?: boolean;
  startMonth: string;
  initialDesign: Design;
  initialLogoUrl: string | null;
  initialPalette: string[];
  events: CalendarEventView[];
};

type SaveState = 'saved' | 'saving' | 'error';
type Patch = Partial<Omit<Design, 'logoPath'>>;

const SAVE_DELAY = 400;

/** Debounced PATCH of design changes; reports saved/saving/error. */
function useDesignSaver() {
  const pending = useRef<Patch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(new Set<Promise<boolean>>());
  const [state, setState] = useState<SaveState>('saved');

  const flush = useCallback(async (keepalive = false) => {
    timer.current = null;
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return true;
    const request = fetch('/api/draft', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ design: body }),
      keepalive,
    }).then(
      (res) => res.ok,
      () => false,
    );
    inflight.current.add(request);
    const ok = await request;
    inflight.current.delete(request);
    if (!ok) setState('error');
    else if (!inflight.current.size && !timer.current && !Object.keys(pending.current).length) setState('saved');
    return ok;
  }, []);

  /** Sends pending changes now and waits for every save in flight (before freezing a download). */
  const settle = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const results = await Promise.all([flush(), ...inflight.current]);
    return results.every(Boolean);
  }, [flush]);

  const queue = useCallback(
    (patch: Patch) => {
      pending.current = { ...pending.current, ...patch };
      setState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => void flush(true);
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [flush]);

  return { state, queue, settle };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-5 py-5 last:border-b-0">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-[#f1eef8] p-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            data-testid={`${testId}-${o.value}`}
            onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-lg px-2 text-sm font-medium transition ${
              value === o.value ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-sm text-ink">
      <span>{label}</span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          data-testid={testId}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0"
        />
        <span className="h-6 w-11 rounded-full bg-[#d9d4e6] transition peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
        <span className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-[inset-inline-start] [inset-inline-start:2px] peer-checked:[inset-inline-start:22px]" />
      </span>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-1.5 focus-within:border-brand">
        <input
          type="color"
          aria-label={label}
          data-testid={`${testId}-input`}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="size-8 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          dir="ltr"
          aria-label={`${label} (hex)`}
          value={text}
          maxLength={7}
          onChange={(e) => {
            setText(e.target.value);
            if (HEX_COLOR.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          className="w-full min-w-0 bg-transparent font-mono text-sm uppercase text-ink outline-none"
        />
      </div>
    </div>
  );
}

/** Tiny schematic of each template, so the cards show the layout difference at a glance. */
function TemplateThumb({ template, primary, secondary }: { template: TemplateKey; primary: string; secondary: string }) {
  if (template === 'modern') {
    return (
      <svg viewBox="0 0 60 84" className="h-24 w-auto rounded-md bg-white shadow-sm ring-1 ring-black/5" aria-hidden>
        <rect width="60" height="18" fill={primary} />
        <circle cx="6" cy="20" r="9" fill={secondary} />
        <rect x="34" y="5" width="20" height="4" rx="1" fill="#fff" />
        <rect x="40" y="11" width="14" height="2" rx="1" fill="#fff" opacity=".7" />
        {Array.from({ length: 30 }, (_, i) => (
          <rect key={i} x={4 + (i % 6) * 8.8} y={24 + Math.floor(i / 6) * 9.6} width="7.6" height="8.4" rx="1.4" fill={primary} opacity={i % 6 === 0 ? 0.16 : 0.07} />
        ))}
        <rect x="31" y="30" width="7" height="2.4" rx="1.2" fill={primary} />
        <rect x="13" y="49" width="7" height="2.4" rx="1.2" fill={secondary} />
        <rect x="4" y="74" width="52" height="0.5" fill="#ddd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 84" className="h-24 w-auto rounded-md bg-white shadow-sm ring-1 ring-black/5" aria-hidden>
      <rect x="2.5" y="2.5" width="55" height="79" fill="none" stroke={primary} strokeWidth="0.9" />
      <rect x="3.6" y="3.6" width="52.8" height="76.8" fill="none" stroke={primary} strokeWidth="0.3" />
      <circle cx="30" cy="11" r="3.4" fill={primary} opacity=".25" />
      <rect x="20" y="17" width="20" height="3.4" rx=".4" fill={primary} />
      <rect x="8" y="18.2" width="9" height="1" fill={secondary} />
      <rect x="43" y="18.2" width="9" height="1" fill={secondary} />
      <rect x="7" y="25" width="46" height="4" fill={primary} />
      <rect x="7" y="25" width="46" height="44" fill="none" stroke={primary} strokeWidth=".5" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`h${i}`} x1="7" x2="53" y1={29 + i * 8} y2={29 + i * 8} stroke={primary} strokeWidth=".25" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`v${i}`} y1="25" y2="69" x1={7 + (i + 1) * 6.57} x2={7 + (i + 1) * 6.57} stroke={primary} strokeWidth=".25" />
      ))}
      <rect x="9" y="40" width="1.2" height="1.2" fill={secondary} />
      <rect x="11" y="40" width="3.6" height="1.2" fill="#555" opacity=".5" />
      <rect x="7" y="73" width="46" height="0.4" fill={secondary} />
    </svg>
  );
}

const TEMPLATE_TEXT: Record<TemplateKey, { name: MessageKey; desc: MessageKey }> = {
  modern: { name: 'studio.template.modern', desc: 'studio.template.modern.desc' },
  official: { name: 'studio.template.official', desc: 'studio.template.official.desc' },
};

export function StudioPanel({
  lang,
  sectors,
  initialSector,
  turnstileSiteKey,
  openDownload = false,
  startMonth,
  initialDesign,
  initialLogoUrl,
  initialPalette,
  events,
}: Props) {
  const [downloadOpen, setDownloadOpen] = useState(openDownload);
  const [design, setDesign] = useState<Design>(initialDesign);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [palette, setPalette] = useState(initialPalette);
  const [paletteTarget, setPaletteTarget] = useState<'primary' | 'secondary'>('primary');
  const [upload, setUpload] = useState<{ busy: boolean; error: MessageKey | null }>({ busy: false, error: null });
  const fileInput = useRef<HTMLInputElement>(null);
  const saver = useDesignSaver();

  const update = (patch: Patch) => {
    setDesign((d) => ({ ...d, ...patch }));
    saver.queue(patch);
  };

  const snapshot = useMemo(() => assembleSnapshot(design, startMonth, events, logoUrl), [design, startMonth, events, logoUrl]);
  const defaultTitle = docTitle({ ...design, title: '' }, docLangs(design.language).main, snapshot);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUpload({ busy: true, error: null });
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/draft/logo', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setLogoUrl(body.logoUrl);
        setPalette(body.palette ?? []);
        setUpload({ busy: false, error: null });
      } else {
        const code = ['TOO_LARGE', 'BAD_TYPE', 'CORRUPT'].includes(body.error) ? body.error : 'generic';
        setUpload({ busy: false, error: `studio.logo.err.${code}` as MessageKey });
      }
    } catch {
      setUpload({ busy: false, error: 'studio.logo.err.generic' });
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function removeLogo() {
    const res = await fetch('/api/draft/logo', { method: 'DELETE' }).catch(() => null);
    if (res?.ok) {
      setLogoUrl(null);
      setPalette([]);
    }
  }

  const saveLabel: Record<SaveState, MessageKey> = {
    saved: 'studio.save.saved',
    saving: 'studio.save.saving',
    error: 'studio.save.error',
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">{t(lang, 'studio.title')}</h1>
          <p className="text-sm text-muted">{t(lang, 'studio.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            data-testid="save-state"
            data-state={saver.state}
            role="status"
            className={`flex items-center gap-1.5 text-sm ${saver.state === 'error' ? 'text-red-600' : 'text-muted'}`}
          >
            <span
              aria-hidden
              className={`size-2 rounded-full ${
                saver.state === 'saved' ? 'bg-emerald-500' : saver.state === 'saving' ? 'animate-pulse bg-amber-400' : 'bg-red-500'
              }`}
            />
            {t(lang, saveLabel[saver.state])}
          </span>
          <button
            type="button"
            data-testid="download"
            aria-haspopup="dialog"
            onClick={() => setDownloadOpen(true)}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
              <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 15.5h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t(lang, 'studio.download')}
          </button>
        </div>
      </header>

      {downloadOpen && (
        <DownloadDialog
          lang={lang}
          orgName={(lang === 'en' ? design.orgNameEn || design.orgNameAr : design.orgNameAr || design.orgNameEn) ?? ''}
          sector={initialSector}
          sectors={sectors}
          turnstileSiteKey={turnstileSiteKey}
          beforeSubmit={saver.settle}
          onClose={() => setDownloadOpen(false)}
        />
      )}

      {events.length === 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
          {t(lang, 'studio.empty')}
          <Link href="/" className="font-semibold text-brand hover:underline">
            {t(lang, 'studio.empty.cta')}
          </Link>
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="order-2 overflow-hidden rounded-3xl border border-line bg-surface shadow-sm lg:order-1">
          <Section title={t(lang, 'studio.section.identity')}>
            <Field label={t(lang, 'studio.orgNameAr')}>
              <input
                data-testid="org-name-ar"
                dir="rtl"
                maxLength={120}
                value={design.orgNameAr}
                onChange={(e) => update({ orgNameAr: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t(lang, 'studio.orgNameEn')}>
              <input
                data-testid="org-name-en"
                dir="ltr"
                maxLength={120}
                value={design.orgNameEn}
                onChange={(e) => update({ orgNameEn: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">{t(lang, 'studio.logo')}</span>
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-[#faf9fd] p-3">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-line">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" data-testid="logo-thumb" className="max-h-full max-w-full object-contain p-1" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="size-6 text-muted" aria-hidden>
                      <path d="M4 17l4.5-5 3.5 4 2.5-3L20 17M4 5h16v14H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
                      {upload.busy ? t(lang, 'studio.logo.uploading') : t(lang, logoUrl ? 'studio.logo.replace' : 'studio.logo.choose')}
                      <input
                        ref={fileInput}
                        type="file"
                        data-testid="logo-input"
                        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
                        className="sr-only"
                        disabled={upload.busy}
                        onChange={(e) => void onFile(e.target.files?.[0])}
                      />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        data-testid="logo-remove"
                        onClick={() => void removeLogo()}
                        className="rounded-lg px-2 py-1.5 text-sm text-muted hover:text-red-600"
                      >
                        {t(lang, 'studio.logo.remove')}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted">{t(lang, 'studio.logo.hint')}</p>
                </div>
              </div>
              {upload.error && (
                <p role="alert" data-testid="logo-error" className="text-sm text-red-600">
                  {t(lang, upload.error)}
                </p>
              )}
            </div>
          </Section>

          <Section title={t(lang, 'studio.section.colors')}>
            {palette.length > 0 && (
              <div className="flex flex-col gap-2 rounded-2xl bg-[#faf9fd] p-3 ring-1 ring-line">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted">{t(lang, 'studio.palette')}</span>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted">{t(lang, 'studio.palette.applyTo')}</span>
                    {(['primary', 'secondary'] as const).map((target) => (
                      <button
                        key={target}
                        type="button"
                        data-testid={`palette-target-${target}`}
                        aria-pressed={paletteTarget === target}
                        onClick={() => setPaletteTarget(target)}
                        className={`rounded-md px-2 py-0.5 font-medium ${paletteTarget === target ? 'bg-white text-brand shadow-sm' : 'text-muted'}`}
                      >
                        {t(lang, target === 'primary' ? 'studio.primary' : 'studio.secondary')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      data-testid="palette-swatch"
                      data-color={c}
                      aria-label={c}
                      title={c}
                      onClick={() => update({ [paletteTarget]: c })}
                      className={`size-9 rounded-full ring-2 ring-offset-2 transition hover:scale-110 ${
                        design[paletteTarget] === c ? 'ring-ink' : 'ring-transparent'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <ColorField label={t(lang, 'studio.primary')} value={design.primary} onChange={(primary) => update({ primary })} testId="primary" />
              <ColorField label={t(lang, 'studio.secondary')} value={design.secondary} onChange={(secondary) => update({ secondary })} testId="secondary" />
            </div>
          </Section>

          <Section title={t(lang, 'studio.section.font')}>
            <div role="radiogroup" aria-label={t(lang, 'studio.section.font')} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-1">
              {FONT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={design.font === key}
                  data-testid={`font-${key}`}
                  onClick={() => update({ font: key })}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-start transition ${
                    design.font === key ? 'border-brand bg-[#f4f0ff]' : 'border-line hover:border-brand/60'
                  }`}
                >
                  <span className="text-lg leading-snug" style={{ fontFamily: FONT_FAMILY[key] }} dir="rtl">
                    {t('ar', 'studio.font.sample')}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{t(lang, `studio.font.${key}` as MessageKey)}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title={t(lang, 'studio.section.template')}>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  data-testid={`template-${key}`}
                  aria-pressed={design.template === key}
                  onClick={() => update({ template: key })}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition ${
                    design.template === key ? 'border-brand bg-[#f4f0ff] ring-1 ring-brand' : 'border-line hover:border-brand/60'
                  }`}
                >
                  <TemplateThumb template={key} primary={design.primary} secondary={design.secondary} />
                  <span className="text-sm font-semibold">{t(lang, TEMPLATE_TEXT[key].name)}</span>
                  <span className="text-xs leading-snug text-muted">{t(lang, TEMPLATE_TEXT[key].desc)}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title={t(lang, 'studio.section.content')}>
            <Field label={t(lang, 'studio.title.label')}>
              <input
                data-testid="doc-title"
                maxLength={120}
                value={design.title}
                placeholder={defaultTitle}
                onChange={(e) => update({ title: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t(lang, 'studio.subtitle.label')}>
              <input
                data-testid="doc-subtitle"
                maxLength={120}
                value={design.subtitle}
                onChange={(e) => update({ subtitle: e.target.value })}
                className={inputClass}
              />
            </Field>
          </Section>

          <Section title={t(lang, 'studio.section.options')}>
            <Segmented
              label={t(lang, 'studio.language')}
              value={design.language}
              testId="language"
              onChange={(language) => update({ language })}
              options={[
                { value: 'ar', label: t(lang, 'studio.language.ar') },
                { value: 'en', label: t(lang, 'studio.language.en') },
                { value: 'bi', label: t(lang, 'studio.language.bi') },
              ]}
            />
            <Segmented
              label={t(lang, 'studio.weekStart')}
              value={design.weekStart}
              testId="weekstart"
              onChange={(weekStart) => update({ weekStart })}
              options={([6, 0, 1] as const).map((d) => ({ value: d, label: weekdayLabel(lang, d, 'long') }))}
            />
            <div className="flex flex-col">
              <Toggle label={t(lang, 'studio.hijri')} checked={design.showHijri} onChange={(showHijri) => update({ showHijri })} testId="toggle-hijri" />
              <Toggle
                label={t(lang, 'studio.descriptions')}
                checked={design.showDescriptions}
                onChange={(showDescriptions) => update({ showDescriptions })}
                testId="toggle-descriptions"
              />
              <Toggle
                label={t(lang, 'studio.colorByKind')}
                checked={design.colorByKind}
                onChange={(colorByKind) => update({ colorByKind })}
                testId="toggle-color-by-kind"
              />
              <Toggle label={t(lang, 'studio.notesArea')} checked={design.notesArea} onChange={(notesArea) => update({ notesArea })} testId="toggle-notes" />
            </div>
            <p className="rounded-xl bg-[#faf9fd] px-3 py-2 text-xs leading-relaxed text-muted ring-1 ring-line">{t(lang, 'studio.stampNote')}</p>
          </Section>
        </aside>

        <div className="order-1 min-w-0 lg:sticky lg:top-4 lg:order-2">
          <StudioPreview lang={lang} snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}
