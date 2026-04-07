import { minimatch } from "minimatch";
import { dirname, extname } from "node:path";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type {
  FileChange,
  SmartCommitConfig,
  SafetyResult,
  CommitGroup,
  AiGroupingResult,
} from "./types.js";
import type { Logger } from "pino";

const SIZE_UNITS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

// ─── Global gitignore cache ───

let globalIgnorePatterns: string[] | null = null;

export async function loadGlobalGitignore(): Promise<string[]> {
  if (globalIgnorePatterns !== null) return globalIgnorePatterns;

  globalIgnorePatterns = [];

  try {
    // Get global gitignore path from git config
    const gitignorePath = execFileSync("git", ["config", "--global", "core.excludesFile"], {
      timeout: 3000,
    }).toString().trim();

    if (gitignorePath) {
      const resolved = gitignorePath.startsWith("~")
        ? join(homedir(), gitignorePath.slice(1))
        : gitignorePath;

      const content = await readFile(resolved, "utf-8");
      globalIgnorePatterns = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
    }
  } catch {
    // No global gitignore configured — that's fine
  }

  return globalIgnorePatterns;
}

// ─── Safety classification ───

export async function classifyFiles(
  files: FileChange[],
  config: SmartCommitConfig,
): Promise<SafetyResult> {
  const maxBytes = parseSize(config.safety.maxFileSize);
  const globalPatterns = await loadGlobalGitignore();

  // Merge config blocked patterns with global gitignore
  const allBlockedPatterns = [...config.safety.blockedPatterns, ...globalPatterns];

  const blocked: FileChange[] = [];
  const warned: FileChange[] = [];
  const safe: FileChange[] = [];

  for (const file of files) {
    if (isBlocked(file, allBlockedPatterns, maxBytes)) {
      blocked.push(file);
    } else if (isWarned(file, config.safety.warnPatterns)) {
      warned.push(file);
    } else {
      safe.push(file);
    }
  }

  return { blocked, warned, safe };
}

// ─── Grouping ───

export async function groupFiles(
  files: FileChange[],
  strategy: SmartCommitConfig["grouping"]["strategy"],
  callAiForGrouping: ((fileList: string) => Promise<string | null>) | null,
  logger: Logger,
): Promise<CommitGroup[]> {
  if (files.length === 0) return [];

  if (strategy === "single") {
    return [{ label: "all", files, reason: "single strategy" }];
  }

  if (strategy === "smart" && callAiForGrouping) {
    const aiGroups = await tryAiGrouping(files, callAiForGrouping, logger);
    if (aiGroups) return aiGroups;
    logger.warn("AI grouping failed, falling back to rule-based grouping");
  }

  return ruleBasedGrouping(files);
}

async function tryAiGrouping(
  files: FileChange[],
  callAi: (fileList: string) => Promise<string | null>,
  logger: Logger,
): Promise<CommitGroup[] | null> {
  const fileList = files
    .map((f) => `${f.status.charAt(0).toUpperCase()} ${f.path}`)
    .join("\n");

  try {
    const response = await callAi(fileList);
    if (!response) return null;

    const parsed = parseAiGroupingResponse(response, files);
    if (parsed.length === 0) return null;

    logger.info({ groupCount: parsed.length }, "AI grouping succeeded");
    return parsed;
  } catch (err) {
    logger.error({ err }, "AI grouping parse error");
    return null;
  }
}

function parseAiGroupingResponse(
  response: string,
  allFiles: FileChange[],
): CommitGroup[] {
  // Try JSON parse first
  try {
    const cleaned = response.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed: AiGroupingResult = JSON.parse(cleaned);

    if (!parsed.groups || !Array.isArray(parsed.groups)) return [];

    const fileMap = new Map(allFiles.map((f) => [f.path, f]));
    const usedFiles = new Set<string>();
    const groups: CommitGroup[] = [];

    for (const g of parsed.groups) {
      const matchedFiles = g.files
        .map((path) => fileMap.get(path))
        .filter((f): f is FileChange => f !== undefined && !usedFiles.has(f.path));

      for (const f of matchedFiles) usedFiles.add(f.path);

      if (matchedFiles.length > 0) {
        groups.push({
          label: g.label,
          files: matchedFiles,
          reason: g.reason,
        });
      }
    }

    // remaining files that AI didn't assign
    const remaining = allFiles.filter((f) => !usedFiles.has(f.path));
    if (remaining.length > 0) {
      groups.push({
        label: "other",
        files: remaining,
        reason: "AI가 분류하지 않은 나머지 파일",
      });
    }

    return groups;
  } catch {
    return [];
  }
}

// ─── Rule-based fallback grouping ───

export function ruleBasedGrouping(files: FileChange[]): CommitGroup[] {
  const dirMap = new Map<string, FileChange[]>();

  for (const file of files) {
    const dir = dirname(file.path);
    const ext = extname(file.path);

    // Group by top-level directory + extension category
    const topDir = dir.split("/")[0] || ".";
    const category = getCategory(ext);
    const key = `${topDir}/${category}`;

    if (!dirMap.has(key)) dirMap.set(key, []);
    dirMap.get(key)!.push(file);
  }

  const groups: CommitGroup[] = [];
  for (const [key, groupFiles] of dirMap) {
    groups.push({
      label: key,
      files: groupFiles,
      reason: `디렉토리/유형 기반 그룹핑: ${key}`,
    });
  }

  return groups;
}

function getCategory(ext: string): string {
  const categories: Record<string, string[]> = {
    source: [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".kt", ".swift", ".c", ".cpp", ".h"],
    style: [".css", ".scss", ".sass", ".less", ".styl"],
    markup: [".html", ".xml", ".svg", ".vue", ".svelte"],
    config: [".json", ".yaml", ".yml", ".toml", ".ini", ".env", ".conf"],
    docs: [".md", ".txt", ".rst", ".adoc"],
    test: [".test.ts", ".test.js", ".spec.ts", ".spec.js", ".test.py"],
  };

  for (const [category, exts] of Object.entries(categories)) {
    if (exts.includes(ext)) return category;
  }
  return "other";
}

// ─── AI grouping prompt builder ───

export function buildGroupingPrompt(fileList: string): string {
  return `아래 Git 변경 파일 목록을 분석하여 의미 있는 커밋 단위로 그룹핑해주세요.

[규칙]
1. 관련된 파일끼리 묶어 하나의 커밋 그룹으로 만들어주세요.
2. 각 그룹에 짧은 라벨(한국어)과 이유를 붙여주세요.
3. 반드시 아래 JSON 형식으로만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.

[출력 형식]
{"groups":[{"label":"그룹명","files":["파일경로1","파일경로2"],"reason":"그룹핑 이유"}]}

[변경 파일 목록]
${fileList}`;
}

// ─── Utilities ───

function isBlocked(
  file: FileChange,
  patterns: string[],
  maxBytes: number,
): boolean {
  if (file.size > maxBytes) return true;
  if (file.isBinary) return true;
  return matchesAny(file.path, patterns);
}

function isWarned(file: FileChange, patterns: string[]): boolean {
  return matchesAny(file.path, patterns);
}

function matchesAny(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) =>
    minimatch(filePath, pattern, { dot: true, matchBase: true }),
  );
}

function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
  if (!match) return 10 * 1024 * 1024; // default 10MB
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  return value * (SIZE_UNITS[unit] ?? 1);
}
