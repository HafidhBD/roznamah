'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { t, type MessageKey } from '@/i18n/core';

export type OccurrenceRow = {
  year: number;
  computed: string[];
  effective: { start: string; status: 'confirmed' | 'estimated' }[];
  override: { startDate: string; status: 'confirmed' | 'estimated'; sourceUrl: string | null } | null;
};

const L = (key: MessageKey) => t('ar', key);
const box = 'rounded-lg border border-line bg-surface px-3 py-2 text-sm';

export function OccurrenceEditor({ eventId, rows, initialYear }: { eventId: string; rows: OccurrenceRow[]; initialYear: number }) {
  const router = useRouter();
  const pick = (year: number) => rows.find((r) => r.year === year);
  const defaults = (year: number) => {
    const r = pick(year);
    return {
      startDate: r?.override?.startDate ?? r?.effective[0]?.start ?? '',
      status: r?.override?.status ?? 'confirmed',
      sourceUrl: r?.override?.sourceUrl ?? '',
    };
  };
  const [year, setYear] = useState(initialYear);
  const [form, setForm] = useState(() => defaults(initialYear));
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function selectYear(y: number) {
    setYear(y);
    setForm(defaults(y));
    setMsg(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/events/${eventId}/occurrences`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ year, startDate: form.startDate, status: form.status, sourceUrl: form.sourceUrl }),
    });
    setMsg(res.ok ? { kind: 'ok', text: L('admin.occ.saved') } : { kind: 'error', text: L('admin.occ.error') });
    if (res.ok) router.refresh();
  }

  async function remove() {
    const res = await fetch(`/api/admin/events/${eventId}/occurrences?year=${year}`, { method: 'DELETE' });
    setMsg(res.ok ? { kind: 'ok', text: L('admin.occ.saved') } : { kind: 'error', text: L('admin.occ.error') });
    if (res.ok) router.refresh();
  }

  return (
    <section id="occurrences" className="flex max-w-3xl flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="font-semibold">{L('admin.occ.title')}</h2>
      <table className="w-full text-start text-sm" data-testid="occurrence-table">
        <thead className="text-muted">
          <tr>
            <th className="py-1 text-start font-medium">{L('admin.occ.year')}</th>
            <th className="py-1 text-start font-medium">{L('admin.occ.computed')}</th>
            <th className="py-1 text-start font-medium">{L('admin.occ.effective')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.year} data-testid={`occ-row-${r.year}`}>
              <td className="py-1">{r.year}</td>
              <td className="py-1" dir="ltr">
                {r.computed.join(' , ') || L('admin.occ.none')}
              </td>
              <td className="py-1" dir="ltr">
                {r.effective.length
                  ? r.effective.map((o) => `${o.start} (${L(`admin.occ.${o.status}` as MessageKey)})`).join(' , ')
                  : L('admin.occ.none')}
                {r.override ? ` - ${L('admin.occ.override')}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={save} className="grid gap-3 md:grid-cols-4" data-testid="occurrence-form">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{L('admin.occ.year')}</span>
          <select value={year} onChange={(e) => selectYear(Number(e.target.value))} data-testid="occ-year" className={box}>
            {rows.map((r) => (
              <option key={r.year} value={r.year}>
                {r.year}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{L('admin.occ.startDate')}</span>
          <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="occ-date" className={box} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{L('admin.occ.status')}</span>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'confirmed' | 'estimated' })} data-testid="occ-status" className={box}>
            <option value="confirmed">{L('admin.occ.confirmed')}</option>
            <option value="estimated">{L('admin.occ.estimated')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{L('admin.occ.sourceUrl')}</span>
          <input type="url" dir="ltr" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} className={box} />
        </label>
        <div className="flex items-center gap-3 md:col-span-4">
          <button type="submit" data-testid="occ-save" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            {L('admin.occ.save')}
          </button>
          {pick(year)?.override && (
            <button type="button" onClick={remove} data-testid="occ-remove" className="rounded-lg border border-line px-4 py-2 text-sm hover:border-brand">
              {L('admin.occ.remove')}
            </button>
          )}
          {msg && (
            <span role={msg.kind === 'error' ? 'alert' : 'status'} data-testid="occ-status-msg" className={msg.kind === 'error' ? 'text-red-700' : 'text-green-700'}>
              {msg.text}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
