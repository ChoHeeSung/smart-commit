export type Locale = "ko" | "en";

export interface Messages {
  // Header
  aiLabel: string;
  fallbackLabel: string;
  styleLabel: string;
  langLabel: string;

  // Scan
  scanning: string;
  scanComplete: string;
  noChanges: string;

  // Table headers
  thNum: string;
  thRepo: string;
  thBranch: string;
  thChanges: string;
  thStatus: string;

  // Status
  statusDirty: string;
  statusClean: string;
  statusDetached: string;
  statusRebasing: string;
  statusMerging: string;
  statusLocked: string;
  filesUnit: string;
  unpushedUnit: string;

  // Safety
  blocked: string;
  blockedDesc: string;
  warnFiles: string;
  includeQuestion: string;
  noSafeFiles: string;
  stagingSkipped: string;
  noStagedFiles: string;

  // AI
  aiGenerating: string;
  aiGroupReason: string;
  aiFailed: string;
  offlineSwitch: string;
  offlineSelect: string;
  offlineInputMsg: string;

  // Actions
  selectAction: string;
  actionPush: string;
  actionSkip: string;
  actionCancel: string;
  actionSkipRepo: string;
  actionExit: string;

  // Commit
  commitDone: string;
  commitFailed: string;
  commitFailCause: string;

  // Push
  pushing: string;
  pushDone: string;
  pushFailed: string;
  pushRetry: string;
  pushRetryDone: string;
  pushFailFinal: string;
  unpushedFound: (count: number) => string;
  dryRunSkipPush: string;
  noRemoteSkipPush: string;
  noRemoteCommitOnly: string;

  // Dry-run
  dryRun: string;

  // Flow
  skipping: string;
  skipRepo: string;
  exiting: string;
  localCommitKept: string;
  allComplete: string;

  // Repo selection
  selectRepos: string;
  selectReposHint: string;
  noReposSelected: string;

  // Hook
  hookInstalled: string;
  hookSkipped: string;
  hookRemoved: string;
  hookNone: string;

  // Error diagnosis
  errAuth: string;
  errPermission: string;
  errNonFastForward: string;
  errProtectedBranch: string;
  errRepoNotFound: string;
  errHostNotFound: string;
  errConnection: string;
  errNoUpstream: string;
  errNoRefspec: string;
  errLargeFile: string;
  errNothingToCommit: string;
  errHookFailed: string;
  errConflict: string;
  errUnmerged: string;
  errGitignored: string;
  errLockFile: string;
  errUnknown: string;

  // Fix suggestions
  fixHook: string;
  fixNothingToCommit: string;
  fixLock: string;
  fixNonFastForward: string;
  fixAuth: string;
  fixPermission: string;
  fixProtectedBranch: (branch: string) => string;
  fixUpstream: (branch: string) => string;
  fixNetwork: string;
  fixLargeFile: string;
  fixConflict: string;
}

const ko: Messages = {
  aiLabel: "AI",
  fallbackLabel: "fallback",
  styleLabel: "Style",
  langLabel: "Language",

  scanning: "저장소 스캔 중...",
  scanComplete: "스캔 완료",
  noChanges: "변경 사항이 있는 저장소가 없습니다.",

  thNum: "#",
  thRepo: "Repository",
  thBranch: "Branch",
  thChanges: "Changes",
  thStatus: "Status",

  statusDirty: "📝 변경됨",
  statusClean: "✅ Clean",
  statusDetached: "⚠️ Detached",
  statusRebasing: "🔄 Rebasing",
  statusMerging: "🔀 Merging",
  statusLocked: "🔒 Locked",
  filesUnit: "files",
  unpushedUnit: "unpushed",

  blocked: "차단된 파일 (커밋 제외)",
  blockedDesc: "차단",
  warnFiles: "주의 필요한 파일",
  includeQuestion: "포함하시겠습니까?",
  noSafeFiles: "커밋할 안전한 파일이 없습니다.",
  stagingSkipped: "staging 건너뜀",
  noStagedFiles: "staging된 파일이 없습니다.",

  aiGenerating: "AI 커밋 메시지 생성 중...",
  aiGroupReason: "그룹핑 이유",
  aiFailed: "AI 메시지 생성 실패",
  offlineSwitch: "오프라인 템플릿으로 전환합니다.",
  offlineSelect: "AI 사용 불가 — 오프라인 템플릿을 선택하세요:",
  offlineInputMsg: "커밋 메시지를 입력하세요 (접두사 포함):",

  selectAction: "Select action:",
  actionPush: "Push (푸시 실행)",
  actionSkip: "Skip (로컬 커밋 유지)",
  actionCancel: "Cancel (커밋 취소)",
  actionSkipRepo: "Skip repo (이 저장소 건너뛰기)",
  actionExit: "Exit (종료)",

  commitDone: "커밋 완료",
  commitFailed: "커밋 실패",
  commitFailCause: "원인",

  pushing: "푸시 중...",
  pushDone: "푸시 성공!",
  pushFailed: "푸시 실패",
  pushRetry: "pull 후 재시도합니다...",
  pushRetryDone: "pull 후 푸시 성공!",
  pushFailFinal: "pull/push 실패",
  unpushedFound: (n) => `푸시되지 않은 커밋 ${n}개`,
  dryRunSkipPush: "(dry-run) 푸시를 수행하지 않습니다.",
  noRemoteSkipPush: "리모트 저장소 미설정 — 푸시를 건너뜁니다.",
  noRemoteCommitOnly: "리모트 저장소 미설정 — 커밋만 수행합니다.",

  dryRun: "(dry-run) 실제 커밋/푸시를 수행하지 않습니다.",

  skipping: "건너뜁니다.",
  skipRepo: "저장소 건너뛰기",
  exiting: "종료합니다.",
  localCommitKept: "로컬 커밋 유지, 푸시 건너뜀",
  allComplete: "모든 저장소 작업 완료!",

  selectRepos: "처리할 저장소를 선택하세요",
  selectReposHint: "(↑↓: 이동, Space: 토글, a: 전체, Enter: 확정)",
  noReposSelected: "선택된 저장소가 없습니다.",

  hookInstalled: "훅 설치 완료",
  hookSkipped: "기존 훅이 있어 건너뜀",
  hookRemoved: "훅 제거 완료",
  hookNone: "제거할 smart-commit 훅이 없습니다.",

  errAuth: "인증 실패 — Git 자격 증명이 만료되었거나 잘못되었습니다",
  errPermission: "권한 없음 — 이 저장소에 push 권한이 없습니다",
  errNonFastForward: "원격에 더 새로운 커밋이 있음 (non-fast-forward)",
  errProtectedBranch: "보호된 브랜치 — 직접 push가 차단되어 있습니다 (PR 필요)",
  errRepoNotFound: "원격 저장소를 찾을 수 없음 — URL이 잘못되었거나 저장소가 삭제됨",
  errHostNotFound: "네트워크 연결 실패 — 호스트를 찾을 수 없습니다",
  errConnection: "네트워크 연결 실패 — 서버에 접근할 수 없습니다",
  errNoUpstream: "upstream 브랜치 미설정",
  errNoRefspec: "push할 커밋이 없음 — 브랜치에 커밋이 존재하지 않습니다",
  errLargeFile: "대용량 파일 — Git LFS가 필요하거나 파일 크기 제한 초과",
  errNothingToCommit: "커밋할 변경 사항이 없음",
  errHookFailed: "Git Hook 실패 — pre-commit 훅에서 오류 발생",
  errConflict: "머지 충돌 발생 — 수동으로 충돌을 해결해야 합니다",
  errUnmerged: "미해결 충돌 — 이전 머지의 충돌이 해결되지 않았습니다",
  errGitignored: ".gitignore에 의해 차단됨",
  errLockFile: "Git 잠금 — 다른 Git 프로세스가 실행 중이거나 index.lock 파일이 남아있음",
  errUnknown: "알 수 없는 오류",

  fixHook: "해결: 훅 오류를 수정하거나, 필요시 --no-verify로 우회 (권장하지 않음)",
  fixNothingToCommit: "해결: 변경된 파일이 모두 gitignore 되었을 수 있습니다",
  fixLock: "해결: rm .git/index.lock (다른 Git 프로세스가 없는지 확인 후)",
  fixNonFastForward: "해결: git pull --rebase && git push",
  fixAuth: "해결: git credential 갱신 또는 SSH 키 확인",
  fixPermission: "해결: 저장소 collaborator 권한 확인 또는 PR로 제출",
  fixProtectedBranch: (b) => `해결: 새 브랜치에서 PR 생성 (git checkout -b feature/${b})`,
  fixUpstream: (b) => `해결: git push --set-upstream origin ${b}`,
  fixNetwork: "해결: 네트워크 연결 확인 후 재시도",
  fixLargeFile: "해결: git lfs install && git lfs track '*.대상확장자'",
  fixConflict: "해결: git status로 충돌 파일 확인 → 수동 해결 → git add → git commit",
};

const en: Messages = {
  aiLabel: "AI",
  fallbackLabel: "fallback",
  styleLabel: "Style",
  langLabel: "Language",

  scanning: "Scanning repositories...",
  scanComplete: "Scan complete",
  noChanges: "No repositories with changes found.",

  thNum: "#",
  thRepo: "Repository",
  thBranch: "Branch",
  thChanges: "Changes",
  thStatus: "Status",

  statusDirty: "📝 Changed",
  statusClean: "✅ Clean",
  statusDetached: "⚠️ Detached",
  statusRebasing: "🔄 Rebasing",
  statusMerging: "🔀 Merging",
  statusLocked: "🔒 Locked",
  filesUnit: "files",
  unpushedUnit: "unpushed",

  blocked: "Blocked files (excluded from commit)",
  blockedDesc: "Blocked",
  warnFiles: "Files requiring attention",
  includeQuestion: "Include these files?",
  noSafeFiles: "No safe files to commit.",
  stagingSkipped: "staging skipped",
  noStagedFiles: "No files staged.",

  aiGenerating: "Generating commit message with AI...",
  aiGroupReason: "Grouping reason",
  aiFailed: "AI message generation failed",
  offlineSwitch: "Switching to offline templates.",
  offlineSelect: "AI unavailable — select an offline template:",
  offlineInputMsg: "Enter commit message (with prefix):",

  selectAction: "Select action:",
  actionPush: "Push",
  actionSkip: "Skip (keep local commit)",
  actionCancel: "Cancel (don't commit)",
  actionSkipRepo: "Skip repo",
  actionExit: "Exit",

  commitDone: "Committed",
  commitFailed: "Commit failed",
  commitFailCause: "Cause",

  pushing: "Pushing...",
  pushDone: "Push successful!",
  pushFailed: "Push failed",
  pushRetry: "Retrying after pull...",
  pushRetryDone: "Push successful after pull!",
  pushFailFinal: "Pull/push failed",
  unpushedFound: (n) => `${n} unpushed commit(s)`,
  dryRunSkipPush: "(dry-run) Skipping push.",
  noRemoteSkipPush: "No remote configured — skipping push.",
  noRemoteCommitOnly: "No remote configured — commit only.",

  dryRun: "(dry-run) No actual commit/push performed.",

  skipping: "Skipping.",
  skipRepo: "Skipping repository",
  exiting: "Exiting.",
  localCommitKept: "Local commit kept, push skipped",
  allComplete: "All repositories processed!",

  selectRepos: "Select repositories to process",
  selectReposHint: "(↑↓: move, Space: toggle, a: all, Enter: confirm)",
  noReposSelected: "No repositories selected.",

  hookInstalled: "Hooks installed",
  hookSkipped: "Existing hooks found, skipped",
  hookRemoved: "Hooks removed",
  hookNone: "No smart-commit hooks to remove.",

  errAuth: "Authentication failed — Git credentials expired or invalid",
  errPermission: "Permission denied — No push access to this repository",
  errNonFastForward: "Remote has newer commits (non-fast-forward)",
  errProtectedBranch: "Protected branch — Direct push blocked (PR required)",
  errRepoNotFound: "Remote repository not found — URL is wrong or repo deleted",
  errHostNotFound: "Network error — Could not resolve host",
  errConnection: "Network error — Cannot reach server",
  errNoUpstream: "No upstream branch configured",
  errNoRefspec: "Nothing to push — No commits on this branch",
  errLargeFile: "Large file — Git LFS required or file size limit exceeded",
  errNothingToCommit: "Nothing to commit",
  errHookFailed: "Git Hook failed — pre-commit hook error",
  errConflict: "Merge conflict — Manual resolution required",
  errUnmerged: "Unresolved conflict — Previous merge has unresolved files",
  errGitignored: "Blocked by .gitignore",
  errLockFile: "Git locked — Another Git process is running or index.lock remains",
  errUnknown: "Unknown error",

  fixHook: "Fix: Resolve hook error, or use --no-verify to bypass (not recommended)",
  fixNothingToCommit: "Fix: All changed files may be gitignored",
  fixLock: "Fix: rm .git/index.lock (after confirming no other Git process is running)",
  fixNonFastForward: "Fix: git pull --rebase && git push",
  fixAuth: "Fix: Refresh git credentials or check SSH key",
  fixPermission: "Fix: Check repository collaborator permissions or submit via PR",
  fixProtectedBranch: (b) => `Fix: Create PR from new branch (git checkout -b feature/${b})`,
  fixUpstream: (b) => `Fix: git push --set-upstream origin ${b}`,
  fixNetwork: "Fix: Check network connection and retry",
  fixLargeFile: "Fix: git lfs install && git lfs track '*.ext'",
  fixConflict: "Fix: git status → resolve conflicts → git add → git commit",
};

const translations: Record<Locale, Messages> = { ko, en };

let currentLocale: Locale | null = null;

export function detectLocale(): Locale {
  if (currentLocale) return currentLocale;

  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || "";
  if (lang.startsWith("ko")) {
    currentLocale = "ko";
  } else {
    currentLocale = "en";
  }
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function t(): Messages {
  return translations[detectLocale()];
}
