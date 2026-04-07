import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createRequire } from "node:module";
import { simpleGit } from "simple-git";
import { loadConfig } from "./config.js";

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require("../package.json");
import { scanRepositories } from "./scanner.js";
import { classifyFiles, groupFiles } from "./classifier.js";
import { createAiClient, isAiAvailable, getOfflineTemplates } from "./ai-client.js";
import { createLogger } from "./logger.js";
import type { RepoState } from "./types.js";

const logger = createLogger();

// Noop UI for MCP (no terminal interaction)
const noopUI = {
  showHeader: () => {},
  showProgress: () => {},
  showRepoTable: () => {},
  showBlocked: () => {},
  confirmWarned: async () => true,
  showCommitPreview: () => {},
  promptAction: async () => "push" as const,
  promptOfflineTemplate: async (t: string[]) => t[0] + "auto-commit",
  promptInput: async () => "",
  showMessage: () => {},
  showComplete: () => {},
  cleanup: () => {},
};

const server = new McpServer({
  name: "smart-commit",
  version: PKG_VERSION,
});

// ─── Tool: scan ───

server.tool(
  "scan",
  "현재 디렉토리 하위의 Git 저장소를 스캔하여 변경 사항을 확인합니다",
  {
    path: z.string().optional().describe("스캔할 디렉토리 경로 (기본: 현재 디렉토리)"),
  },
  async ({ path }) => {
    const scanPath = path || process.cwd();
    const repos = await scanRepositories(scanPath, noopUI, logger);

    const summary = repos.map((r) => ({
      path: r.path,
      branch: r.branch,
      status: r.status,
      files: r.files.length,
      unpushedCommits: r.unpushedCommits,
    }));

    const dirty = repos.filter((r) => r.status === "dirty");
    const text = [
      `총 ${repos.length}개 저장소 스캔 완료`,
      `변경됨: ${dirty.length}개`,
      "",
      ...summary.map(
        (r) =>
          `${r.status === "dirty" ? "📝" : "✅"} ${r.path} [${r.branch}] — ${r.files > 0 ? `${r.files} files` : r.status}`,
      ),
    ].join("\n");

    return { content: [{ type: "text", text }] };
  },
);

// ─── Tool: analyze ───

server.tool(
  "analyze",
  "특정 저장소의 변경 파일을 분석하고 안전 필터를 적용합니다",
  {
    repoPath: z.string().describe("분석할 Git 저장소 경로"),
  },
  async ({ repoPath }) => {
    const config = await loadConfig();
    const git = simpleGit(repoPath);
    const status = await git.status();

    const files = status.files.map((f) => ({
      path: f.path,
      status: f.working_dir === "?" ? "untracked" as const : "modified" as const,
      size: 0,
      isBinary: false,
    }));

    const safety = await classifyFiles(files, config);

    const text = [
      `저장소: ${repoPath}`,
      `브랜치: ${status.current}`,
      "",
      `✖ 차단: ${safety.blocked.length}개`,
      ...safety.blocked.map((f) => `  - ${f.path}`),
      "",
      `⚠ 경고: ${safety.warned.length}개`,
      ...safety.warned.map((f) => `  - ${f.path}`),
      "",
      `✅ 안전: ${safety.safe.length}개`,
      ...safety.safe.map((f) => `  - ${f.path}`),
    ].join("\n");

    return { content: [{ type: "text", text }] };
  },
);

// ─── Tool: generate-message ───

server.tool(
  "generate-message",
  "AI를 사용하여 Git diff 기반 커밋 메시지를 생성합니다",
  {
    repoPath: z.string().describe("Git 저장소 경로"),
    files: z.array(z.string()).optional().describe("특정 파일만 대상으로 지정 (기본: 전체)"),
  },
  async ({ repoPath, files }) => {
    const config = await loadConfig();
    const ai = createAiClient(config, logger);
    const git = simpleGit(repoPath);

    const targetFiles = files ?? (await git.status()).files.map((f) => f.path);
    await git.add(targetFiles);
    const diff = await git.diff(["--cached", "--", ...targetFiles]);

    if (!diff.trim()) {
      return { content: [{ type: "text", text: "변경 사항이 없습니다." }] };
    }

    const summarized = await ai.summarizeDiff(diff);
    const message = await ai.generateCommitMessage(summarized, config.commit.language);

    if (!message) {
      return { content: [{ type: "text", text: "커밋 메시지 생성 실패. AI 도구를 확인하세요." }] };
    }

    return { content: [{ type: "text", text: message }] };
  },
);

// ─── Tool: commit ───

server.tool(
  "commit",
  "변경 사항을 커밋합니다 (AI 메시지 자동 생성 또는 직접 지정)",
  {
    repoPath: z.string().describe("Git 저장소 경로"),
    message: z.string().optional().describe("커밋 메시지 (미지정 시 AI 자동 생성)"),
    push: z.boolean().optional().describe("커밋 후 푸시 여부 (기본: false)"),
  },
  async ({ repoPath, message, push }) => {
    const config = await loadConfig();
    const ai = createAiClient(config, logger);
    const git = simpleGit(repoPath);

    const status = await git.status();
    if (status.files.length === 0) {
      return { content: [{ type: "text", text: "커밋할 변경 사항이 없습니다." }] };
    }

    const files = status.files.map((f) => f.path);
    const safety = await classifyFiles(
      status.files.map((f) => ({
        path: f.path,
        status: "modified" as const,
        size: 0,
        isBinary: false,
      })),
      config,
    );

    const safeFiles = safety.safe.map((f) => f.path);
    if (safeFiles.length === 0) {
      return {
        content: [{
          type: "text",
          text: `안전한 파일이 없습니다. 차단: ${safety.blocked.map((f) => f.path).join(", ")}`,
        }],
      };
    }

    // Generate or use provided message
    let commitMsg = message;
    if (!commitMsg) {
      await git.add(safeFiles);
      const diff = await git.diff(["--cached", "--", ...safeFiles]);
      const summarized = await ai.summarizeDiff(diff);
      commitMsg = await ai.generateCommitMessage(summarized, config.commit.language) ?? undefined;
    }

    if (!commitMsg) {
      return { content: [{ type: "text", text: "커밋 메시지 생성 실패." }] };
    }

    // Commit
    await git.add(safeFiles);
    const commitResult = await git.commit(commitMsg);

    const lines = [
      `커밋 완료: ${commitResult.commit}`,
      `메시지: ${commitMsg.split("\n")[0]}`,
      `파일: ${safeFiles.length}개`,
    ];

    if (safety.blocked.length > 0) {
      lines.push(`차단됨: ${safety.blocked.map((f) => f.path).join(", ")}`);
    }

    // Push if requested
    if (push) {
      try {
        await git.push();
        lines.push("푸시 완료!");
      } catch {
        try {
          const branch = status.current ?? "main";
          await git.push(["--set-upstream", "origin", branch]);
          lines.push("푸시 완료! (upstream 설정됨)");
        } catch (pushErr) {
          lines.push(`푸시 실패: ${pushErr}`);
        }
      }
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ─── Tool: config ───

server.tool(
  "config",
  "현재 smart-commit 설정을 확인합니다",
  {},
  async () => {
    const config = await loadConfig();
    const primaryAvail = await isAiAvailable(config.ai.primary);
    const fallbackAvail = await isAiAvailable(config.ai.fallback);

    const text = [
      "smart-commit 설정",
      "",
      `AI Primary: ${config.ai.primary} (${primaryAvail ? "✅ 사용 가능" : "❌ 미설치"})`,
      `AI Fallback: ${config.ai.fallback} (${fallbackAvail ? "✅ 사용 가능" : "❌ 미설치"})`,
      `AI Timeout: ${config.ai.timeout}초`,
      "",
      `Commit Style: ${config.commit.style}`,
      `Language: ${config.commit.language}`,
      `Max Diff Size: ${config.commit.maxDiffSize}`,
      "",
      `Grouping: ${config.grouping.strategy}`,
      "",
      `Blocked Patterns: ${config.safety.blockedPatterns.join(", ")}`,
      `Warn Patterns: ${config.safety.warnPatterns.join(", ")}`,
      `Max File Size: ${config.safety.maxFileSize}`,
    ].join("\n");

    return { content: [{ type: "text", text }] };
  },
);

// ─── Start server ───

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
