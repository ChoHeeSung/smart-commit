import { describe, it, expect } from "vitest";
import { displayWidth, cellPad, alignTable, cwTruncate } from "../src/ui/width.js";

describe("CJK alignment", () => {
  it("Hangul characters render as 2 cols regardless of locale", () => {
    expect(displayWidth("가")).toBe(2);
    expect(displayWidth("한글")).toBe(4);
    expect(displayWidth("P_경기남부")).toBe(10); // P=1 _=1 + 한글 4자(8) = 10
  });

  it("ASCII width unchanged", () => {
    expect(displayWidth("hello")).toBe(5);
    expect(displayWidth("smart-commit")).toBe(12);
  });

  it("cellPad fills to exact width with mixed text", () => {
    const pad1 = cellPad("hello", 10);
    const pad2 = cellPad("한글", 10);
    expect(displayWidth(pad1)).toBe(10);
    expect(displayWidth(pad2)).toBe(10);
  });

  it("cwTruncate uses ASCII '..' (avoids ambiguous '…')", () => {
    const truncated = cwTruncate("hello world this is long", 10);
    expect(truncated.endsWith("..")).toBe(true);
    expect(truncated.includes("…")).toBe(false);
    expect(displayWidth(truncated)).toBeLessThanOrEqual(10);
  });

  it("cwTruncate respects Hangul boundary (no orphan half-char)", () => {
    const t = cwTruncate("P_경기남부_유지관리", 8);
    expect(displayWidth(t)).toBeLessThanOrEqual(8);
  });

  it("alignTable produces rows with identical total width", () => {
    const rows = [
      ["mtx-front-end", "main", "5 files"],
      ["P_경기남부", "develop", "12 files"],
      ["leeloo-homepage", "main", "1 file"],
    ];
    const out = alignTable(rows, 50);
    const widths = out.map((r) => displayWidth(r));
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBeLessThanOrEqual(50);
  });

  it("alignTable handles row with all Korean cells", () => {
    const rows = [
      ["레포지토리", "브랜치", "변경"],
      ["P_경기남부_유지관리", "main", "3 files"],
    ];
    const out = alignTable(rows, 60);
    expect(displayWidth(out[0])).toBe(displayWidth(out[1]));
  });

  it("alignTable shrinks cols when natural width exceeds totalWidth", () => {
    const rows = [
      ["a-very-very-long-repo-name-that-overflows", "feature/long-branch-name", "10 files"],
    ];
    const out = alignTable(rows, 30);
    expect(displayWidth(out[0])).toBeLessThanOrEqual(30);
  });
});
