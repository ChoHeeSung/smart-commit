import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAiClient } from "../src/ai-client.js";
import type { SmartCommitConfig } from "../src/types.js";
import pino from "pino";

// Mock execa
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

const logger = pino({ level: "silent" });

const config: SmartCommitConfig = {
  ai: { primary: "gemini", fallback: "claude", timeout: 30 },
  safety: {
    maxFileSize: "10MB",
    blockedPatterns: [],
    warnPatterns: [],
  },
  commit: { style: "conventional", language: "ko", maxDiffSize: 10000 },
  grouping: { strategy: "smart" },
};

describe("createAiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create an ai client with generateCommitMessage method", () => {
    const client = createAiClient(config, logger);
    expect(client.generateCommitMessage).toBeDefined();
    expect(typeof client.generateCommitMessage).toBe("function");
  });

  it("should create an ai client with resolveConflict method", () => {
    const client = createAiClient(config, logger);
    expect(client.resolveConflict).toBeDefined();
    expect(typeof client.resolveConflict).toBe("function");
  });

  it("should call primary AI tool first", async () => {
    const { execa } = await import("execa");
    const mockExeca = vi.mocked(execa);
    mockExeca.mockResolvedValueOnce({
      stdout: "feat: 테스트 커밋 메시지",
    } as any);

    const client = createAiClient(config, logger);
    const result = await client.generateCommitMessage("diff content", "ko");

    expect(result).toBe("feat: 테스트 커밋 메시지");
    expect(mockExeca).toHaveBeenCalledWith(
      "gemini",
      expect.any(Array),
      expect.objectContaining({ timeout: 30000 }),
    );
  });

  it("should fallback to secondary AI when primary fails", async () => {
    const { execa } = await import("execa");
    const mockExeca = vi.mocked(execa);
    mockExeca
      .mockRejectedValueOnce(new Error("gemini not found"))
      .mockResolvedValueOnce({
        stdout: "feat: 폴백 메시지",
      } as any);

    const client = createAiClient(config, logger);
    const result = await client.generateCommitMessage("diff content", "ko");

    expect(result).toBe("feat: 폴백 메시지");
    expect(mockExeca).toHaveBeenCalledTimes(2);
    expect(mockExeca).toHaveBeenNthCalledWith(
      2,
      "claude",
      expect.any(Array),
      expect.any(Object),
    );
  });

  it("should return null when both AI tools fail", async () => {
    const { execa } = await import("execa");
    const mockExeca = vi.mocked(execa);
    mockExeca
      .mockRejectedValueOnce(new Error("gemini fail"))
      .mockRejectedValueOnce(new Error("claude fail"));

    const client = createAiClient(config, logger);
    const result = await client.generateCommitMessage("diff content", "ko");

    expect(result).toBeNull();
  });

  it("should return null for empty AI response", async () => {
    const { execa } = await import("execa");
    const mockExeca = vi.mocked(execa);
    mockExeca.mockResolvedValueOnce({ stdout: "  " } as any);

    const client = createAiClient(config, logger);
    const result = await client.generateCommitMessage("diff", "ko");

    expect(result).toBeNull();
  });

  it("should truncate diff to maxDiffSize", async () => {
    const { execa } = await import("execa");
    const mockExeca = vi.mocked(execa);
    mockExeca.mockResolvedValueOnce({ stdout: "feat: msg" } as any);

    const longDiff = "a".repeat(20000);
    const client = createAiClient(config, logger);
    await client.generateCommitMessage(longDiff, "ko");

    const calledPrompt = mockExeca.mock.calls[0][1][0] as string;
    // prompt should not contain the full 20000 chars of diff
    expect(calledPrompt.length).toBeLessThan(20000);
  });

  it("should not fallback when primary and fallback are same", async () => {
    const sameConfig = {
      ...config,
      ai: { primary: "gemini" as const, fallback: "gemini" as const, timeout: 30 },
    };

    const { execa } = await import("execa");
    const mockExeca = vi.mocked(execa);
    mockExeca.mockRejectedValueOnce(new Error("fail"));

    const client = createAiClient(sameConfig, logger);
    const result = await client.generateCommitMessage("diff", "ko");

    expect(result).toBeNull();
    expect(mockExeca).toHaveBeenCalledTimes(1);
  });
});
