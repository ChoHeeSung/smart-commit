import { Command } from "commander";
import { createRequire } from "node:module";
import { loadConfig } from "./config.js";

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require("../package.json");
import { scanRepositories } from "./scanner.js";
import { classifyFiles, groupFiles } from "./classifier.js";
import { createAiClient, isAiAvailable, getOfflineTemplates } from "./ai-client.js";
import { commitAndPush } from "./committer.js";
import { createUI, type UI } from "./ui/index.js";
import { createLogger } from "./logger.js";
import { t, setLocale, type Locale } from "./i18n.js";
import type { RepoState, UserAction, FileChange, BlockedFile, SmartCommitConfig } from "./types.js";
import {
  detectOs,
  detectPackageManager,
  isLfsInstalled,
  getLfsVersion,
  isLfsInitialized,
  buildInstallPlan,
  runInstallPlan,
  initLfsRepo,
  trackExtensions,
  uniqueExtensions,
  isBitbucketRemote,
} from "./lfs.js";

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

      const safety = await classifyFiles(repo.files, config, repo.path);

      if (safety.blocked.length > 0) {
        ui.showBlocked(repo, safety.blocked);
      }

      // Offer Git LFS for size-blocked files
      const sizeBlocked = safety.blocked.filter((b) => b.reason === "size");
      if (sizeBlocked.length > 0 && config.safety.lfsPrompt) {
        const lfsAccepted = await handleLfsOption(repo, sizeBlocked, config, ui, isHeadless);
        if (lfsAccepted.promoted.length > 0) {
          safety.safe.push(...lfsAccepted.promoted);
          // Remove promoted files from blocked list
          safety.blocked = safety.blocked.filter(
            (b) => !lfsAccepted.promoted.some((p) => p.path === b.file.path),
          );
          if (lfsAccepted.gitattributesFile) {
            safety.safe.push(lfsAccepted.gitattributesFile);
          }
        }
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

interface LfsAcceptResult {
  promoted: FileChange[];
  gitattributesFile: FileChange | null;
}

async function handleLfsOption(
  repo: RepoState,
  sizeBlocked: BlockedFile[],
  config: SmartCommitConfig,
  ui: UI,
  isHeadless: boolean,
): Promise<LfsAcceptResult> {
  const empty: LfsAcceptResult = { promoted: [], gitattributesFile: null };

  // Headless: only proceed if explicitly configured
  if (isHeadless && !config.safety.lfsAutoTrack) {
    ui.showMessage(t().lfsSkipHeadless, "info");
    return empty;
  }

  // Ask user
  if (!isHeadless) {
    const proceed = await ui.confirmLfsInit(repo);
    if (!proceed) {
      ui.showMessage(t().lfsDecline, "info");
      return empty;
    }
  }

  // Ensure git-lfs binary exists
  if (!isLfsInstalled()) {
    const os = detectOs();
    const pm = detectPackageManager(os);
    const plan = buildInstallPlan(os, pm);

    if (!plan) {
      ui.showMessage(t().lfsNoPackageManager, "warn");
      ui.showMessage(t().lfsManualInstallUrl, "info");
      return empty;
    }

    let doInstall = config.safety.lfsAutoInstall;
    if (!isHeadless) {
      doInstall = await ui.confirmLfsInstall(plan);
    }
    if (!doInstall) {
      ui.showMessage(t().lfsManualInstallUrl, "info");
      return empty;
    }

    const stop = ui.showSpinner(t().lfsInstalling);
    const result = await runInstallPlan(plan);
    stop();

    if (!result.ok || !isLfsInstalled()) {
      ui.showMessage(`${t().lfsInstallFailed}: ${result.stderr.split("\n")[0] ?? ""}`, "error");
      ui.showMessage(t().lfsManualInstallUrl, "info");
      return empty;
    }

    const version = await getLfsVersion();
    ui.showMessage(t().lfsInstalledOk(version ?? ""), "success");
  }

  // Extension selection
  const filesOnly = sizeBlocked.map((b) => b.file);
  const candidates = uniqueExtensions(filesOnly);
  if (candidates.length === 0) return empty;

  let selectedExts: string[];
  if (isHeadless) {
    selectedExts = config.safety.lfsTrackExtensions.length > 0
      ? config.safety.lfsTrackExtensions
      : candidates;
  } else {
    selectedExts = await ui.selectLfsExtensions(candidates);
  }

  if (selectedExts.length === 0) {
    ui.showMessage(t().lfsNoExtensionsSelected, "info");
    return empty;
  }

  // Initialize LFS in repo
  if (!isLfsInitialized(repo.path)) {
    try {
      await initLfsRepo(repo.path);
      ui.showMessage(t().lfsRepoInit, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ui.showMessage(`git lfs install failed: ${msg.split("\n")[0]}`, "error");
      return empty;
    }
  }

  // Update .gitattributes
  try {
    const added = await trackExtensions(repo.path, selectedExts);
    if (added.length > 0) {
      ui.showMessage(t().lfsAttrsUpdated(added.join(", ")), "success");
    } else {
      ui.showMessage(t().lfsAttrsNoChange, "info");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.showMessage(`.gitattributes update failed: ${msg}`, "error");
    return empty;
  }

  // Bitbucket capacity warning
  try {
    const { simpleGit } = await import("simple-git");
    const git = simpleGit(repo.path);
    const remotes = await git.getRemotes(true);
    if (remotes.some((r) => isBitbucketRemote(r.refs.push ?? r.refs.fetch ?? ""))) {
      ui.showMessage(t().lfsBitbucketWarn, "warn");
    }
  } catch {
    // ignore
  }

  // Promote selected extension files from blocked → safe
  const selectedSet = new Set(selectedExts.map((e) => e.toLowerCase()));
  const promoted: FileChange[] = [];
  for (const b of sizeBlocked) {
    const ext = b.file.path.slice(b.file.path.lastIndexOf(".")).toLowerCase();
    if (selectedSet.has(ext)) {
      promoted.push(b.file);
    }
  }

  // .gitattributes file to include in commit
  const gitattributesFile: FileChange = {
    path: ".gitattributes",
    status: "modified",
    size: 0,
    isBinary: false,
  };

  ui.showMessage(t().lfsFilesIncluded(promoted.length), "success");
  return { promoted, gitattributesFile };
}

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
