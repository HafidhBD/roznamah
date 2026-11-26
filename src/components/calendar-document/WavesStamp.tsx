import { t, type Lang } from '@/i18n/core';

/**
 * The «تصميم وإعداد ويفز» mark. Rendered in the footer of every page by both templates; it takes
 * no props that could hide it (only the document language and a tone for dark/light footers).
 */
export function WavesStamp({ lang }: { lang: Lang }) {
  return (
    <div data-waves-stamp className="rz-stamp" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <span className="rz-stamp-text">{t(lang, 'doc.stamp')}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="rz-stamp-logo" src="/brand/waves.png" alt={t(lang, 'doc.stamp.alt')} />
    </div>
  );
}
