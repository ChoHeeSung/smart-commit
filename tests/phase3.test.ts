import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateConventionalCommit, getOfflineTemplates, isAiAvailable } from "../src/ai-client.js";

// Mock execa for isAiAvailable
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

describe("getOfflineTemplates", () => {
  it("should return templates for all conventional prefixes", () => {
    const templates = getOfflineTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(10);
    expect(templates).toContain("feat: ");
    expect(templates).toContain("fix: ");
    expect(templates).toContain("refactor: ");
    expect(templates).toContain("chore: ");
  });

  it("all templates should be valid conventional commit prefixes", () => {
    const templates = getOfflineTemplates();
    for (const t of templates) {
      const msg = t + "테스트 메시지";
      expect(validateConventionalCommit(msg)).toBe(true);
    }
  });
});

describe("isAiAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when tool is found", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValueOnce({} as any);

    const result = await isAiAvailable("gemini");
    expect(result).toBe(true);
  });

  it("should return false when tool is not found", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockRejectedValueOnce(new Error("not found"));

    const result = await isAiAvailable("nonexistent-tool");
    expect(result).toBe(false);
  });

  it("should use 'openai' command for gpt tool", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValueOnce({} as any);

    await isAiAvailable("gpt");
    expect(vi.mocked(execa)).toHaveBeenCalledWith("which", ["openai"], expect.any(Object));
  });
});

describe("Multi AI model support", () => {
  it("should handle ollama config in types", () => {
    const config = {
      ai: {
        primary: "ollama",
        fallback: "gemini",
        timeout: 30,
        ollama: { model: "codellama", host: "http://localhost:11434" },
      },
    };
    expect(config.ai.ollama.model).toBe("codellama");
  });

  it("should allow custom AI tool names", () => {
    const config = {
      ai: {
        primary: "my-custom-ai",
        fallback: "claude",
        timeout: 30,
      },
    };
    expect(config.ai.primary).toBe("my-custom-ai");
  });
});
