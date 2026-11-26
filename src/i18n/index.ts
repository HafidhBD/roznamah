import { cookies } from 'next/headers';
import type { Lang } from './core';

export { t } from './core';
export type { Lang, MessageKey } from './core';

export const LANG_COOKIE = 'rz_lang';

export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return value === 'en' ? 'en' : 'ar';
}
