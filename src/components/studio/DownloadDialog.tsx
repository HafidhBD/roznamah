'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Modal } from '@/components/calendar/Modal';
import { t, type Lang, type MessageKey } from '@/i18n/core';
import type { PageFormat } from '@/lib/print-sizes';

export type SectorOption = { key: string; label: string };

type Props = {
  lang: Lang;
  orgName: string;
  sector: string | null;
  sectors: SectorOption[];
  turnstileSiteKey: string | null;
  /** Saves pending studio edits so the download freezes the latest design. */
  beforeSubmit: () => Promise<boolean>;
  onClose: () => void;
};

type Size = PageFormat['size'];
type FieldName = 'email' | 'orgName' | 'phone' | 'formats';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^(05\d{8}|\+9665\d{8})$/;
const SIZES: Size[] = ['A4', 'A3'];

function validate(v: { email: string; orgName: string; phone: string; sizes: Size[] }) {
  const errors: Partial<Record<FieldName, MessageKey>> = {};
  if (!EMAIL.test(v.email.trim())) errors.email = 'dl.err.email';
  if (!v.orgName.trim()) errors.orgName = 'dl.err.org';
  const phone = v.phone.replace(/[\s-]/g, '');
  if (phone && !PHONE.test(phone)) errors.phone = 'dl.err.phone';
  if (!v.sizes.length) errors.formats = 'dl.err.formats';
  return errors;
}

const inputClass =
  'min-h-11 w-full rounded-xl border bg-white px-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:ring-2';
const inputState = (bad: boolean) =>
  bad ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-line focus:border-brand focus:ring-brand/20';

function Field({
  id,
  label,
  error,
  lang,
  children,
}: {
  id: string;
  label: string;
  error?: MessageKey;
  lang: Lang;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} data-testid={`${id}-error`} className="text-xs text-red-600">
          {t(lang, error)}
        </p>
      )}
    </div>
  );
}

function FormatOption({
  checked,
  onChange,
  title,
  desc,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
  testId: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
        checked ? 'border-brand bg-brand/5 ring-1 ring-brand/30' : 'border-line bg-white hover:border-brand/50'
      }`}
    >
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-muted">{desc}</span>
      </span>
    </label>
  );
}

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};

/** Cloudflare Turnstile widget (only rendered when a site key is configured). */
function Turnstile({ siteKey, lang, onToken }: { siteKey: string; lang: Lang; onToken: (t: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });
  useEffect(() => {
    let id: string | null = null;
    let cancelled = false;
    const w = window as unknown as { turnstile?: TurnstileApi };
    const mount = () => {
      if (cancelled || !ref.current || !w.turnstile) return;
      id = w.turnstile.render(ref.current, {
        sitekey: siteKey,
        language: lang,
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => onTokenRef.current(null),
      });
    };
    if (w.turnstile) mount();
    else {
      const src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', mount);
    }
    return () => {
      cancelled = true;
      if (id && w.turnstile) w.turnstile.remove(id);
    };
  }, [siteKey, lang]);
  return <div ref={ref} data-testid="turnstile" className="min-h-[65px]" />;
}

export function DownloadDialog({ lang, orgName: initialOrg, sector: initialSector, sectors, turnstileSiteKey, beforeSubmit, onClose }: Props) {
  const uid = useId();
  const [sizes, setSizes] = useState<Size[]>(['A4']);
  const [bleed, setBleed] = useState(false);
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState(initialOrg);
  const [sector, setSector] = useState(initialSector ?? '');
  const [phone, setPhone] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<MessageKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const errors = validate({ email, orgName, phone, sizes });
  const shown = (f: FieldName) => (submitted || touched[f] ? errors[f] : undefined);
  const blur = (f: FieldName) => () => setTouched((s) => ({ ...s, [f]: true }));
  const toggleSize = (size: Size, on: boolean) =>
    setSizes((list) => SIZES.filter((s) => (s === size ? on : list.includes(s))));
  const id = (name: string) => `${uid}-${name}`;
  const describedBy = (f: FieldName) => (shown(f) ? `${id(f)}-error` : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length) {
      const first = (['formats', 'email', 'orgName', 'phone'] as FieldName[]).find((f) => errors[f]);
      document.getElementById(id(first!))?.focus();
      return;
    }
    if (turnstileSiteKey && !captcha) return setServerError('dl.err.captcha');
    setBusy(true);
    try {
      await beforeSubmit();
      const res = await fetch('/api/downloads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          orgName: orgName.trim(),
          sector: sector || null,
          phone: phone.trim() || undefined,
          formats: sizes.map((size) => ({ kind: 'wall', size, bleed })),
          turnstileToken: captcha ?? undefined,
        }),
      });
      if (res.ok) return setSentTo(email.trim());
      const body = await res.json().catch(() => ({}));
      const known: Record<string, MessageKey> = {
        rate_limited: 'dl.err.rate_limited',
        captcha_failed: 'dl.err.captcha',
        email_failed: 'dl.err.email_failed',
      };
      if (body.error === 'invalid_body' && body.fields) {
        setTouched({ email: true, orgName: true, phone: true });
        if (body.fields.email) return setServerError('dl.err.email');
        if (body.fields.phone) return setServerError('dl.err.phone');
      }
      setServerError(known[body.error] ?? 'dl.err.generic');
    } catch {
      setServerError('dl.err.generic');
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <Modal title={t(lang, 'dl.title')} closeLabel={t(lang, 'dl.close')} onClose={onClose} testId="download-dialog">
        <div data-testid="download-success" role="status" className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
            <svg viewBox="0 0 24 24" className="size-8" aria-hidden>
              <path d="M3 7.5 12 13l9-5.5M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <h3 className="text-xl font-semibold">{t(lang, 'dl.success.title')}</h3>
          <p dir="ltr" data-testid="download-success-email" className="rounded-full bg-[#f1eef8] px-4 py-1.5 font-mono text-sm text-ink">
            {sentTo}
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted">{t(lang, 'dl.success.body')}</p>
          <p className="text-xs text-muted">{t(lang, 'dl.success.spam')}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 min-h-11 rounded-xl bg-brand px-8 text-sm font-semibold text-white hover:bg-brand/90"
          >
            {t(lang, 'dl.success.done')}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t(lang, 'dl.title')} closeLabel={t(lang, 'dl.close')} onClose={onClose} testId="download-dialog">
      <form noValidate onSubmit={submit} className="flex flex-col gap-5" data-testid="download-form">
        <p className="text-sm text-muted">{t(lang, 'dl.intro')}</p>

        <fieldset className="flex flex-col gap-2" aria-describedby={describedBy('formats')}>
          <legend id={id('formats')} tabIndex={-1} className="mb-2 text-xs font-medium text-muted outline-none">
            {t(lang, 'dl.formats')}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SIZES.map((size) => (
              <FormatOption
                key={size}
                testId={`format-${size}`}
                checked={sizes.includes(size)}
                onChange={(on) => toggleSize(size, on)}
                title={t(lang, `dl.format.${size}`)}
                desc={t(lang, `dl.format.${size}.desc`)}
              />
            ))}
          </div>
          <FormatOption
            testId="format-bleed"
            checked={bleed}
            onChange={setBleed}
            title={t(lang, 'dl.bleed')}
            desc={t(lang, 'dl.bleed.desc')}
          />
          {shown('formats') && (
            <p id={`${id('formats')}-error`} data-testid="formats-error" className="text-xs text-red-600">
              {t(lang, 'dl.err.formats')}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-3">
          <Field id={id('email')} label={t(lang, 'dl.email')} error={shown('email')} lang={lang}>
            <input
              id={id('email')}
              data-testid="dl-email"
              type="email"
              dir="ltr"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={blur('email')}
              aria-invalid={Boolean(shown('email'))}
              aria-describedby={describedBy('email')}
              placeholder="name@company.sa"
              className={`${inputClass} ${inputState(Boolean(shown('email')))} text-start`}
            />
          </Field>
          <Field id={id('orgName')} label={t(lang, 'dl.org')} error={shown('orgName')} lang={lang}>
            <input
              id={id('orgName')}
              data-testid="dl-org"
              autoComplete="organization"
              required
              maxLength={200}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onBlur={blur('orgName')}
              aria-invalid={Boolean(shown('orgName'))}
              aria-describedby={describedBy('orgName')}
              className={`${inputClass} ${inputState(Boolean(shown('orgName')))}`}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={id('sector')} label={t(lang, 'dl.sector')} lang={lang}>
              <select
                id={id('sector')}
                data-testid="dl-sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className={`${inputClass} ${inputState(false)}`}
              >
                <option value="">{t(lang, 'dl.sector.none')}</option>
                {sectors.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={id('phone')} label={t(lang, 'dl.phone')} error={shown('phone')} lang={lang}>
              <input
                id={id('phone')}
                data-testid="dl-phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={blur('phone')}
                aria-invalid={Boolean(shown('phone'))}
                aria-describedby={describedBy('phone')}
                placeholder="05XXXXXXXX"
                className={`${inputClass} ${inputState(Boolean(shown('phone')))} text-start`}
              />
            </Field>
          </div>
        </div>

        {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} lang={lang} onToken={setCaptcha} />}

        {serverError && (
          <p role="alert" data-testid="download-error" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {t(lang, serverError)}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            data-testid="download-submit"
            disabled={busy}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-base font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-wait disabled:opacity-70"
          >
            {busy && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {t(lang, busy ? 'dl.submitting' : 'dl.submit')}
          </button>
          <p data-testid="download-notice" className="text-center text-xs leading-relaxed text-muted">
            {t(lang, 'dl.notice.before')}
            <Link href="/privacy" target="_blank" className="font-medium text-brand underline-offset-2 hover:underline">
              {t(lang, 'dl.notice.link')}
            </Link>
            {t(lang, 'dl.notice.after')}
          </p>
        </div>
      </form>
    </Modal>
  );
}
