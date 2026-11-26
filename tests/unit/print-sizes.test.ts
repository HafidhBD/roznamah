import { describe, expect, it } from 'vitest';
import { decodePageFormat, encodePageFormat, pageSizeMm } from '@/lib/print-sizes';

describe('print sizes', () => {
  it('gives trim sizes, plus 3 mm on every side with bleed', () => {
    expect(pageSizeMm({ kind: 'wall', size: 'A4', bleed: false })).toEqual({ width: 210, height: 297, bleed: 0 });
    expect(pageSizeMm({ kind: 'wall', size: 'A3', bleed: false })).toEqual({ width: 297, height: 420, bleed: 0 });
    expect(pageSizeMm({ kind: 'wall', size: 'A3', bleed: true })).toEqual({ width: 303, height: 426, bleed: 3 });
    expect(pageSizeMm({ kind: 'wall', size: 'A4', bleed: true })).toEqual({ width: 216, height: 303, bleed: 3 });
  });

  it('round-trips a format through base64url and rejects anything else', () => {
    const f = { kind: 'wall', size: 'A3', bleed: true } as const;
    const s = encodePageFormat(f);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePageFormat(s)).toEqual(f);
    expect(decodePageFormat(null)).toBeNull();
    expect(decodePageFormat('')).toBeNull();
    expect(decodePageFormat('%%%')).toBeNull();
    expect(decodePageFormat(Buffer.from('{"kind":"wall","size":"A5","bleed":false}').toString('base64url'))).toBeNull();
    expect(decodePageFormat(Buffer.from('{"kind":"wall","size":"A4"}').toString('base64url'))).toBeNull();
    expect(decodePageFormat(Buffer.from('not json').toString('base64url'))).toBeNull();
  });
});
