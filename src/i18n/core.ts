import { ar } from './ar';
import { en } from './en';

export type Lang = 'ar' | 'en';
export type MessageKey = keyof typeof ar;

const messages: Record<Lang, Record<MessageKey, string>> = { ar, en };

export function t(lang: Lang, key: MessageKey): string {
  return messages[lang][key];
}
