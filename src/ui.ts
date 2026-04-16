import termkit from "terminal-kit";
import stringWidth from "string-width";
import { t } from "./i18n.js";
import type { RepoState, FileChange, SmartCommitConfig, UserAction } from "./types.js";

const term = termkit.terminal;

export interface UI {
  showHeader(config: SmartCommitConfig, version?: string): void;
  showProgress(label: string, current: number, total: number): void;
  showRepoTable(repos: RepoState[]): void;
  selectRepos(repos: RepoState[]): Promise<RepoState[]>;
  showBlocked(repo: RepoState, files: FileChange[]): void;
  confirmWarned(repo: RepoState, files: FileChange[]): Promise<boolean>;
  showCommitPreview(repo: RepoState, message: string, files: FileChange[]): void;
  promptAction(): Promise<UserAction>;
  promptOfflineTemplate(templates: string[]): Promise<string>;
  promptInput(label: string): Promise<string>;
  showMessage(msg: string, level: "info" | "success" | "warn" | "error"): void;
  showSpinner(label: string): () => void;
  showComplete(): void;
  cleanup(): void;
}

export function createUI(): UI {
  let progressBar: termkit.Terminal.ProgressBarController | null = null;

  return {
    showHeader(config, version) {
      term.clear();
      term.bold.cyan(`\n  Smart Commit v${version ?? "unknown"}\n`);
      term.gray(`  ${t().aiLabel}: ${config.ai.primary} (${t().fallbackLabel}: ${config.ai.fallback})\n`);
      term.gray(`  ${t().styleLabel}: ${config.commit.style} | ${t().langLabel}: ${config.commit.language}\n`);
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

      // Column widths
      const COL_NUM = 4;
      const COL_REPO = 34;
      const COL_BRANCH = 20;
      const COL_CHANGES = 11;

      const m = t();
      term.gray(`  ${cwPad(m.thNum, COL_NUM)}${cwPad(m.thRepo, COL_REPO)}${cwPad(m.thBranch, COL_BRANCH)}${cwPad(m.thChanges, COL_CHANGES)}${m.thStatus}\n`);
      term.gray(`  ${cwPad("──", COL_NUM)}${cwPad("─".repeat(30), COL_REPO)}${cwPad("─".repeat(18), COL_BRANCH)}${cwPad("─".repeat(9), COL_CHANGES)}──────────\n`);

      repos.forEach((repo, i) => {
        const shortPath = cwTruncate(repo.path.split("/").slice(-2).join("/"), COL_REPO - 2);
        const branch = cwTruncate(repo.branch, COL_BRANCH - 2);
        const changes =
          repo.files.length > 0
            ? `${repo.files.length} files`
            : repo.unpushedCommits > 0
              ? `${repo.unpushedCommits} unpushed`
              : "-";
        const remoteTag = repo.hasRemote ? "" : " [local]";
        const status = statusIcon(repo.status);
        const num = String(i + 1).padStart(2);

        const line = `  ${cwPad(num, COL_NUM)}${cwPad(shortPath, COL_REPO)}${cwPad(branch, COL_BRANCH)}${cwPad(changes, COL_CHANGES)}${status}${remoteTag}\n`;

        if (repo.status === "dirty") {
          term.yellow(line);
        } else {
          term(line);
        }
      });

      term("\n");
    },

    async selectRepos(repos) {
      const dirtyRepos = repos.filter((r) => r.status === "dirty");
      if (dirtyRepos.length === 0) return [];
      if (dirtyRepos.length === 1) return dirtyRepos;

      const m = t();
      const checked = new Set<number>(dirtyRepos.map((_, i) => i));
      let cursor = 0;

      const render = () => {
        term.column(1);
        term.bold(`  ${m.selectRepos} ${m.selectReposHint}\n\n`);
        for (let i = 0; i < dirtyRepos.length; i++) {
          const repo = dirtyRepos[i];
          const mark = checked.has(i) ? "●" : "○";
          const shortPath = cwTruncate(repo.path.split("/").slice(-2).join("/"), 40);
          const prefix = i === cursor ? "  ▸ " : "    ";
          const line = `${prefix}${mark} ${shortPath} (${repo.branch}, ${repo.files.length} files)\n`;
          if (i === cursor) {
            term.cyan(line);
          } else if (checked.has(i)) {
            term.yellow(line);
          } else {
            term.gray(line);
          }
        }
        term("\n");
      };

      // Initial render
      render();

      return new Promise<RepoState[]>((resolve) => {
        const totalLines = dirtyRepos.length + 3; // header + blank + items + trailing blank

        const redraw = () => {
          term.up(totalLines);
          term.eraseDisplayBelow();
          render();
        };

        term.grabInput(true);
        const onKey = (key: string) => {
          switch (key) {
            case "UP":
              cursor = (cursor - 1 + dirtyRepos.length) % dirtyRepos.length;
              redraw();
              break;
            case "DOWN":
              cursor = (cursor + 1) % dirtyRepos.length;
              redraw();
              break;
            case " ":
              if (checked.has(cursor)) {
                checked.delete(cursor);
              } else {
                checked.add(cursor);
              }
              redraw();
              break;
            case "a":
              if (checked.size === dirtyRepos.length) {
                checked.clear();
              } else {
                dirtyRepos.forEach((_, i) => checked.add(i));
              }
              redraw();
              break;
            case "ENTER":
              term.removeListener("key", onKey);
              term.grabInput(false);
              resolve(dirtyRepos.filter((_, i) => checked.has(i)));
              break;
            case "ESCAPE":
            case "q":
              term.removeListener("key", onKey);
              term.grabInput(false);
              resolve([]);
              break;
          }
        };
        term.on("key", onKey);
      });
    },

    showBlocked(repo, files) {
      const shortPath = repo.path.split("/").slice(-1)[0];
      term.red(`  ✖ ${shortPath}: ${t().blocked}\n`);
      for (const f of files) {
        term.red(`    - ${f.path}\n`);
      }
      term("\n");
    },

    async confirmWarned(repo, files) {
      const shortPath = repo.path.split("/").slice(-1)[0];
      term.yellow(`  ⚠ ${shortPath}: ${t().warnFiles}\n`);
      for (const f of files) {
        term.yellow(`    - ${f.path}\n`);
      }

      term(`\n  ${t().includeQuestion} `);
      const result = await term.yesOrNo({ yes: ["y", "ENTER"], no: ["n"] })
        .promise;
      term("\n");
      return result ?? false;
    },

    showCommitPreview(repo, message, files) {
      const shortPath = repo.path.split("/").slice(-2).join("/");
      term.bold(`\n  📂 ${shortPath}\n`);
      term("  ─────────────────────────────────────────\n");
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
      const m = t();
      const items = [
        m.actionPush,
        m.actionSkip,
        m.actionCancel,
        m.actionSkipRepo,
        m.actionExit,
      ];

      term(`  ▶ ${m.selectAction}\n`);
      const response = await term.singleColumnMenu(items).promise;
      term("\n");

      const map: UserAction[] = ["push", "skip", "cancel", "skip-repo", "exit"];
      return map[response.selectedIndex] ?? "skip";
    },

    async promptOfflineTemplate(templates) {
      term.yellow(`  ⚠ ${t().offlineSelect}\n`);
      const response = await term.singleColumnMenu(templates).promise;
      term("\n");

      const selected = templates[response.selectedIndex];
      term(`  ${t().offlineInputMsg} `);
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

    showSpinner(label) {
      const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let idx = 0;
      let running = true;

      const interval = setInterval(() => {
        if (!running) return;
        term.column(1);
        term.eraseLine();
        term.cyan(`  ${frames[idx % frames.length]} ${label}`);
        idx++;
      }, 80);

      return () => {
        running = false;
        clearInterval(interval);
        term.column(1);
        term.eraseLine();
      };
    },

    showComplete() {
      term("\n");
      term.bold.green(`  🎉 ${t().allComplete}\n\n`);
    },

    cleanup() {
      term.processExit(0);
    },
  };
}

function statusIcon(status: RepoState["status"]): string {
  const m = t();
  switch (status) {
    case "dirty": return m.statusDirty;
    case "clean": return m.statusClean;
    case "detached": return m.statusDetached;
    case "rebasing": return m.statusRebasing;
    case "merging": return m.statusMerging;
    case "locked": return m.statusLocked;
  }
}

// ─── CJK-aware string utilities ───

/** Truncate string to fit within `maxWidth` terminal columns */
function cwTruncate(str: string, maxWidth: number): string {
  let width = 0;
  let i = 0;
  for (const char of str) {
    const cw = stringWidth(char);
    if (width + cw > maxWidth - 1) {
      return str.slice(0, i) + "…";
    }
    width += cw;
    i += char.length;
  }
  return str;
}

/** Pad string to exactly `targetWidth` terminal columns */
function cwPad(str: string, targetWidth: number): string {
  const sw = stringWidth(str);
  if (sw >= targetWidth) return str;
  return str + " ".repeat(targetWidth - sw);
}
