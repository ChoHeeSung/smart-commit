import stringWidth from "string-width";
import { detectLocale } from "../i18n.js";

const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯]/;
const CJK_RE = /[　-鿿가-힯＀-￯]/;

function isEastAsianLocale(): boolean {
  if (detectLocale() === "ko") return true;
  const lang = process.env.LANG ?? process.env.LC_ALL ?? process.env.LC_CTYPE ?? "";
  return /^(ko|ja|zh)/i.test(lang);
}

let cachedLocaleEA: boolean | null = null;
function localeEA(): boolean {
  if (cachedLocaleEA === null) cachedLocaleEA = isEastAsianLocale();
  return cachedLocaleEA;
}

function shouldUseWide(s: string): boolean {
  if (localeEA()) return true;
  return CJK_RE.test(s);
}

export function displayWidth(s: string, forceWide?: boolean): number {
  const wide = forceWide ?? shouldUseWide(s);
  return stringWidth(s, { ambiguousIsNarrow: !wide });
}

export function cwTruncate(s: string, maxCols: number, forceWide?: boolean): string {
  const wide = forceWide ?? shouldUseWide(s);
  if (maxCols <= 0) return "";
  if (displayWidth(s, wide) <= maxCols) return s;

  const ellipsis = "..";
  const budget = maxCols - 2;
  if (budget <= 0) return ellipsis.slice(0, maxCols);

  let out = "";
  let used = 0;
  for (const ch of s) {
    const w = stringWidth(ch, { ambiguousIsNarrow: !wide });
    if (used + w > budget) break;
    out += ch;
    used += w;
  }
  return out + ellipsis;
}

export function cwPad(s: string, targetCols: number, forceWide?: boolean): string {
  const wide = forceWide ?? shouldUseWide(s);
  const truncated = cwTruncate(s, targetCols, wide);
  const gap = targetCols - displayWidth(truncated, wide);
  return gap > 0 ? truncated + " ".repeat(gap) : truncated;
}

export function cellPad(s: string, width: number, forceWide?: boolean): string {
  if (width <= 1) return cwPad(s, width, forceWide);
  return cwPad(cwTruncate(s, width - 1, forceWide), width, forceWide);
}

export function cwCenter(s: string, targetCols: number, forceWide?: boolean): string {
  const wide = forceWide ?? shouldUseWide(s);
  const truncated = cwTruncate(s, targetCols, wide);
  const gap = targetCols - displayWidth(truncated, wide);
  if (gap <= 0) return truncated;
  const left = Math.floor(gap / 2);
  const right = gap - left;
  return " ".repeat(left) + truncated + " ".repeat(right);
}

export function containsHangul(s: string): boolean {
  return HANGUL_RE.test(s);
}

/**
 * Ink가 내부 layout 계산에 쓰는 `string-width` 기본값(`ambiguousIsNarrow: true`)과
 * 동일한 폭을 반환. 행을 listW cols로 패딩할 때 이 값을 써야 Ink가 인식하는 점유 폭과
 * 정확히 일치해 좌·우 panel 경계가 깔끔하게 정렬된다.
 */
/**
 * 모든 한글 문자열을 NFC(정규형 결합)로 정규화. macOS 파일시스템은 한글 파일명을
 * NFD(분해형, ᄋ+ᅮ+ᆫ)로 저장하는데, `string-width`는 Jamo를 별도 codepoint로 합산해
 * 한 글자에 3~4 cols를 부여 — 실제 터미널은 결합 글리프 1개를 2 cols에 렌더링.
 * NFC로 정규화하면 "원"이 단일 codepoint(U+C6D0)가 되어 width=2로 정확히 측정됨.
 */
export function nfc(s: string): string {
  return s.normalize("NFC");
}

export function inkWidth(s: string): number {
  return stringWidth(nfc(s), { ambiguousIsNarrow: true });
}

export function inkPad(s: string, width: number): string {
  const norm = nfc(s);
  const gap = width - stringWidth(norm, { ambiguousIsNarrow: true });
  return gap > 0 ? norm + " ".repeat(gap) : norm;
}

export function inkTruncate(s: string, maxCols: number): string {
  const norm = nfc(s);
  if (maxCols <= 0) return "";
  if (stringWidth(norm, { ambiguousIsNarrow: true }) <= maxCols) return norm;
  const ellipsis = "..";
  const budget = maxCols - 2;
  if (budget <= 0) return ellipsis.slice(0, maxCols);
  let out = "";
  let used = 0;
  for (const ch of norm) {
    const w = stringWidth(ch, { ambiguousIsNarrow: true });
    if (used + w > budget) break;
    out += ch;
    used += w;
  }
  return out + ellipsis;
}

export interface ColumnSpec {
  min?: number;
  max?: number;
  weight?: number;
}

export function alignTable(
  rows: string[][],
  totalWidth: number,
  specs?: ColumnSpec[],
): string[] {
  if (rows.length === 0) return [];
  const ncol = Math.max(...rows.map((r) => r.length));
  const padded: string[][] = rows.map((r) => {
    const out = r.slice();
    while (out.length < ncol) out.push("");
    return out;
  });

  // Use Ink-compatible width measurement (ambiguousIsNarrow=true) for ALL
  // alignment math. Ink's flex layout uses string-width with that default,
  // and terminals with en_US LANG render ambiguous chars as 1 col — so this
  // gives accurate visual alignment in the most common environment.
  // CJK-locale terminals (which render ambiguous as 2 cols) will visually
  // see slack at row tails, but no overflow / no broken right-pane border.
  const measure = (s: string) => stringWidth(nfc(s), { ambiguousIsNarrow: true });

  // Normalize all cells to NFC up front — every downstream measurement and
  // padding step then operates on the same form Ink/terminal renders.
  for (const r of padded) for (let i = 0; i < r.length; i++) r[i] = nfc(r[i] ?? "");

  const natural: number[] = new Array(ncol).fill(0);
  for (const r of padded) {
    for (let i = 0; i < ncol; i++) {
      const w = measure(r[i] ?? "");
      if (w > natural[i]) natural[i] = w;
    }
  }

  const gap = 1;
  const totalGap = gap * (ncol - 1);
  const avail = Math.max(ncol, totalWidth - totalGap);

  const widths: number[] = new Array(ncol).fill(0);
  for (let i = 0; i < ncol; i++) {
    const spec = specs?.[i];
    const min = spec?.min ?? 1;
    const max = spec?.max ?? Infinity;
    widths[i] = Math.min(max, Math.max(min, natural[i] + 1));
  }

  let sum = widths.reduce((a, b) => a + b, 0);
  if (sum > avail) {
    let overflow = sum - avail;
    const order = widths
      .map((w, i) => ({ i, w, slack: w - (specs?.[i]?.min ?? 1) }))
      .sort((a, b) => b.slack - a.slack);
    for (const { i } of order) {
      if (overflow <= 0) break;
      const min = specs?.[i]?.min ?? 1;
      const cut = Math.min(overflow, widths[i] - min);
      widths[i] -= cut;
      overflow -= cut;
    }
  } else if (sum < avail) {
    const slack = avail - sum;
    const weights = widths.map((_, i) => specs?.[i]?.weight ?? 1);
    const totalW = weights.reduce((a, b) => a + b, 0);
    let distributed = 0;
    for (let i = 0; i < ncol; i++) {
      const add = i === ncol - 1
        ? slack - distributed
        : Math.floor((slack * weights[i]) / totalW);
      const max = specs?.[i]?.max ?? Infinity;
      const room = max - widths[i];
      const real = Math.max(0, Math.min(room, add));
      widths[i] += real;
      distributed += real;
    }
  }

  return padded.map((r) => {
    const cells: string[] = [];
    for (let i = 0; i < ncol; i++) {
      const cell = inkTruncate(r[i] ?? "", widths[i] - 1);
      const used = measure(cell);
      const padW = widths[i] - used;
      cells.push(cell + (padW > 0 ? " ".repeat(padW) : ""));
    }
    return cells.join(" ".repeat(gap));
  });
}
