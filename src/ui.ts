import termkit from "terminal-kit";
import type { RepoState, FileChange, SmartCommitConfig, UserAction } from "./types.js";

const term = termkit.terminal;

export interface UI {
  showHeader(config: SmartCommitConfig, version?: string): void;
  showProgress(label: string, current: number, total: number): void;
  showRepoTable(repos: RepoState[]): void;
  showBlocked(repo: RepoState, files: FileChange[]): void;
  confirmWarned(repo: RepoState, files: FileChange[]): Promise<boolean>;
  showCommitPreview(repo: RepoState, message: string, files: FileChange[]): void;
  promptAction(): Promise<UserAction>;
  promptOfflineTemplate(templates: string[]): Promise<string>;
  promptInput(label: string): Promise<string>;
  showMessage(msg: string, level: "info" | "success" | "warn" | "error"): void;
  showComplete(): void;
  cleanup(): void;
}

export function createUI(): UI {
  let progressBar: termkit.Terminal.ProgressBarController | null = null;

  return {
    showHeader(config, version) {
      term.clear();
      term.bold.cyan(`\n  Smart Commit v${version ?? "unknown"}\n`);
      term.gray(`  AI: ${config.ai.primary} (fallback: ${config.ai.fallback})\n`);
      term.gray(`  Style: ${config.commit.style} | Language: ${config.commit.language}\n`);
      term("\n");
    },

    showProgress(label, current, total) {
      if (!progressBar) {
        term("  ");
        progressBar = term.progressBar({
          width: 50,
          title: label,
          percent: true,
        });
      }
      progressBar.update({ progress: current / total, title: label });

      if (current >= total) {
        term("\n");
        progressBar = null;
      }
    },

    showRepoTable(repos) {
      term("\n");
      term.gray("  #  Repository                    Branch              Changes    Status\n");
      term.gray("  ── ─────────────────────────────  ──────────────────  ─────────  ──────────\n");

      repos.forEach((repo, i) => {
        const shortPath = truncate(repo.path.split("/").slice(-2).join("/"), 30);
        const branch = truncate(repo.branch, 18);
        const changes =
          repo.files.length > 0
            ? `${repo.files.length} files`
            : repo.unpushedCommits > 0
              ? `${repo.unpushedCommits} unpushed`
              : "-";
        const status = statusIcon(repo.status);
        const num = String(i + 1).padStart(2);

        const line = `  ${num} ${padEnd(shortPath, 32)}${padEnd(branch, 20)}${padEnd(changes, 11)}${status}\n`;

        if (repo.status === "dirty") {
          term.yellow(line);
        } else {
          term(line);
        }
      });

      term("\n");
    },

    showBlocked(repo, files) {
      const shortPath = repo.path.split("/").slice(-1)[0];
      term.red(`  ✖ ${shortPath}: 차단된 파일 (커밋 제외)\n`);
      for (const f of files) {
        term.red(`    - ${f.path}\n`);
      }
      term("\n");
    },

    async confirmWarned(repo, files) {
      const shortPath = repo.path.split("/").slice(-1)[0];
      term.yellow(`  ⚠ ${shortPath}: 주의 필요한 파일\n`);
      for (const f of files) {
        term.yellow(`    - ${f.path}\n`);
      }

      term("\n  포함하시겠습니까? ");
      const result = await term.yesOrNo({ yes: ["y", "ENTER"], no: ["n"] })
        .promise;
      term("\n");
      return result ?? false;
    },

    showCommitPreview(repo, message, files) {
      const shortPath = repo.path.split("/").slice(-2).join("/");
      term.bold(`\n  📂 ${shortPath}\n`);
      term("  ──────────────────────���──────────────────\n");
      term.green(`  ${message.split("\n")[0]}\n`);

      const body = message.split("\n").slice(1).join("\n").trim();
      if (body) {
        term.gray(`  ${body.replace(/\n/g, "\n  ")}\n`);
      }

      term("  ─────────────────────────────────────────\n");
      term.gray(`  Files (${files.length}):\n`);
      for (const f of files.slice(0, 10)) {
        const icon = f.status === "added" ? "A" : f.status === "deleted" ? "D" : "M";
        term.gray(`    ${icon} ${f.path}\n`);
      }
      if (files.length > 10) {
        term.gray(`    ... and ${files.length - 10} more\n`);
      }
      term("\n");
    },

    async promptAction() {
      const items = [
        "Push (푸시 실행)",
        "Skip (로컬 커밋 유지)",
        "Cancel (커밋 취소)",
        "Skip repo (이 저장소 건너뛰기)",
        "Exit (종료)",
      ];

      term("  ▶ Select action:\n");
      const response = await term.singleColumnMenu(items).promise;
      term("\n");

      const map: UserAction[] = ["push", "skip", "cancel", "skip-repo", "exit"];
      return map[response.selectedIndex] ?? "skip";
    },

    async promptOfflineTemplate(templates) {
      term.yellow("  ⚠ AI 사용 불가 — 오프라인 템플릿을 선택하세요:\n");
      const response = await term.singleColumnMenu(templates).promise;
      term("\n");

      const selected = templates[response.selectedIndex];
      term("  커밋 메시지를 입력하세요 (접두사 포함): ");
      const input = await term.inputField({ default: selected }).promise;
      term("\n");
      return input ?? selected;
    },

    async promptInput(label) {
      term(`  ${label}: `);
      const input = await term.inputField().promise;
      term("\n");
      return input ?? "";
    },

    showMessage(msg, level) {
      const icon = { info: "ℹ", success: "✅", warn: "⚠️", error: "✖" };
      const text = `  ${icon[level]} ${msg}\n`;
      switch (level) {
        case "info": term.cyan(text); break;
        case "success": term.green(text); break;
        case "warn": term.yellow(text); break;
        case "error": term.red(text); break;
      }
    },

    showComplete() {
      term("\n");
      term.bold.green("  🎉 모든 저장소 작업 완료!\n\n");
    },

    cleanup() {
      term.processExit(0);
    },
  };
}

function statusIcon(status: RepoState["status"]): string {
  switch (status) {
    case "dirty":
      return "📝 변경됨";
    case "clean":
      return "✅ Clean";
    case "detached":
      return "⚠️ Detached";
    case "rebasing":
      return "🔄 Rebasing";
    case "merging":
      return "🔀 Merging";
    case "locked":
      return "🔒 Locked";
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

function padEnd(str: string, len: number): string {
  // Simple padding — works better than term.table for CJK characters
  const diff = len - str.length;
  if (diff <= 0) return str;
  return str + " ".repeat(diff);
}
