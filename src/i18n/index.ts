import { cookies } from 'next/headers';
import { ar } from './ar';
import { en } from './en';

export type Lang = 'ar' | 'en';
export type MessageKey = keyof typeof ar;

export const LANG_COOKIE = 'rz_lang';

const messages: Record<Lang, Record<MessageKey, string>> = { ar, en };

export function t(lang: Lang, key: MessageKey): string {
  return messages[lang][key];
}

export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return value === 'en' ? 'en' : 'ar';
}
