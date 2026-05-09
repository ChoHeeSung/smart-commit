import { Command } from "commander";
import { createRequire } from "node:module";
import { loadConfig } from "./config.js";

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require("../package.json");
import { scanRepositories } from "./scanner.js";
import { classifyFiles, groupFiles } from "./classifier.js";
import { createAiClient, isAiAvailable, getOfflineTemplates, type AiClient } from "./ai-client.js";
import { commitGroup, pushRepo } from "./committer.js";
import type { Logger } from "pino";
import type { CommitGroup } from "./types.js";
import { createUI, type UI, type ExecOps } from "./ui/index.js";
import { createLogger } from "./logger.js";
import { t, setLocale, type Locale } from "./i18n.js";
import type { RepoState, FileChange, BlockedFile, SmartCommitConfig } from "./types.js";
import {
  isLfsInitialized,
  trackExtensions,
  uniqueExtensions,
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
    const isHeadless = options.interactive === false;
    const ui = createUI({ headless: isHeadless });
    const ai = createAiClient(config, logger);
    const dryRun = options.dryRun ?? false;

    logger.info({ options }, "smart-commit started");
    ui.showHeader(config, PKG_VERSION);

    let offlineMode = options.offline ?? false;
    if (!offlineMode) {
      const primaryAvail = await isAiAvailable(config.ai.primary);
      const fallbackAvail = await isAiAvailable(config.ai.fallback);
      if (!primaryAvail && !fallbackAvail) {
        logger.warn("No AI tools available, switching to offline mode");
        offlineMode = true;
      }
    }

    const repos = await scanRepositories(process.cwd(), ui, logger);
    if (repos.length === 0) {
      logger.info("No repositories with changes");
      ui.cleanup();
      process.stdout.write(`${t().noChanges}\n`);
      return;
    }

    // ── Phase: select ──
    let selected: RepoState[];
    if (isHeadless) {
      selected = repos.filter((r) => r.status === "dirty");
    } else {
      const result = await ui.runSelect(repos);
      if (result === null) {
        ui.cleanup();
        process.stdout.write(`${t().noReposSelected}\n`);
        return;
      }
      selected = result;
    }

    if (selected.length === 0) {
      ui.cleanup();
      process.stdout.write(`${t().noReposSelected}\n`);
      return;
    }

    // ── Phase: preview (AI generation) ──
    const previewInputs = selected.map((r) => ({ repo: r }));
    const previewOutcome = await ui.runPreview(previewInputs, async (_idx, repo) => {
      return generatePreviewForRepo(repo, ai, config, offlineMode, logger);
    });

    if (!isHeadless && !previewOutcome.proceed) {
      ui.cleanup();
      process.stdout.write(`${t().exiting}\n`);
      return;
    }

    const readyPlans = previewOutcome.previews
      .filter((p) => p.status === "ready" && p.groups.length > 0)
      .map((p) => ({ repo: p.repo, groups: p.groups }));

    if (readyPlans.length === 0) {
      ui.cleanup();
      process.stdout.write(`${t().noChanges}\n`);
      return;
    }

    // ── Phase: execute (commit + push, no prompts) ──
    const summary = await ui.runExecute(readyPlans, async (_i, repo, groups, ops) => {
      await executeRepo(repo, groups, ops, ui, logger, dryRun);
    });

    await ui.runDone(summary);
    ui.cleanup();
  });

// ─── Hook subcommand ───

program
  .command("hook")
  .description("Install or uninstall Git hooks")
  .option("--uninstall", "Remove smart-commit hooks")
  .action(async (options) => {
    const { installHooks, uninstallHooks } = await import("./hooks/install.js");

    if (options.uninstall) {
      const removed = await uninstallHooks(process.cwd());
      if (removed.length > 0) {
        process.stdout.write(`${t().hookRemoved}: ${removed.join(", ")}\n`);
      } else {
        process.stdout.write(`${t().hookNone}\n`);
      }
    } else {
      const { installed, skipped } = await installHooks(process.cwd());
      if (installed.length > 0) {
        process.stdout.write(`${t().hookInstalled}: ${installed.join(", ")}\n`);
      }
      if (skipped.length > 0) {
        process.stdout.write(`${t().hookSkipped}: ${skipped.join(", ")}\n`);
      }
    }
  });

// ── Per-repo preview generation ──

interface PreviewResult {
  groups: CommitGroup[];
  status: "ready" | "skipped" | "error";
  reason?: string;
}

async function generatePreviewForRepo(
  repo: RepoState,
  ai: AiClient,
  config: SmartCommitConfig,
  offlineMode: boolean,
  logger: Logger,
): Promise<PreviewResult> {
  try {
    if (repo.status !== "dirty") {
      return { groups: [], status: "skipped", reason: `상태=${repo.status}` };
    }

    const safety = await classifyFiles(repo.files, config, repo.path);

    // Auto-LFS handling (config-driven, no prompts)
    const sizeBlocked = safety.blocked.filter((b) => b.reason === "size");
    if (sizeBlocked.length > 0 && config.safety.lfsAutoTrack) {
      const promoted = await autoPromoteLfs(repo, sizeBlocked, config, logger);
      if (promoted.length > 0) {
        safety.safe.push(...promoted);
        safety.safe.push({ path: ".gitattributes", status: "modified", size: 0, isBinary: false });
      }
    }

    // Auto-include warned files (no prompt). Sensitive blocked files stay blocked.
    if (safety.warned.length > 0) safety.safe.push(...safety.warned);

    if (safety.safe.length === 0) {
      const reason = safety.blocked.length > 0
        ? `안전한 파일 0개 (${safety.blocked.length}개 차단)`
        : "안전한 파일 0개";
      return { groups: [], status: "skipped", reason };
    }

    const strategy = offlineMode ? "single" : config.grouping.strategy;
    const groups = await groupFiles(
      safety.safe,
      strategy,
      !offlineMode && strategy === "smart" ? (fl) => ai.groupFiles(fl) : null,
      logger,
    );

    for (const g of groups) {
      const msg = await resolveCommitMessage(repo, g, ai, config.commit.language, offlineMode, logger);
      if (!msg) {
        return { groups: [], status: "error", reason: "AI 메시지 생성 실패" };
      }
      g.message = msg;
    }

    return { groups, status: "ready" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ repo: repo.path, err }, "Preview generation failed");
    return { groups: [], status: "error", reason: msg };
  }
}

async function resolveCommitMessage(
  repo: RepoState,
  group: CommitGroup,
  ai: AiClient,
  language: string,
  offlineMode: boolean,
  logger: Logger,
): Promise<string | null> {
  if (offlineMode) {
    const templates = getOfflineTemplates();
    return templates[0] ?? `chore: auto-commit ${group.files.length} files`;
  }
  try {
    const diff = await getDiff(repo, group.files);
    const summarizedDiff = await ai.summarizeDiff(diff);
    const message = await ai.generateCommitMessage(summarizedDiff, language);
    if (message) return message;
  } catch (err) {
    logger.warn({ repo: repo.path, err }, "AI message generation failed");
  }
  return `chore: auto-commit ${group.files.length} files`;
}

// ── Per-repo execution ──

async function executeRepo(
  repo: RepoState,
  groups: CommitGroup[],
  ops: ExecOps,
  ui: UI,
  logger: Logger,
  dryRun: boolean,
): Promise<void> {
  let commitsCreated = 0;

  for (let gi = 0; gi < groups.length; gi++) {
    if (ops.isAborted()) {
      ops.setStatus("skipped");
      ops.addStep("commit", `g${gi + 1}`);
      ops.updateStep(ops.addStep("commit", `g${gi + 1} 중단`), "skip", "사용자 중단");
      return;
    }

    const g = groups[gi];
    const label = `commit g${gi + 1}/${groups.length}`;

    if (dryRun) {
      const stepIdx = ops.addStep("commit", label);
      ops.updateStep(stepIdx, "skip", "(dry-run)");
      continue;
    }

    const stepIdx = ops.addStep("commit", label);
    const ok = await commitGroup(repo, g.files, g.message ?? `chore: auto-commit ${g.files.length} files`, ui, logger);
    if (ok) {
      ops.updateStep(stepIdx, "ok");
      commitsCreated++;
    } else {
      ops.updateStep(stepIdx, "fail", "commit 실패");
      ops.setStatus("failed");
      return;
    }
  }

  if (dryRun) return;

  if (commitsCreated === 0 && repo.unpushedCommits === 0) {
    ops.setStatus("skipped");
    return;
  }

  if (!repo.hasRemote) {
    const stepIdx = ops.addStep("push", "push");
    ops.updateStep(stepIdx, "skip", "리모트 없음");
    return;
  }

  const stepIdx = ops.addStep("push", "push");
  try {
    await pushRepo(repo, ui, logger);
    ops.updateStep(stepIdx, "ok");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ops.updateStep(stepIdx, "fail", msg);
    ops.setStatus("failed");
  }
}

// ── LFS auto-promotion (config-driven) ──

async function autoPromoteLfs(
  repo: RepoState,
  sizeBlocked: BlockedFile[],
  config: SmartCommitConfig,
  logger: Logger,
): Promise<FileChange[]> {
  try {
    const filesOnly = sizeBlocked.map((b) => b.file);
    const candidates = uniqueExtensions(filesOnly);
    if (candidates.length === 0) return [];
    const exts = config.safety.lfsTrackExtensions.length > 0
      ? config.safety.lfsTrackExtensions
      : candidates;

    if (!isLfsInitialized(repo.path)) {
      const { initLfsRepo } = await import("./lfs.js");
      await initLfsRepo(repo.path);
    }
    await trackExtensions(repo.path, exts);

    const set = new Set(exts.map((e) => e.toLowerCase()));
    return sizeBlocked
      .filter((b) => set.has(b.file.path.slice(b.file.path.lastIndexOf(".")).toLowerCase()))
      .map((b) => b.file);
  } catch (err) {
    logger.warn({ repo: repo.path, err }, "LFS auto-promotion failed");
    return [];
  }
}

async function getDiff(repo: RepoState, files: FileChange[]): Promise<string> {
  const { simpleGit } = await import("simple-git");
  const git = simpleGit(repo.path);

  for (const f of files) {
    try {
      if (f.status === "deleted") {
        await git.rm(f.path);
      } else {
        await git.add(f.path);
      }
    } catch {
      // skip un-stageable files (gitignored etc.)
    }
  }

  const filePaths = files.map((f) => f.path);
  return git.diff(["--cached", "--", ...filePaths]);
}

program.parse();
