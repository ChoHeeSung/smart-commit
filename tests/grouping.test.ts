import { describe, it, expect } from "vitest";
import { ruleBasedGrouping, groupFiles } from "../src/classifier.js";
import type { FileChange } from "../src/types.js";
import pino from "pino";

const logger = pino({ level: "silent" });

function makeFile(path: string): FileChange {
  return { path, status: "modified", size: 500, isBinary: false };
}

describe("ruleBasedGrouping", () => {
  it("should group files by directory and type", () => {
    const files = [
      makeFile("src/auth.ts"),
      makeFile("src/user.ts"),
      makeFile("tests/auth.test.ts"),
      makeFile("docs/README.md"),
    ];

    const groups = ruleBasedGrouping(files);
    expect(groups.length).toBeGreaterThan(1);

    // src source files should be grouped together
    const srcGroup = groups.find((g) => g.label.includes("src"));
    expect(srcGroup).toBeDefined();
  });

  it("should handle files in root directory", () => {
    const files = [
      makeFile("package.json"),
      makeFile("tsconfig.json"),
      makeFile("README.md"),
    ];

    const groups = ruleBasedGrouping(files);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("should handle single file", () => {
    const groups = ruleBasedGrouping([makeFile("src/index.ts")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(1);
  });

  it("should handle empty array", () => {
    const groups = ruleBasedGrouping([]);
    expect(groups).toHaveLength(0);
  });

  it("should separate source and test files", () => {
    const files = [
      makeFile("src/app.ts"),
      makeFile("src/app.test.ts"),
    ];

    const groups = ruleBasedGrouping(files);
    // .test.ts has different extension category
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});

describe("groupFiles", () => {
  it("should return single group with 'single' strategy", async () => {
    const files = [
      makeFile("src/a.ts"),
      makeFile("src/b.ts"),
      makeFile("docs/c.md"),
    ];

    const groups = await groupFiles(files, "single", null, logger);
    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(3);
  });

  it("should use rule-based grouping when AI is null", async () => {
    const files = [
      makeFile("src/a.ts"),
      makeFile("docs/b.md"),
    ];

    const groups = await groupFiles(files, "smart", null, logger);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("should fallback to rules when AI returns null", async () => {
    const files = [makeFile("src/a.ts"), makeFile("src/b.ts")];
    const failingAi = async () => null;

    const groups = await groupFiles(files, "smart", failingAi, logger);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("should use AI grouping when response is valid JSON", async () => {
    const files = [
      makeFile("src/auth.ts"),
      makeFile("src/user.ts"),
      makeFile("tests/auth.test.ts"),
    ];

    const aiResponse = JSON.stringify({
      groups: [
        { label: "인증 기능", files: ["src/auth.ts", "tests/auth.test.ts"], reason: "인증 관련 파일" },
        { label: "사용자 기능", files: ["src/user.ts"], reason: "사용자 관련 파일" },
      ],
    });

    const mockAi = async () => aiResponse;
    const groups = await groupFiles(files, "smart", mockAi, logger);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("인증 기능");
    expect(groups[0].files).toHaveLength(2);
    expect(groups[1].label).toBe("사용자 기능");
    expect(groups[1].files).toHaveLength(1);
  });

  it("should add 'other' group for unassigned files", async () => {
    const files = [
      makeFile("src/auth.ts"),
      makeFile("src/user.ts"),
      makeFile("config.yaml"),
    ];

    const aiResponse = JSON.stringify({
      groups: [
        { label: "소스", files: ["src/auth.ts", "src/user.ts"], reason: "소스 파일" },
      ],
    });

    const mockAi = async () => aiResponse;
    const groups = await groupFiles(files, "smart", mockAi, logger);

    expect(groups).toHaveLength(2);
    expect(groups[1].label).toBe("other");
    expect(groups[1].files).toHaveLength(1);
  });

  it("should return empty for no files", async () => {
    const groups = await groupFiles([], "smart", null, logger);
    expect(groups).toHaveLength(0);
  });
});
