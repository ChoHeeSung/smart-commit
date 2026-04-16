import { Command } from "commander";
import { createRequire } from "node:module";
import { loadConfig } from "./config.js";

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require("../package.json");
import { scanRepositories } from "./scanner.js";
import { classifyFiles, groupFiles } from "./classifier.js";
import { createAiClient, isAiAvailable, getOfflineTemplates } from "./ai-client.js";
import { commitAndPush } from "./committer.js";
import { createUI } from "./ui.js";
import { createLogger } from "./logger.js";
import { t, setLocale, type Locale } from "./i18n.js";
import type { RepoState, UserAction, FileChange } from "./types.js";

const program = new Command();

program
  .name("smart-commit")
  .description("AI-powered intelligent Git auto-commit & push CLI tool")
  .version(PKG_VERSION)
  .option("-d, --dry-run", "Preview without committing or pushing")
  .option("-g, --group <strategy>", "Grouping strategy: smart | single | manual")
  .option("-a, --ai <tool>", "AI tool: gemini | claude | gpt | ollama")
  .option("--no-interactive", "Headless mode (no prompts)")
  .option("--offline", "Offline mode (use templates instead of AI)")
  .option("--lang <locale>", "UI language: ko | en (auto-detected from system)")
  .action(async (options) => {
    if (options.lang) setLocale(options.lang as Locale);
    const config = await loadConfig(options);
    const logger = createLogger();
    const ui = createUI();
    const ai = createAiClient(config, logger);
    const isHeadless = options.interactive === false;

    logger.info({ options }, "smart-commit started");

    ui.showHeader(config, PKG_VERSION);

    // Check AI availability (skip in offline mode)
    let offlineMode = options.offline ?? false;
    if (!offlineMode) {
      const primaryAvail = await isAiAvailable(config.ai.primary);
      const fallbackAvail = await isAiAvailable(config.ai.fallback);
      if (!primaryAvail && !fallbackAvail) {
        ui.showMessage(t().offlineSwitch, "warn");
        offlineMode = true;
        logger.warn("No AI tools available, switching to offline mode");
      } else if (!primaryAvail) {
        ui.showMessage(`${config.ai.primary}를 찾을 수 없습니다. ${config.ai.fallback}를 사용합니다.`, "warn");
      }
    }

    const repos = await scanRepositories(process.cwd(), ui, logger);

    if (repos.length === 0) {
      ui.showMessage(t().noChanges, "info");
      ui.cleanup();
      return;
    }

    ui.showRepoTable(repos);

    // Interactive repo selection (skip in headless mode)
    let selectedPaths: Set<string> | null = null;
    if (!isHeadless) {
      const selected = await ui.selectRepos(repos);
      if (selected.length === 0) {
        ui.showMessage(t().noReposSelected, "info");
        ui.cleanup();
        return;
      }
      selectedPaths = new Set(selected.map((r) => r.path));
    }

    for (const repo of repos) {
      if (repo.status !== "dirty") {
        // Handle unpushed commits
        if (repo.status === "clean" && repo.unpushedCommits > 0) {
          if (!repo.hasRemote) {
            ui.showMessage(`${repo.path}: ${t().noRemoteSkipPush}`, "info");
          } else {
            ui.showMessage(`${repo.path}: ${t().unpushedFound(repo.unpushedCommits)}`, "info");
            if (options.dryRun) {
              ui.showMessage(t().dryRunSkipPush, "info");
            } else if (!isHeadless) {
              const action = await ui.promptAction();
              if (action === "exit") {
                ui.showMessage(t().exiting, "info");
                ui.cleanup();
                return;
              }
              if (action === "push") {
                await commitAndPush(repo, [], "", "push", ui, logger);
              }
            }
          }
        }
        continue;
      }

      // Skip repos not selected by user
      if (selectedPaths && !selectedPaths.has(repo.path)) continue;

      const safety = await classifyFiles(repo.files, config);

      if (safety.blocked.length > 0) {
        ui.showBlocked(repo, safety.blocked);
      }

      if (safety.warned.length > 0) {
        if (isHeadless) {
          ui.showMessage(`${repo.path}: ${safety.warned.length} ${t().warnFiles} — headless`, "warn");
        } else {
          const proceed = await ui.confirmWarned(repo, safety.warned);
          if (proceed) {
            safety.safe.push(...safety.warned);
          }
        }
      }

      if (safety.safe.length === 0) {
        ui.showMessage(`${repo.path}: ${t().noSafeFiles}`, "warn");
        continue;
      }

      // Group files (skip AI grouping in offline mode)
      const groups = await groupFiles(
        safety.safe,
        offlineMode ? "single" : config.grouping.strategy,
        !offlineMode && config.grouping.strategy === "smart"
          ? (fileList) => ai.groupFiles(fileList)
          : null,
        logger,
      );

      for (const group of groups) {
        let commitMsg: string | null = null;

        if (offlineMode) {
          // Offline mode: use template
          if (isHeadless) {
            commitMsg = `chore: auto-commit ${group.files.length} files`;
          } else {
            commitMsg = await ui.promptOfflineTemplate(getOfflineTemplates());
          }
        } else {
          // AI mode
          const stopSpinner = ui.showSpinner(t().aiGenerating);
          const diff = await getDiff(repo, group.files);
          const summarizedDiff = await ai.summarizeDiff(diff);
          commitMsg = await ai.generateCommitMessage(summarizedDiff, config.commit.language);
          stopSpinner();

          if (!commitMsg) {
            ui.showMessage(`${repo.path} [${group.label}]: ${t().aiFailed}`, "warn");
            if (!isHeadless) {
              ui.showMessage(t().offlineSwitch, "info");
              commitMsg = await ui.promptOfflineTemplate(getOfflineTemplates());
            } else {
              commitMsg = `chore: auto-commit ${group.files.length} files`;
            }
          }
        }

        if (!commitMsg) continue;

        ui.showCommitPreview(repo, commitMsg, group.files);

        if (group.reason) {
          ui.showMessage(`  ${t().aiGroupReason}: ${group.reason}`, "info");
        }

        if (options.dryRun) {
          ui.showMessage(t().dryRun, "info");
          continue;
        }

        // No remote: commit only (skip push)
        let action: UserAction;
        if (!repo.hasRemote) {
          ui.showMessage(t().noRemoteCommitOnly, "info");
          action = "skip"; // commit + keep local (no push)
        } else {
          action = isHeadless ? "push" : await ui.promptAction();
        }

        if (action === "exit") {
          ui.showMessage(t().exiting, "info");
          ui.cleanup();
          return;
        }

        if (action === "skip-repo") {
          ui.showMessage(`${repo.path}: ${t().skipRepo}`, "info");
          break; // break out of groups loop, continue to next repo
        }

        await commitAndPush(repo, group.files, commitMsg, action, ui, logger);
      }
    }

    ui.showComplete();
    ui.cleanup();
  });

// ─── Hook subcommand ───

program
  .command("hook")
  .description("Install or uninstall Git hooks")
  .option("--uninstall", "Remove smart-commit hooks")
  .action(async (options) => {
    const { installHooks, uninstallHooks } = await import("./hooks/install.js");
    const ui = createUI();

    if (options.uninstall) {
      const removed = await uninstallHooks(process.cwd());
      if (removed.length > 0) {
        ui.showMessage(`${t().hookRemoved}: ${removed.join(", ")}`, "success");
      } else {
        ui.showMessage(t().hookNone, "info");
      }
    } else {
      const { installed, skipped } = await installHooks(process.cwd());
      if (installed.length > 0) {
        ui.showMessage(`${t().hookInstalled}: ${installed.join(", ")}`, "success");
      }
      if (skipped.length > 0) {
        ui.showMessage(`${t().hookSkipped}: ${skipped.join(", ")}`, "warn");
      }
    }

    ui.cleanup();
  });

async function getDiff(repo: RepoState, files: FileChange[]): Promise<string> {
  const { simpleGit } = await import("simple-git");
  const git = simpleGit(repo.path);

  // Stage files one by one, skipping any that fail (e.g. gitignored)
  for (const f of files) {
    try {
      if (f.status === "deleted") {
        await git.rm(f.path);
      } else {
        await git.add(f.path);
      }
    } catch {
      // Skip files that can't be staged (gitignored, etc.)
    }
  }

  const filePaths = files.map((f) => f.path);
  const diff = await git.diff(["--cached", "--", ...filePaths]);
  return diff;
}

program.parse();
