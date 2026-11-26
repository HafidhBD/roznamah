'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { t, type MessageKey } from '@/i18n/core';

export type EventFormValues = {
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  kind: string;
  recurrence: string;
  gMonth: number | null;
  gDay: number | null;
  hMonth: number | null;
  hDay: number | null;
  durationDays: number;
  prepDays: number;
  icon: string | null;
  color: string | null;
  contentIdeaAr: string | null;
  contentIdeaEn: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  active: boolean;
  tags: { termId: number; weight: number }[];
};

export type TermOption = { id: number; group: string; labelAr: string; active: boolean };

const KINDS = ['national', 'religious', 'international', 'field', 'commercial'];
const RECURRENCES = ['gregorian_fixed', 'hijri_fixed', 'annual_manual'];
const GROUPS = ['sector', 'field', 'audience', 'use'];

export const EMPTY_EVENT: EventFormValues = {
  slug: '',
  titleAr: '',
  titleEn: '',
  descriptionAr: '',
  descriptionEn: '',
  kind: 'national',
  recurrence: 'gregorian_fixed',
  gMonth: 1,
  gDay: 1,
  hMonth: null,
  hDay: null,
  durationDays: 1,
  prepDays: 14,
  icon: null,
  color: null,
  contentIdeaAr: null,
  contentIdeaEn: null,
  sourceName: null,
  sourceUrl: null,
  active: true,
  tags: [],
};

const L = (key: MessageKey) => t('ar', key);
const box = 'rounded-lg border border-line bg-surface px-3 py-2 text-sm w-full';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

const num = (v: FormDataEntryValue | null) => (v === null || v === '' ? null : Number(v));
const str = (v: FormDataEntryValue | null) => (v === null ? '' : String(v));

export function EventForm({ id, initial, terms }: { id?: string; initial: EventFormValues; terms: TermOption[] }) {
  const router = useRouter();
  const [recurrence, setRecurrence] = useState(initial.recurrence);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const weightOf = (termId: number) => initial.tags.find((x) => x.termId === termId)?.weight ?? 0;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const tags = terms
      .map((term) => ({ termId: term.id, weight: Number(f.get(`tag-${term.id}`) ?? 0) }))
      .filter((x) => x.weight > 0);
    const body = {
      slug: str(f.get('slug')),
      titleAr: str(f.get('titleAr')),
      titleEn: str(f.get('titleEn')),
      descriptionAr: str(f.get('descriptionAr')),
      descriptionEn: str(f.get('descriptionEn')),
      kind: str(f.get('kind')),
      recurrence: str(f.get('recurrence')),
      gMonth: num(f.get('gMonth')),
      gDay: num(f.get('gDay')),
      hMonth: num(f.get('hMonth')),
      hDay: num(f.get('hDay')),
      durationDays: num(f.get('durationDays')),
      prepDays: num(f.get('prepDays')),
      icon: str(f.get('icon')),
      color: str(f.get('color')),
      contentIdeaAr: str(f.get('contentIdeaAr')),
      contentIdeaEn: str(f.get('contentIdeaEn')),
      sourceName: str(f.get('sourceName')),
      sourceUrl: str(f.get('sourceUrl')),
      active: f.get('active') === 'on',
      tags,
    };
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(id ? `/api/admin/events/${id}` : '/api/admin/events', {
        method: id ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        if (!id) {
          const created = (await res.json()) as { id: string };
          router.push(`/admin/events/${created.id}`);
          return;
        }
        setStatus({ kind: 'ok', text: L('admin.form.saved') });
        router.refresh();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus({
          kind: 'error',
          text:
            err.error === 'slug_taken'
              ? L('admin.form.slugTaken')
              : err.error === 'slug_immutable'
                ? L('admin.form.slugFixed')
                : L('admin.form.error'),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} data-testid="event-form" className="flex max-w-3xl flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={L('admin.form.slug')}>
          <input
            name="slug"
            defaultValue={initial.slug}
            required
            readOnly={!!id}
            aria-describedby={id ? 'slug-hint' : undefined}
            dir="ltr"
            data-testid="field-slug"
            className={`${box} ${id ? 'cursor-not-allowed text-muted' : ''}`}
          />
          {id && (
            <span id="slug-hint" className="text-xs text-muted">
              {L('admin.form.slugFixed')}
            </span>
          )}
        </Field>
        <Field label={L('admin.form.kind')}>
          <select name="kind" defaultValue={initial.kind} className={box}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {L(`admin.kind.${k}` as MessageKey)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={L('admin.form.titleAr')}>
          <input name="titleAr" defaultValue={initial.titleAr} required maxLength={200} data-testid="field-titleAr" className={box} />
        </Field>
        <Field label={L('admin.form.titleEn')}>
          <input name="titleEn" defaultValue={initial.titleEn} required maxLength={200} dir="ltr" data-testid="field-titleEn" className={box} />
        </Field>
        <Field label={L('admin.form.descAr')}>
          <textarea name="descriptionAr" defaultValue={initial.descriptionAr} rows={3} maxLength={2000} className={box} />
        </Field>
        <Field label={L('admin.form.descEn')}>
          <textarea name="descriptionEn" defaultValue={initial.descriptionEn} rows={3} maxLength={2000} dir="ltr" className={box} />
        </Field>
        <Field label={L('admin.form.recurrence')}>
          <select name="recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={box}>
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {L(`admin.recurrence.${r}` as MessageKey)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {recurrence === 'gregorian_fixed' && (
            <>
              <Field label={L('admin.form.gMonth')}>
                <input name="gMonth" type="number" min={1} max={12} defaultValue={initial.gMonth ?? ''} className={box} />
              </Field>
              <Field label={L('admin.form.gDay')}>
                <input name="gDay" type="number" min={1} max={31} defaultValue={initial.gDay ?? ''} className={box} />
              </Field>
            </>
          )}
          {recurrence === 'hijri_fixed' && (
            <>
              <Field label={L('admin.form.hMonth')}>
                <input name="hMonth" type="number" min={1} max={12} defaultValue={initial.hMonth ?? ''} className={box} />
              </Field>
              <Field label={L('admin.form.hDay')}>
                <input name="hDay" type="number" min={1} max={30} defaultValue={initial.hDay ?? ''} className={box} />
              </Field>
            </>
          )}
        </div>
        <Field label={L('admin.form.duration')}>
          <input name="durationDays" type="number" min={1} max={60} defaultValue={initial.durationDays} className={box} />
        </Field>
        <Field label={L('admin.form.prep')}>
          <input name="prepDays" type="number" min={0} max={365} defaultValue={initial.prepDays} className={box} />
        </Field>
        <Field label={L('admin.form.icon')}>
          <input name="icon" defaultValue={initial.icon ?? ''} maxLength={16} className={box} />
        </Field>
        <Field label={L('admin.form.color')}>
          <input name="color" defaultValue={initial.color ?? ''} pattern="#[0-9a-fA-F]{6}" dir="ltr" className={box} />
        </Field>
        <Field label={L('admin.form.contentAr')}>
          <textarea name="contentIdeaAr" defaultValue={initial.contentIdeaAr ?? ''} rows={2} maxLength={1000} className={box} />
        </Field>
        <Field label={L('admin.form.contentEn')}>
          <textarea name="contentIdeaEn" defaultValue={initial.contentIdeaEn ?? ''} rows={2} maxLength={1000} dir="ltr" className={box} />
        </Field>
        <Field label={L('admin.form.sourceName')}>
          <input name="sourceName" defaultValue={initial.sourceName ?? ''} maxLength={200} className={box} />
        </Field>
        <Field label={L('admin.form.sourceUrl')}>
          <input name="sourceUrl" type="url" defaultValue={initial.sourceUrl ?? ''} dir="ltr" className={box} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={initial.active} data-testid="field-active" />
        {L('admin.form.active')}
      </label>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">{L('admin.form.tags')}</legend>
        {GROUPS.map((g) => (
          <div key={g}>
            <div className="mb-1 text-sm text-muted">{L(`admin.taxonomy.group.${g}` as MessageKey)}</div>
            <div className="flex flex-wrap gap-2">
              {terms
                .filter((term) => term.group === g)
                .map((term) => (
                  <label key={term.id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1 text-sm">
                    <span className={term.active ? '' : 'text-muted line-through'}>{term.labelAr}</span>
                    <select name={`tag-${term.id}`} defaultValue={weightOf(term.id)} aria-label={`${term.labelAr}: ${L('admin.form.weight')}`} className="rounded border border-line bg-surface">
                      <option value={0}>-</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </label>
                ))}
            </div>
          </div>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} data-testid="event-save" className="rounded-lg bg-brand px-5 py-2 font-semibold text-white disabled:opacity-60">
          {id ? L('admin.form.save') : L('admin.form.create')}
        </button>
        {status && (
          <span role={status.kind === 'error' ? 'alert' : 'status'} data-testid="event-status" className={status.kind === 'error' ? 'text-red-700' : 'text-green-700'}>
            {status.text}
          </span>
        )}
      </div>
    </form>
  );
}
