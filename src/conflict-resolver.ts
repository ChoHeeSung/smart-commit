import { simpleGit } from "simple-git";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiClient } from "./ai-client.js";
import type { UI } from "./ui.js";
import type { Logger } from "pino";

interface ConflictBlock {
  startLine: number;
  endLine: number;
  ours: string;
  theirs: string;
  context: { before: string; after: string };
}

export async function resolveConflicts(
  repoPath: string,
  ai: AiClient,
  ui: UI,
  logger: Logger,
): Promise<boolean> {
  const git = simpleGit(repoPath);
  const status = await git.status();
  const conflictFiles = status.conflicted;

  if (conflictFiles.length === 0) {
    return true;
  }

  ui.showMessage(`충돌 파일 ${conflictFiles.length}개 발견`, "warn");
  let allResolved = true;

  for (const filePath of conflictFiles) {
    const fullPath = join(repoPath, filePath);
    ui.showMessage(`충돌 해결 중: ${filePath}`, "info");

    try {
      const content = await readFile(fullPath, "utf-8");
      const blocks = parseConflictBlocks(content);

      if (blocks.length === 0) {
        ui.showMessage(`${filePath}: 충돌 마커를 찾을 수 없음`, "warn");
        allResolved = false;
        continue;
      }

      ui.showMessage(`${filePath}: ${blocks.length}개 충돌 블록 발견`, "info");

      let resolved = content;
      let resolvedCount = 0;

      // Resolve each conflict block individually (reverse order to preserve line numbers)
      for (let i = blocks.length - 1; i >= 0; i--) {
        const block = blocks[i];
        const merged = await ai.resolveConflict(
          buildBlockContext(block, "ours"),
          buildBlockContext(block, "theirs"),
        );

        if (!merged) {
          ui.showMessage(`${filePath} 블록 ${i + 1}: AI 병합 실패`, "error");
          allResolved = false;
          continue;
        }

        // Show block-level preview
        ui.showMessage(`블록 ${i + 1}/${blocks.length} 미리보기:`, "info");
        ui.showMessage(`  ours:   ${block.ours.split("\n")[0].trim()}...`, "info");
        ui.showMessage(`  theirs: ${block.theirs.split("\n")[0].trim()}...`, "info");
        ui.showMessage(`  merged: ${merged.split("\n")[0].trim()}...`, "info");

        const confirmed = await ui.confirmWarned(
          { path: repoPath, branch: "", status: "merging", files: [], unpushedCommits: 0, hasRemote: false },
          [{ path: `${filePath} (블록 ${i + 1})`, status: "modified", size: 0, isBinary: false }],
        );

        if (confirmed) {
          resolved = replaceConflictBlock(resolved, block, merged);
          resolvedCount++;
        }
      }

      if (resolvedCount === blocks.length) {
        // All blocks resolved — verify no remaining markers
        if (!hasConflictMarkers(resolved)) {
          await writeFile(fullPath, resolved, "utf-8");
          await git.add(filePath);
          ui.showMessage(`${filePath}: 모든 충돌 해결 완료 (${blocks.length}블록)`, "success");
          logger.info({ file: filePath, blocks: blocks.length }, "All conflicts resolved");
        } else {
          ui.showMessage(`${filePath}: 충돌 마커가 남아있음 — 수동 확인 필요`, "warn");
          allResolved = false;
        }
      } else {
        ui.showMessage(
          `${filePath}: ${resolvedCount}/${blocks.length} 블록 해결됨 — 나머지는 수동 처리 필요`,
          "warn",
        );
        allResolved = false;
      }
    } catch (err) {
      logger.error({ file: filePath, err }, "Conflict resolution failed");
      ui.showMessage(`${filePath}: 충돌 해결 실패`, "error");
      allResolved = false;
    }
  }

  return allResolved;
}

// ─── Conflict block parser ───

function parseConflictBlocks(content: string): ConflictBlock[] {
  const lines = content.split("\n");
  const blocks: ConflictBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      const startLine = i;
      let oursLines: string[] = [];
      let theirsLines: string[] = [];
      let inTheirs = false;

      i++;
      while (i < lines.length) {
        if (lines[i].startsWith("=======")) {
          inTheirs = true;
          i++;
          continue;
        }
        if (lines[i].startsWith(">>>>>>>")) {
          const endLine = i;

          // Gather context (up to 3 lines before/after)
          const beforeStart = Math.max(0, startLine - 3);
          const afterEnd = Math.min(lines.length - 1, endLine + 3);
          const before = lines.slice(beforeStart, startLine).join("\n");
          const after = lines.slice(endLine + 1, afterEnd + 1).join("\n");

          blocks.push({
            startLine,
            endLine,
            ours: oursLines.join("\n"),
            theirs: theirsLines.join("\n"),
            context: { before, after },
          });
          break;
        }

        if (inTheirs) {
          theirsLines.push(lines[i]);
        } else {
          oursLines.push(lines[i]);
        }
        i++;
      }
    }
    i++;
  }

  return blocks;
}

function buildBlockContext(block: ConflictBlock, side: "ours" | "theirs"): string {
  const content = side === "ours" ? block.ours : block.theirs;
  return `[주변 코드 (앞)]
${block.context.before}

[${side === "ours" ? "로컬" : "원격"} 변경]
${content}

[주변 코드 (뒤)]
${block.context.after}`;
}

function replaceConflictBlock(content: string, block: ConflictBlock, replacement: string): string {
  const lines = content.split("\n");
  const before = lines.slice(0, block.startLine);
  const after = lines.slice(block.endLine + 1);
  return [...before, replacement, ...after].join("\n");
}

function hasConflictMarkers(content: string): boolean {
  return content.includes("<<<<<<<") || content.includes(">>>>>>>") || content.includes("=======");
}
