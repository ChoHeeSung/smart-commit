# 2026-04-29 21:21 — 그룹별 commit→push 워크플로우를 레포별 일괄 push로 변경

## 지시 요약

> "현재 그룹별 커밋 → 푸시 → 커밋 → 푸시 인데, 한꺼번에 커밋 해놓고 레포지토리 별 push를 한꺼번에 하도록 하자."

UX 관점에서 그룹별 push를 레포 단위 1회 push로 통합하고, 그룹 프롬프트 메뉴를 단순화한다.

## 현실 비유

기존 흐름은 **장보기 + 결제**에 비유하면 "물건 하나 집을 때마다 계산대로 가서 결제하고 다시 매장으로 들어가는" 방식이었다. 다중 그룹 레포에서는 push 라운드트립이 N회 반복되어 사용자 입력 단계가 N×2번 늘어났다.

새 흐름은 "장바구니에 모두 담은 뒤 마지막에 한 번에 결제"하는 방식이다. 한 레포의 모든 commit을 누적한 뒤, 레포 종료 시점에 push 여부를 한 번만 묻는다.

## 작업 내용

### Phase 1 — 함수 분리 (`src/committer.ts`)

기존 `commitAndPush()`를 두 함수로 분리:

```typescript
// stage + commit 만 수행. 성공 시 true 반환
export async function commitGroup(
  repo, files, message, ui, logger
): Promise<boolean>

// push 만 수행 (non-fast-forward 시 pull → push 재시도)
export async function pushRepo(
  repo, ui, logger
): Promise<void>
```

`pushWithRetry`는 내부 `retryPushAfterPull`로 이름 변경, parseGitError 등 헬퍼는 그대로 유지.

### Phase 2 — 액션 타입 분리 (`src/types.ts`)

```typescript
// 단일 UserAction → 의미별로 분리
export type GroupAction = "commit" | "skip-group" | "skip-repo" | "exit";
export type PushAction  = "push"   | "keep-local"  | "exit";
```

`UserAction`은 제거. push 옵션은 그룹 단위에서 사라지고 레포 단위 prompt로 이동.

### Phase 3 — 모달 분리 (`src/ui/`)

- `ActionMenuModal.tsx` — 4개 항목으로 단순화 (Commit / Skip group / Skip repo / Exit), `actionCancel` 제거
- `PushMenuModal.tsx` — 신규. 헤더에 `N commits ready to push` 표시 후 (Push / Keep local / Exit)
- `store.ts` Modal union — `action-menu` → `group-action-menu` + `push-action-menu`로 분리
- `ui/index.tsx` UI 인터페이스 — `promptAction()` → `promptGroupAction()` + `promptPushAction(commitCount)`

### Phase 4 — 메인 루프 2단계 재구성 (`src/index.ts`)

```typescript
for (const repo of repos) {
  // dirty 외 처리 (clean+unpushed → handleUnpushedOnly 헬퍼)
  if (repo.status !== "dirty") { ... continue; }

  // 안전 필터 / LFS / warned (기존과 동일)

  // ── Phase 1: 모든 그룹 commit 누적 ──
  let commitsCreated = 0;
  let exitRequested = false;
  let skipRepo = false;

  for (const group of groups) {
    const commitMsg = await resolveCommitMessage(...);
    ui.showCommitPreview(...);

    const action = isHeadless ? "commit" : await ui.promptGroupAction();
    if (action === "exit")      { exitRequested = true; break; }
    if (action === "skip-repo") { skipRepo = true; break; }
    if (action === "skip-group") continue;

    if (await commitGroup(...)) commitsCreated++;
  }

  if (exitRequested) { ui.cleanup(); return; }

  // ── Phase 2: 레포 1회 push ──
  if (skipRepo || options.dryRun || commitsCreated === 0) continue;
  if (!repo.hasRemote) { showMessage(noRemoteSkipPush); continue; }

  if (isHeadless) { await pushRepo(...); continue; }

  const totalPending = commitsCreated + repo.unpushedCommits;
  const pushAction = await ui.promptPushAction(totalPending);
  if (pushAction === "exit") { ui.cleanup(); return; }
  if (pushAction === "keep-local") continue;
  await pushRepo(repo, ui, logger);
}
```

부수: `handleUnpushedOnly`(clean+unpushed 레포용 push prompt 위임), `resolveCommitMessage`(AI/오프라인 메시지 생성 분리) 헬퍼 추출.

### Phase 5 — 보조 갱신

- `i18n.ts` — `selectGroupAction` / `selectPushAction` / `actionCommit` / `actionSkipGroup` / `actionKeepLocal` / `pushReadyHeader(n)` 신규 키 추가, 기존 `actionPush/Skip/Cancel` 의미 정비
- `mcp-server.ts` — noopUI 스텁을 `promptGroupAction: "commit"`, `promptPushAction: "push"`로 갱신
- `package.json` / `package-lock.json` — `0.9.6` → `0.9.7`

## 동작 매트릭스

| 상황 | 동작 |
|------|------|
| `--no-interactive` | 모든 그룹 자동 commit → 레포 끝에 자동 push |
| `--dry-run` | preview만, prompt 없음 |
| no-remote 레포 | 그룹 prompt는 진행, push phase 자동 skip |
| `skip-repo` / `exit`(그룹 단계) | 누적 commit이 있어도 push하지 않음 (사용자 의도 존중) |
| `keep-local`(push 단계) | commit은 유지, push만 skip |

## 결과

- `npm run build` 통과 (`dist/index.js` 69KB, 16ms)
- 다중 그룹 레포에서 push 횟수 N → 1
- 그룹별 사용자 입력 메뉴 5개 → 4개 (push 옵션 제거 + skip/cancel 통합)
- 워크플로우 전반 user-visible 변경이므로 `0.9.7` 패치 bump
