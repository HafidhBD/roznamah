import { describe, expect, it } from 'vitest';
import { containsArabicWord, joinSplitLetters, tokensNear } from '../e2e/pdf-text';

describe('Arabic checks on pdftotext output', () => {
  it('accepts logical, reversed and known-ligature-swapped forms only', () => {
    expect(containsArabicWord('اليوم الوطني', 'الوطني')).toBe(true);
    expect(containsArabicWord('مويلا نيطولا', 'الوطني')).toBe(true); // visual order, ligature kept
    expect(containsArabicWord('اليوم الوطين', 'الوطني')).toBe(true); // «ني» ligature swapped
    expect(containsArabicWord('مالحظات', 'ملاحظات')).toBe(true); // lam-alef swapped
    expect(containsArabicWord('اليوم الطوني', 'الوطني')).toBe(false); // not a ligature pair
    expect(containsArabicWord('ا ل و ط ن ي', 'الوطني')).toBe(false); // disjoint letters without joining
    expect(containsArabicWord('الوطن', 'الوطني')).toBe(false);
  });

  it('rejoins letters Poppler split apart, but keeps real word gaps', () => {
    expect(joinSplitLetters('Wavesللت ق ن ي ة 2027')).toBe('Wavesللتقنية 2027');
    expect(joinSplitLetters('الي وم الوطن ي')).toBe('الي وم الوطني');
    expect(joinSplitLetters('اليوم الوطني')).toBe('اليوم الوطني');
  });

  it('finds tokens close together', () => {
    expect(tokensNear(' Wavesللتقنية 2027', ['Waves', 'للتقنية', '2027'])).toBe(true);
    expect(tokensNear(`Waves ${'x'.repeat(200)} للتقنية 2027`, ['Waves', 'للتقنية', '2027'])).toBe(false);
  });
});
