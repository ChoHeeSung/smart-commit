import { execa } from "execa";
import type { SmartCommitConfig, AiTool } from "./types.js";
import type { Logger } from "pino";

const CONVENTIONAL_PREFIXES = [
  "feat", "fix", "refactor", "docs", "style", "test", "chore", "perf", "ci", "build", "revert",
];
const CONVENTIONAL_RE = new RegExp(`^(${CONVENTIONAL_PREFIXES.join("|")})(\\(.+\\))?!?:\\s.+`);

// ─── Offline templates ───

const OFFLINE_TEMPLATES = CONVENTIONAL_PREFIXES.map((prefix) => `${prefix}: `);

export function getOfflineTemplates(): string[] {
  return OFFLINE_TEMPLATES;
}

export async function isAiAvailable(tool: AiTool): Promise<boolean> {
  try {
    const cmd = tool === "gpt" ? "openai" : tool;
    await execa("which", [cmd], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export interface AiClient {
  generateCommitMessage(diff: string, language: string): Promise<string | null>;
  resolveConflict(localContent: string, remoteContent: string): Promise<string | null>;
  groupFiles(fileList: string): Promise<string | null>;
  summarizeDiff(diff: string): Promise<string>;
}

export function createAiClient(config: SmartCommitConfig, logger: Logger): AiClient {
  async function callWithFallback(prompt: string): Promise<string | null> {
    let result = await callAi(config.ai.primary, prompt, config.ai.timeout, logger, config);
    if (!result && config.ai.fallback !== config.ai.primary) {
      logger.warn({ fallback: config.ai.fallback }, "Primary AI failed, trying fallback");
      result = await callAi(config.ai.fallback, prompt, config.ai.timeout, logger, config);
    }
    return result;
  }

  return {
    async generateCommitMessage(diff, language) {
      const summarized = await this.summarizeDiff(diff);
      const prompt = buildCommitPrompt(summarized, language, config.commit.style);

      logger.info({ tool: config.ai.primary, diffLength: summarized.length }, "Requesting commit message");

      let result = await callWithFallback(prompt);

      if (result) {
        // Conventional commit validation + retry
        if (config.commit.style === "conventional" && !validateConventionalCommit(result)) {
          logger.warn({ message: result.split("\n")[0] }, "Invalid conventional commit, retrying");
          const retryPrompt = buildRetryPrompt(result, language);
          const retried = await callWithFallback(retryPrompt);
          if (retried && validateConventionalCommit(retried)) {
            result = retried;
          }
          // use original if retry also fails — better than nothing
        }

        // Strip markdown code blocks if AI wrapped it
        result = stripCodeBlocks(result);

        logger.info({ messageLength: result.length }, "Commit message generated");
      }

      return result;
    },

    async resolveConflict(localContent, remoteContent) {
      const prompt = buildConflictPrompt(localContent, remoteContent);
      return callWithFallback(prompt);
    },

    async groupFiles(fileList) {
      const { buildGroupingPrompt } = await import("./classifier.js");
      const prompt = buildGroupingPrompt(fileList);
      return callWithFallback(prompt);
    },

    async summarizeDiff(diff) {
      if (diff.length <= config.commit.maxDiffSize) {
        return diff;
      }

      // Smart truncation: stat header + most important hunks
      const statSection = extractDiffStat(diff);
      const hunks = extractKeyHunks(diff, config.commit.maxDiffSize - statSection.length - 200);

      const truncated = `${statSection}\n\n[주요 변경 내용 (전체 ${diff.length}자 중 핵심부만 추출)]\n${hunks}`;

      // If still too large, ask AI to summarize
      if (truncated.length > config.commit.maxDiffSize * 1.5) {
        logger.info("Diff too large, requesting AI summary");
        const summaryPrompt = buildDiffSummaryPrompt(truncated.slice(0, config.commit.maxDiffSize));
        const summary = await callWithFallback(summaryPrompt);
        return summary ?? truncated.slice(0, config.commit.maxDiffSize);
      }

      return truncated;
    },
  };
}

// ─── Conventional commit validation ───

export function validateConventionalCommit(message: string): boolean {
  const firstLine = message.split("\n")[0].trim();
  return CONVENTIONAL_RE.test(firstLine);
}

function stripCodeBlocks(text: string): string {
  return text
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/^```\s*$/gm, "")
    .trim();
}

// ─── Diff summarization ───

function extractDiffStat(diff: string): string {
  const lines = diff.split("\n");
  const statLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      statLines.push(line);
    } else if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      statLines.push(line);
    }
  }

  return statLines.join("\n");
}

function extractKeyHunks(diff: string, maxLength: number): string {
  const hunks: string[] = [];
  let currentHunk = "";
  let totalLength = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) {
      if (currentHunk && totalLength + currentHunk.length <= maxLength) {
        hunks.push(currentHunk);
        totalLength += currentHunk.length;
      }
      currentHunk = line + "\n";
    } else if (line.startsWith("+") || line.startsWith("-")) {
      // Prioritize actual changes over context
      currentHunk += line + "\n";
    }
  }

  // Don't forget the last hunk
  if (currentHunk && totalLength + currentHunk.length <= maxLength) {
    hunks.push(currentHunk);
  }

  return hunks.join("\n");
}

// ─── AI call ───

async function callAi(
  tool: AiTool,
  prompt: string,
  timeout: number,
  logger: Logger,
  config?: SmartCommitConfig,
): Promise<string | null> {
  try {
    const { command, args } = buildAiCommand(tool, prompt, config);

    const { stdout } = await execa(command, args, {
      timeout: timeout * 1000,
      stdin: "ignore",
    });

    const trimmed = stdout.trim();
    return trimmed || null;
  } catch (err) {
    logger.error({ tool, err }, "AI call failed");
    return null;
  }
}

function buildAiCommand(
  tool: AiTool,
  prompt: string,
  config?: SmartCommitConfig,
): { command: string; args: string[] } {
  switch (tool) {
    case "gemini":
      return { command: "gemini", args: [prompt] };
    case "claude":
      return { command: "claude", args: ["-p", prompt] };
    case "gpt":
      // OpenAI CLI: https://platform.openai.com/docs/guides/command-line
      return { command: "openai", args: ["api", "chat.completions.create", "-m", "gpt-4o", "-g", "user", prompt] };
    case "ollama": {
      const model = config?.ai?.ollama?.model ?? "llama3";
      return { command: "ollama", args: ["run", model, prompt] };
    }
    default:
      // Generic: treat tool name as command, pass prompt as first arg
      return { command: tool, args: [prompt] };
  }
}

// ─── Prompt builders ───

function buildCommitPrompt(diff: string, language: string, style: string): string {
  const langLabel = language === "ko" ? "한국어" : "English";
  const styleGuide =
    style === "conventional"
      ? `Conventional Commits 형식을 반드시 따르세요.
접두사는 다음 중 선택: ${CONVENTIONAL_PREFIXES.join(", ")}
형식: <접두사>(<범위>): <설명>  (범위는 선택사항)`
      : "";

  return `아래의 [Git Diff] 내용을 분석하여 Git Commit Message를 작성해줘.

[CRITICAL INSTRUCTION]
**결과는 무조건 '${langLabel}'로 작성되어야 합니다.**
${styleGuide}

[작성 예시]
feat(auth): 사용자 로그인 API 구현

- 로그인 요청 처리를 위한 컨트롤러 메서드 추가
- JWT 토큰 발급 로직 구현

[필수 규칙]
1. 언어: **100% ${langLabel}**로 작성할 것.
2. 형식:
   - 첫 줄: 변경 사항을 50자 이내로 요약 (제목)
   - 두 번째 줄: 빈 줄
   - 세 번째 줄부터: 변경된 상세 내용을 불릿 포인트(-)로 정리
3. 출력: 마크다운 코드 블록이나 부가 설명 없이, 오직 커밋 메시지 텍스트만 출력할 것.
4. 제한: 어떠한 도구(Functions/Tools)도 사용하지 말 것. 오직 텍스트만 생성하라.

[Git Diff]
${diff}`;
}

function buildRetryPrompt(invalidMessage: string, language: string): string {
  const langLabel = language === "ko" ? "한국어" : "English";
  return `아래 커밋 메시지가 Conventional Commits 형식에 맞지 않습니다. 수정해주세요.

[현재 메시지]
${invalidMessage}

[규칙]
- 첫 줄은 반드시 "${CONVENTIONAL_PREFIXES.join("|")}(<범위>): <설명>" 형식이어야 합니다.
- ${langLabel}로 작성하세요.
- 수정된 커밋 메시지만 출력하세요.`;
}

function buildConflictPrompt(localContent: string, remoteContent: string): string {
  return `아래에 Git 충돌이 발생한 파일의 [로컬 버전]과 [원격 버전]이 있습니다.
두 버전을 분석하여 **올바르게 병합된 최종 파일 내용**을 생성해주세요.

[필수 규칙]
1. 두 버전의 변경 사항을 모두 포함하여 병합할 것
2. 충돌 마커(<<<<<<, ======, >>>>>>)는 절대 포함하지 말 것
3. 코드의 논리적 일관성을 유지할 것
4. 출력은 **오직 병합된 파일 내용만** 출력할 것

[로컬 버전]
${localContent}

[원격 버전]
${remoteContent}`;
}

function buildDiffSummaryPrompt(diff: string): string {
  return `아래 Git Diff가 너무 큽니다. 핵심 변경 사항만 요약해주세요.

[규칙]
1. 어떤 파일에서 무엇이 변경되었는지 요약
2. 추가/수정/삭제된 주요 함수/클래스/변수 나열
3. diff 형식으로 출력 (+ / - 접두사 사용)
4. 500자 이내로 요약

[Diff]
${diff}`;
}
