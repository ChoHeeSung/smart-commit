import stringWidth from "string-width";

/** Display width (columns) of a string, CJK + emoji aware. */
export function displayWidth(s: string): number {
  return stringWidth(s);
}

/** Truncate to fit within `maxCols` display columns; append ellipsis when truncated. */
export function cwTruncate(s: string, maxCols: number): string {
  if (maxCols <= 0) return "";
  if (displayWidth(s) <= maxCols) return s;

  const ellipsis = "…";
  const budget = maxCols - displayWidth(ellipsis);
  if (budget <= 0) return ellipsis.slice(0, 1);

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
