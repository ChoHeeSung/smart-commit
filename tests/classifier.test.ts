import { describe, it, expect } from "vitest";
import { classifyFiles } from "../src/classifier.js";
import type { FileChange, SmartCommitConfig } from "../src/types.js";

const config: SmartCommitConfig = {
  ai: { primary: "gemini", fallback: "claude", timeout: 30 },
  safety: {
    maxFileSize: "10MB",
    blockedPatterns: ["*.env", ".env.*", "*.pem", "*.key", "credentials*", "*.sqlite"],
    warnPatterns: ["*.log", "*.csv", "package-lock.json"],
  },
  commit: { style: "conventional", language: "ko", maxDiffSize: 10000 },
  grouping: { strategy: "smart" },
};

function makeFile(path: string, size = 1000, isBinary = false): FileChange {
  return { path, status: "modified", size, isBinary };
}

describe("classifyFiles", () => {
  it("should block .env files", async () => {
    const files = [makeFile(".env"), makeFile("src/index.ts")];
    const result = await classifyFiles(files, config);
    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0].path).toBe(".env");
    expect(result.safe).toHaveLength(1);
  });

  it("should block .env.local variants", async () => {
    const files = [makeFile(".env.local"), makeFile(".env.production")];
    const result = await classifyFiles(files, config);
    expect(result.blocked).toHaveLength(2);
  });

  it("should block .pem and .key files", async () => {
    const files = [makeFile("cert.pem"), makeFile("private.key"), makeFile("app.ts")];
    const result = await classifyFiles(files, config);
    expect(result.blocked).toHaveLength(2);
    expect(result.safe).toHaveLength(1);
  });

  it("should block credentials files", async () => {
    const files = [makeFile("credentials.json"), makeFile("credentials-prod.yaml")];
    const result = await classifyFiles(files, config);
    expect(result.blocked).toHaveLength(2);
  });

  it("should block files exceeding maxFileSize", async () => {
    const largeFile = makeFile("large-data.bin", 20 * 1024 * 1024); // 20MB
    const result = await classifyFiles([largeFile], config);
    expect(result.blocked).toHaveLength(1);
  });

  it("should block binary files", async () => {
    const binary = makeFile("image.png", 500, true);
    const result = await classifyFiles([binary], config);
    expect(result.blocked).toHaveLength(1);
  });

  it("should block or warn on log files", async () => {
    const files = [makeFile("debug.log"), makeFile("src/app.ts")];
    const result = await classifyFiles(files, config);
    // *.log is in warnPatterns, but may also be in global gitignore (→ blocked)
    const logFile = [...result.warned, ...result.blocked].find((f) => f.path === "debug.log");
    expect(logFile).toBeDefined();
    expect(result.safe).toHaveLength(1);
  });

  it("should warn on package-lock.json", async () => {
    const files = [makeFile("package-lock.json")];
    const result = await classifyFiles(files, config);
    expect(result.warned).toHaveLength(1);
  });

  it("should pass safe files through", async () => {
    const files = [
      makeFile("src/index.ts"),
      makeFile("src/utils.ts"),
      makeFile("README.md"),
    ];
    const result = await classifyFiles(files, config);
    expect(result.blocked).toHaveLength(0);
    expect(result.warned).toHaveLength(0);
    expect(result.safe).toHaveLength(3);
  });

  it("should handle empty file list", async () => {
    const result = await classifyFiles([], config);
    expect(result.blocked).toHaveLength(0);
    expect(result.warned).toHaveLength(0);
    expect(result.safe).toHaveLength(0);
  });

  it("should classify mixed files correctly", async () => {
    const files = [
      makeFile(".env"),
      makeFile("debug.log"),
      makeFile("src/app.ts"),
      makeFile("cert.pem"),
      makeFile("package-lock.json"),
      makeFile("src/utils.ts"),
    ];
    const result = await classifyFiles(files, config);
    // .env, cert.pem always blocked; debug.log may be blocked by global gitignore
    expect(result.blocked.length).toBeGreaterThanOrEqual(2);
    // safe files: app.ts, utils.ts
    expect(result.safe).toHaveLength(2);
    // total should account for all 6 files
    expect(result.blocked.length + result.warned.length + result.safe.length).toBe(6);
  });
});
