import { simpleGit } from "simple-git";
import type { RepoState, FileChange, UserAction } from "./types.js";
import type { UI } from "./ui.js";
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
    ui.showMessage(`${repo.path}: 건너뜁니다.`, "info");
    return;
  }

  if (action === "edit") {
    // in future: allow user to edit message
    ui.showMessage("메시지 편집은 Phase 2에서 지원됩니다.", "info");
    return;
  }

  // Stage only safe files (skip gitignored)
  const filePaths = files.map((f) => f.path);
  const staged: string[] = [];
  for (const fp of filePaths) {
    try {
      await git.add(fp);
      staged.push(fp);
    } catch {
      logger.warn({ repo: repo.path, file: fp }, "Skipped (gitignored or inaccessible)");
    }
  }
  logger.info({ repo: repo.path, files: staged }, "Files staged");

  // Commit
  try {
    await git.commit(message);
    ui.showMessage(`${repo.path}: 커밋 완료`, "success");
    logger.info({ repo: repo.path, message }, "Committed");
  } catch (err) {
    logger.error({ repo: repo.path, err }, "Commit failed");
    ui.showMessage(`${repo.path}: 커밋 실패 — ${err}`, "error");
    return;
  }

  if (action === "skip") {
    ui.showMessage(`${repo.path}: 로컬 커밋 유지, 푸시 건너뜀`, "info");
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
  ui.showMessage(`${repo.path}: 푸시 중...`, "info");

  try {
    await git.push();
    ui.showMessage(`${repo.path}: 푸시 성공!`, "success");
    logger.info({ repo: repo.path }, "Pushed");
  } catch {
    ui.showMessage(`${repo.path}: 푸시 실패, pull 후 재시도...`, "warn");
    logger.warn({ repo: repo.path }, "Push failed, attempting pull");

    try {
      await git.pull();
      await git.push();
      ui.showMessage(`${repo.path}: pull 후 푸시 성공!`, "success");
      logger.info({ repo: repo.path }, "Push succeeded after pull");
    } catch (pullErr) {
      ui.showMessage(`${repo.path}: pull/push 실패 — 수동 확인 필요`, "error");
      logger.error({ repo: repo.path, err: pullErr }, "Pull+push failed");
    }
  }
}
