'use server';

import { cookies } from 'next/headers';
import { getLang, LANG_COOKIE } from '@/i18n';

export async function toggleLang(): Promise<void> {
  const next = (await getLang()) === 'ar' ? 'en' : 'ar';
  (await cookies()).set(LANG_COOKIE, next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
