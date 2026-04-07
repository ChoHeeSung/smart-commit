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
    ui.showMessage("메시지 편집은 추후 지원 예정입니다.", "info");
    return;
  }

  // Stage only safe files (skip gitignored)
  const filePaths = files.map((f) => f.path);
  const staged: string[] = [];
  for (const fp of filePaths) {
    try {
      await git.add(fp);
      staged.push(fp);
    } catch (err) {
      const reason = parseGitError(err);
      ui.showMessage(`${fp}: staging 건너뜀 — ${reason}`, "warn");
      logger.warn({ repo: repo.path, file: fp, reason }, "Staging skipped");
    }
  }

  if (staged.length === 0) {
    ui.showMessage(`${repo.path}: staging된 파일이 없습니다.`, "warn");
    return;
  }

  logger.info({ repo: repo.path, files: staged }, "Files staged");

  // Commit
  try {
    await git.commit(message);
    ui.showMessage(`${repo.path}: 커밋 완료 (${staged.length}개 파일)`, "success");
    logger.info({ repo: repo.path, message }, "Committed");
  } catch (err) {
    const reason = parseGitError(err);
    logger.error({ repo: repo.path, err }, "Commit failed");

    ui.showMessage(`${repo.path}: 커밋 실패`, "error");
    ui.showMessage(`  원인: ${reason}`, "error");
    showCommitFailureHelp(reason, ui);
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
  const stopSpinner = ui.showSpinner(`${repo.path}: 푸시 중...`);

  try {
    await git.push();
    stopSpinner();
    ui.showMessage(`${repo.path}: 푸시 성공!`, "success");
    logger.info({ repo: repo.path }, "Pushed");
    return;
  } catch (firstErr) {
    stopSpinner();
    const firstReason = parseGitError(firstErr);
    ui.showMessage(`${repo.path}: 푸시 실패 — ${firstReason}`, "warn");
    logger.warn({ repo: repo.path, reason: firstReason }, "Push failed");

    // Retry with pull
    if (isRetryable(firstReason)) {
      ui.showMessage("  pull 후 재시도합니다...", "info");
      const stopPull = ui.showSpinner("pull 중...");

      try {
        await git.pull();
        stopPull();
        const stopRetry = ui.showSpinner("재푸시 중...");
        await git.push();
        stopRetry();
        ui.showMessage(`${repo.path}: pull 후 푸시 성공!`, "success");
        logger.info({ repo: repo.path }, "Push succeeded after pull");
        return;
      } catch (retryErr) {
        stopPull();
        const retryReason = parseGitError(retryErr);
        logger.error({ repo: repo.path, err: retryErr }, "Pull+push failed");

        ui.showMessage(`${repo.path}: pull/push 실패`, "error");
        ui.showMessage(`  원인: ${retryReason}`, "error");
        showPushFailureHelp(retryReason, repo.branch, ui);
        return;
      }
    }

    // Not retryable
    ui.showMessage(`  원인: ${firstReason}`, "error");
    showPushFailureHelp(firstReason, repo.branch, ui);
  }
}

// ─── Error parsing ───

function parseGitError(err: unknown): string {
  const msg = String(err);

  // Authentication
  if (msg.includes("Authentication failed") || msg.includes("could not read Username")) {
    return "인증 실패 — Git 자격 증명이 만료되었거나 잘못되었습니다";
  }
  if (msg.includes("Permission denied") || msg.includes("403")) {
    return "권한 없음 — 이 저장소에 push 권한이 없습니다";
  }

  // Remote issues
  if (msg.includes("rejected") && msg.includes("non-fast-forward")) {
    return "원격에 더 새로운 커밋이 있음 (non-fast-forward)";
  }
  if (msg.includes("rejected") && msg.includes("protected branch")) {
    return "보호된 브랜치 — 직접 push가 차단되어 있습니다 (PR 필요)";
  }
  if (msg.includes("remote: Repository not found") || msg.includes("does not appear to be a git repository")) {
    return "원격 저장소를 찾을 수 없음 — URL이 잘못되었거나 저장소가 삭제됨";
  }
  if (msg.includes("Could not resolve host")) {
    return "네트워크 연결 실패 — 호스트를 찾을 수 없습니다";
  }
  if (msg.includes("Connection refused") || msg.includes("Connection timed out")) {
    return "네트워크 연결 실패 — 서버에 접근할 수 없습니다";
  }

  // Push specific
  if (msg.includes("no upstream branch") || msg.includes("has no upstream")) {
    return "upstream 브랜치 미설정";
  }
  if (msg.includes("src refspec") && msg.includes("does not match any")) {
    return "push할 커밋이 없음 — 브랜치에 커밋이 존재하지 않습니다";
  }
  if (msg.includes("large file") || msg.includes("exceeds") || msg.includes("LFS")) {
    return "대용량 파일 — Git LFS가 필요하거나 파일 크기 제한 초과";
  }

  // Commit specific
  if (msg.includes("nothing to commit") || msg.includes("nothing added to commit")) {
    return "커밋할 변경 사항이 없음";
  }
  if (msg.includes("pre-commit hook") || msg.includes("hook")) {
    return "Git Hook 실패 — pre-commit 훅에서 오류 발생";
  }

  // Merge/conflict
  if (msg.includes("CONFLICT") || msg.includes("conflict")) {
    return "머지 충돌 발생 — 수동으로 충돌을 해결해야 합니다";
  }
  if (msg.includes("not possible because you have unmerged files")) {
    return "미해결 충돌 — 이전 머지의 충돌이 해결되지 않았습니다";
  }

  // Gitignore
  if (msg.includes("ignored by one of your .gitignore")) {
    return ".gitignore에 의해 차단됨";
  }

  // Lock
  if (msg.includes("index.lock") || msg.includes("Unable to create")) {
    return "Git 잠금 — 다른 Git 프로세스가 실행 중이거나 index.lock 파일이 남아있음";
  }

  // Fallback: extract the most useful part
  const lines = msg.split("\n").filter((l) => l.trim() && !l.includes("at ") && !l.includes("node_modules"));
  return lines[0]?.slice(0, 200) || "알 수 없는 오류";
}

function isRetryable(reason: string): boolean {
  return reason.includes("non-fast-forward") || reason.includes("upstream");
}

// ─── Help messages ───

function showCommitFailureHelp(reason: string, ui: UI): void {
  if (reason.includes("Hook")) {
    ui.showMessage("  해결: 훅 오류를 수정하거나, 필요시 --no-verify로 우회 (권장하지 않음)", "info");
  } else if (reason.includes("변경 사항이 없음")) {
    ui.showMessage("  해결: 변경된 파일이 모두 gitignore 되었을 수 있습니다", "info");
  } else if (reason.includes("잠금")) {
    ui.showMessage("  해결: rm .git/index.lock (다른 Git 프로세스가 없는지 확인 후)", "info");
  }
}

function showPushFailureHelp(reason: string, branch: string, ui: UI): void {
  if (reason.includes("non-fast-forward")) {
    ui.showMessage("  해결: git pull --rebase && git push", "info");
  } else if (reason.includes("인증")) {
    ui.showMessage("  해결: git credential 갱신 또는 SSH 키 확인", "info");
  } else if (reason.includes("권한")) {
    ui.showMessage("  해결: 저장소 collaborator 권한 확인 또는 PR로 제출", "info");
  } else if (reason.includes("보호된 브랜치")) {
    ui.showMessage(`  해결: 새 브랜치에서 PR 생성 (git checkout -b feature/${branch})`, "info");
  } else if (reason.includes("upstream")) {
    ui.showMessage(`  해결: git push --set-upstream origin ${branch}`, "info");
  } else if (reason.includes("네트워크")) {
    ui.showMessage("  해결: 네트워크 연결 확인 후 재시도", "info");
  } else if (reason.includes("대용량")) {
    ui.showMessage("  해결: git lfs install && git lfs track '*.대상확장자'", "info");
  } else if (reason.includes("충돌")) {
    ui.showMessage("  해결: git status로 충돌 파일 확인 → 수동 해결 → git add → git commit", "info");
  }
}
