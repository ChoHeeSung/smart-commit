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
  it("should block .env files", () => {
    const files = [makeFile(".env"), makeFile("src/index.ts")];
    const result = classifyFiles(files, config);
    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0].path).toBe(".env");
    expect(result.safe).toHaveLength(1);
  });

  it("should block .env.local variants", () => {
    const files = [makeFile(".env.local"), makeFile(".env.production")];
    const result = classifyFiles(files, config);
    expect(result.blocked).toHaveLength(2);
  });

  it("should block .pem and .key files", () => {
    const files = [makeFile("cert.pem"), makeFile("private.key"), makeFile("app.ts")];
    const result = classifyFiles(files, config);
    expect(result.blocked).toHaveLength(2);
    expect(result.safe).toHaveLength(1);
  });

  it("should block credentials files", () => {
    const files = [makeFile("credentials.json"), makeFile("credentials-prod.yaml")];
    const result = classifyFiles(files, config);
    expect(result.blocked).toHaveLength(2);
  });

  it("should block files exceeding maxFileSize", () => {
    const largeFile = makeFile("large-data.bin", 20 * 1024 * 1024); // 20MB
    const result = classifyFiles([largeFile], config);
    expect(result.blocked).toHaveLength(1);
  });

  it("should block binary files", () => {
    const binary = makeFile("image.png", 500, true);
    const result = classifyFiles([binary], config);
    expect(result.blocked).toHaveLength(1);
  });

  it("should warn on log files", () => {
    const files = [makeFile("debug.log"), makeFile("src/app.ts")];
    const result = classifyFiles(files, config);
    expect(result.warned).toHaveLength(1);
    expect(result.warned[0].path).toBe("debug.log");
    expect(result.safe).toHaveLength(1);
  });

  it("should warn on package-lock.json", () => {
    const files = [makeFile("package-lock.json")];
    const result = classifyFiles(files, config);
    expect(result.warned).toHaveLength(1);
  });

  it("should pass safe files through", () => {
    const files = [
      makeFile("src/index.ts"),
      makeFile("src/utils.ts"),
      makeFile("README.md"),
    ];
    const result = classifyFiles(files, config);
    expect(result.blocked).toHaveLength(0);
    expect(result.warned).toHaveLength(0);
    expect(result.safe).toHaveLength(3);
  });

  it("should handle empty file list", () => {
    const result = classifyFiles([], config);
    expect(result.blocked).toHaveLength(0);
    expect(result.warned).toHaveLength(0);
    expect(result.safe).toHaveLength(0);
  });

  it("should classify mixed files correctly", () => {
    const files = [
      makeFile(".env"),
      makeFile("debug.log"),
      makeFile("src/app.ts"),
      makeFile("cert.pem"),
      makeFile("package-lock.json"),
      makeFile("src/utils.ts"),
    ];
    const result = classifyFiles(files, config);
    expect(result.blocked).toHaveLength(2); // .env, cert.pem
    expect(result.warned).toHaveLength(2); // debug.log, package-lock.json
    expect(result.safe).toHaveLength(2); // app.ts, utils.ts
  });
});
