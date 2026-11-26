'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { t } from '@/i18n/core';

export type TermValues = { id: number; key: string; labelAr: string; labelEn: string; sort: number; active: boolean };

const box = 'rounded-lg border border-line bg-surface px-2 py-1 text-sm w-full';

export function TaxonomyRow({ term }: { term: TermValues }) {
  const router = useRouter();
  const [saved, setSaved] = useState<'ok' | 'error' | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/taxonomy/${term.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        labelAr: f.get('labelAr'),
        labelEn: f.get('labelEn'),
        sort: Number(f.get('sort')),
        active: f.get('active') === 'on',
      }),
    });
    setSaved(res.ok ? 'ok' : 'error');
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} data-testid={`term-${term.key}`} className="grid items-center gap-2 border-b border-line py-2 md:grid-cols-[1fr_1fr_5rem_6rem_6rem]">
      <input name="labelAr" defaultValue={term.labelAr} required maxLength={100} aria-label={t('ar', 'admin.taxonomy.labelAr')} className={box} />
      <input name="labelEn" defaultValue={term.labelEn} required maxLength={100} dir="ltr" aria-label={t('ar', 'admin.taxonomy.labelEn')} className={box} />
      <input name="sort" type="number" min={0} defaultValue={term.sort} aria-label={t('ar', 'admin.taxonomy.sort')} className={box} />
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={term.active} />
        {t('ar', 'admin.taxonomy.active')}
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg border border-line px-3 py-1 text-sm hover:border-brand">
          {t('ar', 'admin.taxonomy.save')}
        </button>
        {saved === 'ok' && <span role="status" className="text-sm text-green-700">{t('ar', 'admin.taxonomy.saved')}</span>}
        {saved === 'error' && <span role="alert" className="text-sm text-red-700">{t('ar', 'admin.form.error')}</span>}
      </div>
    </form>
  );
}
