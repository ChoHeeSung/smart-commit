# Git LFS 통합 지원 추가

## 지시 요약

실제 커밋 시나리오에서 10MB 초과 파일(xlsx 14MB, zip 336MB, hwp 수십 MB)이
smart-commit의 `classifier.ts`에서 차단되어 커밋이 스킵되는 문제가 발생. 사용자가
"Git LFS를 사용하는 방향"을 선택했고, 여기에 더해 "**프로젝트에서 LFS 초기화
여부를 선택할 수 있게**" + "**OS 환경에 따라 git-lfs 패키지도 자동 설치**" 되도록
smart-commit 자체에 기능을 추가해 달라는 요구.

## 작업 내용

### 1. 차단 사유 분류 체계 도입

기존 `SafetyResult.blocked: FileChange[]` 구조는 파일만 담고 있어 "왜
차단됐는지"를 판단할 수 없었음. 사이즈 초과와 보안 패턴을 구별해야 LFS
제안이 안전해지므로 아래처럼 확장.

```ts
export type BlockedReason = "size" | "binary" | "pattern";

export interface BlockedFile {
  file: FileChange;
  reason: BlockedReason;
}
```

`classifier.ts`의 `isBlocked` 복합 함수를 분기 로직으로 전환해 사유를 기록하도록 변경.
패턴 매칭은 보안상 LFS로 우회해선 안 되므로 맨 앞에서 검사.

### 2. LFS 전용 모듈 신설 (`src/lfs.ts`)

- `detectOs()` — `process.platform` 기반 macOS/Linux/Windows 분류
- `detectPackageManager(os)` — OS별 우선순위로 `which`(윈도는 `where`)로 감지.
  지원 PM 11종: brew, port, apt, dnf, yum, pacman, zypper, apk, winget, choco, scoop
- `buildInstallPlan(os, pm)` — 설치 명령 배열(sudo 필요 여부 포함)
- `runInstallPlan(plan)` — `execFile`로 실행, `DEBIAN_FRONTEND=noninteractive`
  환경변수 주입, 3분 타임아웃
- `isLfsInstalled()`, `getLfsVersion()` — 설치 상태 확인
- `isLfsInitialized(repoPath)` — `.git/hooks/pre-push`에 `git lfs`/`git-lfs`
  문자열이 있으면 초기화된 것으로 간주
- `initLfsRepo(repoPath)` — `git lfs install` (repo-local)
- `trackExtensions(repoPath, exts)` — `.gitattributes` 편집. **기존 라인을
  읽어 파싱 후 중복 라인은 추가하지 않음**. 추가된 패턴 배열을 반환해
  UI에서 "무엇이 바뀌었는지" 표시 가능
- `isLfsTrackedPath(repoPath, filePath)` — `git check-attr filter <file>`
  출력에서 `filter: lfs` 매칭 → 이미 LFS 추적 중인 파일은 `classifier`
  에서 크기/바이너리 체크를 **우회**

### 3. 메인 플로우 통합 (`index.ts`)

`handleLfsOption()` 함수를 신설해 blocked → safe 승격 파이프라인을 구성.

```
사용자 확인 (confirmLfsInit)
  → git-lfs 미설치? → 패키지 매니저 감지 → 사용자 승인(confirmLfsInstall)
    → sudo 필요 시 경고 → 설치 실행 → 재확인
  → 확장자 체크박스 선택 (selectLfsExtensions)
  → git lfs install (repo-local hook)
  → .gitattributes 갱신 (기존 내용 보존)
  → Bitbucket 원격 감지 시 1GB 한도 경고
  → 선택된 확장자의 blocked 파일을 safe 배열로 승격
  → .gitattributes 자체도 safe에 추가 (같은 커밋에 포함돼야 LFS 필터 동작)
```

보안 원칙: `safety.blocked` 중 `reason === "size"`인 파일만 LFS 옵션 대상.
`.env` 등 패턴 차단은 LFS가 있어도 올리면 안 되므로 제외.

### 4. UI 확장 (`ui.ts`)

- `confirmLfsInit` — Y/n 프롬프트 (terminal-kit yesOrNo)
- `selectLfsExtensions` — 커스텀 체크박스 메뉴. ↑↓ 이동, Space 토글,
  `a` 전체 토글, Enter 확정, ESC 취소. 기본은 전체 선택 상태
- `confirmLfsInstall(plan)` — 설치 플랜(명령어, sudo 경고) 출력 후 Y/n
- `showBlocked` — 사유 라벨 컬러 표기 (회색 bracket)

### 5. Headless 모드 고려

`--no-interactive` 시 `config.safety.lfsAutoTrack === true`일 때만 진행.
기본은 false → "LFS 단계 건너뜀" 메시지. 자동 설치도 `lfsAutoInstall`
플래그로만 진입하되, 어느 경우든 패키지 매니저 감지 실패 시 수동 설치
URL(https://git-lfs.com/) 안내만 출력하고 해당 repo skip.

## 핵심 스니펫

### blocked 분류 (classifier.ts)

```ts
// Pattern match always blocks (security). Checked first.
const patternReason = matchesAny(file.path, allBlockedPatterns);
if (patternReason) {
  blocked.push({ file, reason: "pattern" });
  continue;
}

// Size/binary check — LFS-tracked files bypass these limits
const lfsTracked = repoPath ? isLfsTrackedPath(repoPath, file.path) : false;
if (!lfsTracked) {
  if (file.size > maxBytes) {
    blocked.push({ file, reason: "size" });
    continue;
  }
  if (file.isBinary) {
    blocked.push({ file, reason: "binary" });
    continue;
  }
}
```

### .gitattributes 중복 방지 (lfs.ts)

```ts
for (const ext of extensions) {
  const normalized = ext.startsWith(".") ? ext.slice(1) : ext;
  const pattern = `*.${normalized}`;
  const line = `${pattern} filter=lfs diff=lfs merge=lfs -text`;
  const alreadyTracked = lines.some((l) => {
    const trimmed = l.trim();
    return trimmed.startsWith(pattern) && trimmed.includes("filter=lfs");
  });
  if (!alreadyTracked) {
    lines.push(line);
    added.push(pattern);
  }
}
```

## 결과

- `npm run build` 성공 (dist/index.js 46.66KB)
- `npx tsc --noEmit` 타입 에러 0건
- `node dist/index.js --help` 정상 출력
- 변경 파일: 11개, +592 / -31 라인
- 신규 파일: `src/lfs.ts` 1개

## 현실 비유

대용량 택배를 일반 우체통에 넣을 수 없어서 반송되던 상황(10MB 차단).
이번 작업으로 **택배 접수창구 안내원**(smart-commit)이 "이 물건은 대형
화물 서비스(Git LFS)로 보내시겠어요?"라고 먼저 물어보고, "대형 화물
기사가 없네요, 고용할까요?"(패키지 매니저로 git-lfs 설치)까지 제안한 뒤,
동의하면 배송장(.gitattributes) 양식도 자동으로 채워준다. 단, **현금
다발(.env/.key 등 민감 패턴)**은 대형 화물이라도 거절 — 보안 원칙.
