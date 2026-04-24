import stringWidth from "string-width";
import { detectLocale } from "../i18n.js";

/**
 * East Asian Ambiguous 문자(`…` `●` `○` `▸` `·` `—` 브라유 등)는 CJK locale 터미널에서
 * 2 cols, 그 외에선 1 col로 렌더된다. i18n locale(또는 $LANG)을 기준으로 실제 렌더와
 * 일치시킨다. `--lang ko` 플래그가 있으면 동일하게 반영.
 */
function isEastAsianContext(): boolean {
  if (detectLocale() === "ko") return true;
  const lang = process.env.LANG ?? process.env.LC_ALL ?? process.env.LC_CTYPE ?? "";
  return /^(ko|ja|zh)/i.test(lang);
}

/** Display width (columns) of a string, CJK + emoji + ambiguous aware. */
export function displayWidth(s: string): number {
  return stringWidth(s, { ambiguousIsNarrow: !isEastAsianContext() });
}

/** Truncate to fit within `maxCols` display columns; append ellipsis when truncated. */
export function cwTruncate(s: string, maxCols: number): string {
  if (maxCols <= 0) return "";
  if (displayWidth(s) <= maxCols) return s;

  // ASCII ".." — East Asian Ambiguous인 "…"을 쓰면 터미널/locale 조합에 따라
  // 1~2 cols로 갈려 정렬이 어긋남. ASCII 2 chars는 어느 환경에서든 2 cols 고정.
  const ellipsis = "..";
  const budget = maxCols - 2;
  if (budget <= 0) return ellipsis.slice(0, maxCols);

  let out = "";
  let used = 0;
  for (const ch of s) {
    const w = displayWidth(ch);
    if (used + w > budget) break;
    out += ch;
    used += w;
  }
  return out + ellipsis;
}

/** Right-pad to exactly `targetCols` display columns (truncate if wider). */
export function cwPad(s: string, targetCols: number): string {
  const truncated = cwTruncate(s, targetCols);
  const gap = targetCols - displayWidth(truncated);
  return gap > 0 ? truncated + " ".repeat(gap) : truncated;
}

/** Table-cell pad: truncate to `width-1` then pad to `width` (guarantees 1-col gap). */
export function cellPad(s: string, width: number): string {
  if (width <= 1) return cwPad(s, width);
  return cwPad(cwTruncate(s, width - 1), width);
}

/** Center-pad to `targetCols` (truncate if wider). */
export function cwCenter(s: string, targetCols: number): string {
  const truncated = cwTruncate(s, targetCols);
  const gap = targetCols - displayWidth(truncated);
  if (gap <= 0) return truncated;
  const left = Math.floor(gap / 2);
  const right = gap - left;
  return " ".repeat(left) + truncated + " ".repeat(right);
}
