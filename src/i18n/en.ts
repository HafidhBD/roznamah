import type { ar } from './ar';

type Messages = Record<keyof typeof ar, string>;

export const en: Messages = {
  'brand.name': 'Roznamah',
  'brand.tagline': 'Plan your year around its occasions',
  'nav.home': 'Home',
  'nav.calendar': 'Calendar',
  'nav.studio': 'Studio',
  'nav.primary': 'Primary navigation',
  'nav.mobile': 'Bottom navigation',
  'lang.toggle': 'العربية',
  'lang.toggleLabel': 'Switch to Arabic',
  'home.title': 'Build your 12-month occasions calendar',
  'home.subtitle': 'A calendar in your organization’s identity, ready to print and share.',
  'calendar.title': 'Calendar',
  'calendar.placeholder': 'Your calendar will appear here.',
  'studio.title': 'Identity studio',
  'studio.placeholder': 'Design your calendar identity here.',
};
