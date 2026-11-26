'use client';

import { t, type Lang } from '@/i18n/core';
import type { DraftAction } from './useDraftEvents';

/** Visible feedback when adding or removing an occasion fails (plan builder and calendar). */
export function DraftFailureAlert({
  lang,
  failure,
  onDismiss,
  testId,
}: {
  lang: Lang;
  failure: DraftAction | null;
  onDismiss: () => void;
  testId: string;
}) {
  if (!failure) return null;
  return (
    <div
      role="alert"
      data-testid={testId}
      className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <span>{t(lang, failure === 'add' ? 'calendar.err.add' : 'calendar.err.remove')}</span>
      <button type="button" onClick={onDismiss} className="shrink-0 rounded-lg px-2 py-1 font-semibold hover:bg-red-100">
        {t(lang, 'calendar.err.dismiss')}
      </button>
    </div>
  );
}
