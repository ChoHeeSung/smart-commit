import { simpleGit } from "simple-git";
import { t } from "./i18n.js";
import type { RepoState, FileChange, UserAction } from "./types.js";
import type { UI } from "./ui/index.js";
import type { Logger } from "pino";

export async function commitAndPush(
  repo: RepoState,
  files: FileChange[],
  message: string,
  action: UserAction,
  ui: UI,
  logger: Logger,
): Promise<void> {
  const git = simpleGit(repo.path);

  if (action === "cancel") {
    ui.showMessage(`${repo.path}: ${t().skipping}`, "info");
    return;
  }

  if (action === "edit") {
    ui.showMessage("메시지 편집은 추후 지원 예정입니다.", "info");
    return;
  }

  // Stage only safe files (skip gitignored)
  const staged: string[] = [];
  for (const f of files) {
    try {
      if (f.status === "deleted") {
        await git.rm(f.path);
      } else {
        await git.add(f.path);
      }
      staged.push(f.path);
    } catch (err) {
      const reason = parseGitError(err);
      ui.showMessage(`${f.path}: ${t().stagingSkipped} — ${reason}`, "warn");
      logger.warn({ repo: repo.path, file: f.path, reason }, "Staging skipped");
    }
  }

  if (staged.length === 0) {
    ui.showMessage(`${repo.path}: ${t().noStagedFiles}`, "warn");
    return;
  }

  logger.info({ repo: repo.path, files: staged }, "Files staged");

  // Commit
  try {
    await git.commit(message);
    ui.showMessage(`${repo.path}: ${t().commitDone} (${staged.length} ${t().filesUnit})`, "success");
    logger.info({ repo: repo.path, message }, "Committed");
  } catch (err) {
    const reason = parseGitError(err);
    logger.error({ repo: repo.path, err }, "Commit failed");

    ui.showMessage(`${repo.path}: ${t().commitFailed}`, "error");
    ui.showMessage(`  ${t().commitFailCause}: ${reason}`, "error");
    showCommitFailureHelp(reason, ui);
    return;
  }

  if (action === "skip") {
    ui.showMessage(`${repo.path}: ${t().localCommitKept}`, "info");
    return;
  }

  // Push
  if (action === "push") {
    await pushWithRetry(repo, git, ui, logger);
  }
}

async function pushWithRetry(
  repo: RepoState,
  git: ReturnType<typeof simpleGit>,
  ui: UI,
  logger: Logger,
): Promise<void> {
  const stopSpinner = ui.showSpinner(`${repo.path}: ${t().pushing}`);

  try {
    await git.push();
    stopSpinner();
    ui.showMessage(`${repo.path}: ${t().pushDone}`, "success");
    logger.info({ repo: repo.path }, "Pushed");
    return;
  } catch (firstErr) {
    stopSpinner();
    const firstReason = parseGitError(firstErr);
    ui.showMessage(`${repo.path}: ${t().pushFailed} — ${firstReason}`, "warn");
    logger.warn({ repo: repo.path, reason: firstReason }, "Push failed");

    // Retry with pull
    if (isRetryable(firstReason)) {
      ui.showMessage(`  ${t().pushRetry}`, "info");
      const stopPull = ui.showSpinner("pull...");

      try {
        await git.pull();
        stopPull();
        const stopRetry = ui.showSpinner(t().pushing);
        await git.push();
        stopRetry();
        ui.showMessage(`${repo.path}: ${t().pushRetryDone}`, "success");
        logger.info({ repo: repo.path }, "Push succeeded after pull");
        return;
      } catch (retryErr) {
        stopPull();
        const retryReason = parseGitError(retryErr);
        logger.error({ repo: repo.path, err: retryErr }, "Pull+push failed");

        ui.showMessage(`${repo.path}: ${t().pushFailFinal}`, "error");
        ui.showMessage(`  ${t().commitFailCause}: ${retryReason}`, "error");
        showPushFailureHelp(retryReason, repo.branch, ui);
        return;
      }
    }

    // Not retryable
    ui.showMessage(`  ${t().commitFailCause}: ${firstReason}`, "error");
    showPushFailureHelp(firstReason, repo.branch, ui);
  }
}

// ─── Error parsing ───

function parseGitError(err: unknown): string {
  const msg = String(err);
  const m = t();

  if (msg.includes("Authentication failed") || msg.includes("could not read Username")) return m.errAuth;
  if (msg.includes("Permission denied") || msg.includes("403")) return m.errPermission;
  if (msg.includes("rejected") && msg.includes("non-fast-forward")) return m.errNonFastForward;
  if (msg.includes("rejected") && msg.includes("protected branch")) return m.errProtectedBranch;
  if (msg.includes("remote: Repository not found") || msg.includes("does not appear to be a git repository")) return m.errRepoNotFound;
  if (msg.includes("Could not resolve host")) return m.errHostNotFound;
  if (msg.includes("Connection refused") || msg.includes("Connection timed out")) return m.errConnection;
  if (msg.includes("no upstream branch") || msg.includes("has no upstream")) return m.errNoUpstream;
  if (msg.includes("src refspec") && msg.includes("does not match any")) return m.errNoRefspec;
  if (msg.includes("large file") || msg.includes("exceeds") || msg.includes("LFS")) return m.errLargeFile;
  if (msg.includes("nothing to commit") || msg.includes("nothing added to commit")) return m.errNothingToCommit;
  if (msg.includes("pre-commit hook") || msg.includes("hook")) return m.errHookFailed;
  if (msg.includes("CONFLICT") || msg.includes("conflict")) return m.errConflict;
  if (msg.includes("not possible because you have unmerged files")) return m.errUnmerged;
  if (msg.includes("ignored by one of your .gitignore")) return m.errGitignored;
  if (msg.includes("index.lock") || msg.includes("Unable to create")) return m.errLockFile;

  const lines = msg.split("\n").filter((l) => l.trim() && !l.includes("at ") && !l.includes("node_modules"));
  return lines[0]?.slice(0, 200) || m.errUnknown;
}

function isRetryable(reason: string): boolean {
  return reason.includes("non-fast-forward") || reason.includes("upstream");
}

// ─── Help messages ───

function showCommitFailureHelp(reason: string, ui: UI): void {
  const m = t();
  if (reason === m.errHookFailed) ui.showMessage(`  ${m.fixHook}`, "info");
  else if (reason === m.errNothingToCommit) ui.showMessage(`  ${m.fixNothingToCommit}`, "info");
  else if (reason === m.errLockFile) ui.showMessage(`  ${m.fixLock}`, "info");
}

function showPushFailureHelp(reason: string, branch: string, ui: UI): void {
  const m = t();
  if (reason === m.errNonFastForward) ui.showMessage(`  ${m.fixNonFastForward}`, "info");
  else if (reason === m.errAuth) ui.showMessage(`  ${m.fixAuth}`, "info");
  else if (reason === m.errPermission) ui.showMessage(`  ${m.fixPermission}`, "info");
  else if (reason === m.errProtectedBranch) ui.showMessage(`  ${m.fixProtectedBranch(branch)}`, "info");
  else if (reason === m.errNoUpstream) ui.showMessage(`  ${m.fixUpstream(branch)}`, "info");
  else if (reason === m.errHostNotFound || reason === m.errConnection) ui.showMessage(`  ${m.fixNetwork}`, "info");
  else if (reason === m.errLargeFile) ui.showMessage(`  ${m.fixLargeFile}`, "info");
  else if (reason === m.errConflict || reason === m.errUnmerged) ui.showMessage(`  ${m.fixConflict}`, "info");
}
