'use client';

import { useState } from 'react';
import { t, type Lang, type MessageKey } from '@/i18n/core';
import type { CustomPayload, CustomResult } from '@/components/plan-builder/useDraftEvents';
import { Modal } from './Modal';

type Props = {
  lang: Lang;
  min: string;
  max: string;
  defaultDate: string;
  primary: string;
  onSubmit: (payload: CustomPayload) => Promise<CustomResult>;
  onClose: () => void;
};

const PRESETS = ['#0f9d77', '#e0702c', '#d6336c', '#2f6fdd', '#c79a2e'];
const field =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

export function CustomEventForm({ lang, min, max, defaultDate, primary, onSubmit, onClose }: Props) {
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [color, setColor] = useState(primary);
  const [errors, setErrors] = useState<Partial<Record<'titleAr' | 'titleEn' | 'date' | 'form', MessageKey>>>({});
  const [saving, setSaving] = useState(false);

  const colors = [primary, ...PRESETS.filter((c) => c.toLowerCase() !== primary.toLowerCase())].slice(0, 6);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const ar = titleAr.trim();
    if (!ar || ar.length > 120) next.titleAr = 'calendar.custom.errTitle';
    if (titleEn.trim().length > 120) next.titleEn = 'calendar.custom.errTitleEn';
    if (!date || date < min || date > max) next.date = 'calendar.custom.errDate';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    const res = await onSubmit({
      titleAr: ar,
      ...(titleEn.trim() ? { titleEn: titleEn.trim() } : {}),
      date,
      color,
    });
    setSaving(false);
    if (res.ok) return;
    if (res.error === 'date_outside_span') setErrors({ date: 'calendar.custom.errOutside' });
    else if (res.error === 'invalid_body') setErrors({ titleAr: 'calendar.custom.errTitle' });
    else setErrors({ form: 'calendar.custom.errGeneric' });
  };

  const err = (k: keyof typeof errors) =>
    errors[k] && (
      <p role="alert" data-testid={`custom-error-${k}`} className="mt-1 text-sm text-red-700">
        {t(lang, errors[k])}
      </p>
    );

  return (
    <Modal title={t(lang, 'calendar.custom.title')} closeLabel={t(lang, 'calendar.day.close')} onClose={onClose} testId="custom-form">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t(lang, 'calendar.custom.titleAr')}
          <input
            data-testid="custom-title-ar"
            dir="rtl"
            value={titleAr}
            maxLength={120}
            onChange={(e) => setTitleAr(e.target.value)}
            aria-invalid={!!errors.titleAr}
            className={field}
          />
          {err('titleAr')}
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t(lang, 'calendar.custom.titleEn')}
          <input
            data-testid="custom-title-en"
            dir="ltr"
            value={titleEn}
            maxLength={120}
            onChange={(e) => setTitleEn(e.target.value)}
            aria-invalid={!!errors.titleEn}
            className={field}
          />
          {err('titleEn')}
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t(lang, 'calendar.custom.date')}
          <input
            data-testid="custom-date"
            type="date"
            min={min}
            max={max}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!errors.date}
            className={field}
          />
          {err('date')}
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">{t(lang, 'calendar.custom.color')}</legend>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                data-testid={`custom-color-${c.slice(1)}`}
                aria-pressed={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={`size-9 rounded-full border-2 border-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  color === c ? 'ring-2 ring-ink' : 'ring-1 ring-line'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        {err('form')}
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            data-testid="custom-submit"
            disabled={saving}
            className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? t(lang, 'calendar.custom.saving') : t(lang, 'calendar.custom.save')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-muted hover:border-brand hover:text-brand"
          >
            {t(lang, 'calendar.custom.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
