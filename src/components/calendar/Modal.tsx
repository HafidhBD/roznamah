'use client';

import { useEffect, useRef } from 'react';

type Props = {
  title: string;
  closeLabel: string;
  onClose: () => void;
  testId: string;
  children: React.ReactNode;
};

/** Bottom sheet on phones, centered card from `sm` up. Escape and the backdrop close it. */
export function Modal({ title, closeLabel, onClose, testId, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-[#1b1630]/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold leading-snug">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            data-testid="modal-close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-lg leading-none text-muted hover:border-brand hover:text-brand"
          >
            <span aria-hidden>×</span>
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
