/**
 * Checking Arabic in pdftotext output despite Poppler's known artifacts on Chromium PDFs. The pages
 * themselves are shaped and ordered correctly (verified on PNG renders); Chromium stores the
 * logical text as /ActualText inside /ReversedChars runs, and Poppler 24 (a) may emit a word in
 * visual (character-reversed) order, (b) reverses the two letters of a ligature glyph's
 * ActualText (IBM Plex «ني» → «ين», lam-alef «لا» → «ال»), and (c) splits letters drawn with
 * cursive-attachment offsets (Noto Kufi «للتقنية» → «للت ق ن ي ة»).
 */
import { execFileSync } from 'node:child_process';

/** Two-letter ligatures whose letters Poppler swaps; only these swaps are tolerated. */
const LIGATURE_PAIRS = ['لا', 'لأ', 'لإ', 'لآ', 'ني', 'نى'];
/** The pairs as they appear in a word's logical or character-reversed form. */
const SWAPPABLE = new Set(LIGATURE_PAIRS.flatMap((p) => [p, [...p].reverse().join('')]));
const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/g;
const ARABIC = '؀-ۿ';

/** pdftotext output, NFKC-normalized, without bidi controls. */
export function pdfText(file: string, mode: '-raw' | '-layout' | null = null): string {
  const args = [...(mode ? [mode] : []), file, '-'];
  return execFileSync('pdftotext', args, { encoding: 'utf8' }).normalize('NFKC').replace(BIDI_MARKS, '');
}

/** Undoes artifact (c): drops a space between two Arabic letters when either side is a lone letter. */
export function joinSplitLetters(text: string): string {
  const lone = new RegExp(`(?<=(?:^|[^${ARABIC}])[${ARABIC}]) (?=[${ARABIC}])|(?<=[${ARABIC}]) (?=[${ARABIC}](?:[^${ARABIC}]|$))`, 'gmu');
  let prev = '';
  let out = text;
  while (out !== prev) [prev, out] = [out, out.replace(lone, '')];
  return out;
}

/** Does `text` at `i` spell `word`, allowing the known ligature swaps (artifact b)? */
function spellsAt(text: string, i: number, word: string): boolean {
  let t = i;
  for (let w = 0; w < word.length; ) {
    if (text[t] === word[w]) {
      t++;
      w++;
    } else if (SWAPPABLE.has(word.slice(w, w + 2)) && text[t] === word[w + 1] && text[t + 1] === word[w]) {
      t += 2;
      w += 2;
    } else return false;
  }
  return true;
}

/**
 * Start offsets where `word` (NFKC) occurs in `text` in logical form or character-reversed
 * (artifact a), tolerating only the known ligature swaps (b). Run `joinSplitLetters` first for (c).
 */
export function arabicWordPositions(text: string, word: string): number[] {
  const forms = [...new Set([word.normalize('NFKC'), [...word.normalize('NFKC')].reverse().join('')])];
  const hits: number[] = [];
  for (let i = 0; i < text.length; i++) if (forms.some((f) => spellsAt(text, i, f))) hits.push(i);
  return hits;
}

export const containsArabicWord = (text: string, word: string) => arabicWordPositions(text, word).length > 0;

const positions = (text: string, token: string) => {
  const out: number[] = [];
  for (let i = text.indexOf(token); i >= 0; i = text.indexOf(token, i + 1)) out.push(i);
  return out;
};

/** True when one occurrence of each token (Arabic tokens via `arabicWordPositions`) fits in `span` chars. */
export function tokensNear(text: string, tokens: string[], span = 100): boolean {
  const lists = tokens.map((tk) => (/[؀-ۿ]/.test(tk) ? arabicWordPositions(text, tk) : positions(text, tk)));
  if (lists.some((l) => !l.length)) return false;
  return lists[0].some((start) =>
    lists.every((l, k) => l.some((p) => p >= start - span && p + tokens[k].length <= start + tokens[0].length + span && Math.abs(p - start) <= span)),
  );
}
