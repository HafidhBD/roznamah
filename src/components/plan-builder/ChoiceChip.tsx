'use client';

type Props = {
  id: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
  /** `card` is the larger single-choice style used for the sector. */
  variant?: 'chip' | 'card';
  testId: string;
};

export function ChoiceChip({ label, selected, onToggle, variant = 'chip', testId }: Props) {
  const base =
    'cursor-pointer select-none border text-start transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  const size =
    variant === 'card'
      ? 'flex min-h-16 items-center rounded-2xl px-4 py-3 text-sm sm:text-base font-semibold'
      : 'rounded-full px-4 py-2 text-sm';
  const tone = selected
    ? 'border-brand bg-brand text-white shadow-sm'
    : 'border-line bg-surface text-ink hover:border-brand hover:text-brand';
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      onClick={onToggle}
      className={`${base} ${size} ${tone}`}
    >
      {label}
    </button>
  );
}
