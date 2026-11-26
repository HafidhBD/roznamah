/**
 * The calendar as printed: a cover and 12 month pages at real mm sizes. Preview and print render
 * the very same markup; the studio only scales the page to fit its container.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { CalendarSnapshot } from '@/lib/snapshot-core';
import { CoverPage } from './CoverPage';
import { MonthPage } from './MonthPage';
import { ARTBOARD, BLEED_MM, DEFAULT_FORMAT, PAGE_MM, readableOn, type PageFormat } from './doc';
import { FONT_FAMILY, KUFI } from './fonts';
import { makeContext } from './primitives';
import './calendar-document.css';

export type { PageFormat } from './doc';

/** Outer page size in mm, including bleed. */
export function pageSizeMm(format: PageFormat) {
  const trim = PAGE_MM[format.size];
  const bleed = format.bleed ? BLEED_MM : 0;
  return { w: trim.w + 2 * bleed, h: trim.h + 2 * bleed, bleed };
}

function Page({ kind, format, children }: { kind: 'cover' | 'month'; format: PageFormat; children: ReactNode }) {
  const { w, h, bleed } = pageSizeMm(format);
  const scale = PAGE_MM[format.size].w / ARTBOARD.w;
  return (
    <section className="rz-page" data-page={kind} style={{ width: `${w}mm`, height: `${h}mm` }}>
      <div
        className="rz-art"
        style={
          {
            top: `${bleed}mm`,
            left: `${bleed}mm`,
            width: `${ARTBOARD.w}mm`,
            height: `${ARTBOARD.h}mm`,
            transform: scale === 1 ? undefined : `scale(${scale})`,
            '--bleed': `${bleed / scale}mm`,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </section>
  );
}

type Props = {
  data: CalendarSnapshot;
  format?: PageFormat;
  mode: 'preview' | 'print';
  /** Page indexes to render (0 = cover, 1–12 = months); all pages when omitted. */
  pages?: number[];
};

export function CalendarDocument({ data, format = DEFAULT_FORMAT, mode, pages }: Props) {
  const ctx = makeContext(data);
  const { design, langs } = ctx;
  const want = (i: number) => !pages || pages.includes(i);
  const { w, h } = pageSizeMm(format);
  const vars = {
    '--p': design.primary,
    '--p-ink': readableOn(design.primary),
    '--s': design.secondary,
    '--s-ink': readableOn(design.secondary),
    '--font': FONT_FAMILY[design.font] ?? FONT_FAMILY.plex,
    '--kufi': KUFI,
  } as CSSProperties;
  return (
    <div
      className="rz-doc"
      data-template={design.template}
      data-mode={mode}
      data-lang={design.language}
      lang={langs.main}
      dir={langs.dir}
      style={vars}
    >
      {mode === 'print' && <style>{`@page { size: ${w}mm ${h}mm; margin: 0; }`}</style>}
      {want(0) && (
        <Page kind="cover" format={format}>
          <CoverPage ctx={ctx} />
        </Page>
      )}
      {data.months.map((month, i) =>
        want(i + 1) ? (
          <Page key={`${month.year}-${month.month0}`} kind="month" format={format}>
            <MonthPage ctx={ctx} month={month} index={i} />
          </Page>
        ) : null,
      )}
    </div>
  );
}
