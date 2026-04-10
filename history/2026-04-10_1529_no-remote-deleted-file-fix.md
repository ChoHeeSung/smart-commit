# 리모트 없는 레포 처리 및 삭제 파일 staging 수정

## 지시 요약
- 리모트 저장소가 설정되지 않은 레포지토리에서 push를 시도하지 않고 커밋만 수행하도록 개선
- 삭제된 파일(D 상태) staging 시 `pathspec did not match any files` 오류 수정

## 작업 내용

### 1. 리모트 없는 레포지토리 처리
- `RepoState` 인터페이스에 `hasRemote: boolean` 필드 추가 (`src/types.ts`)
- `scanner.ts`에서 `git.getRemotes()`로 리모트 존재 여부 감지
- 리모트가 없으면 `unpushedCommits` 조회 자체를 스킵 (불필요한 에러 방지)
- `index.ts` 메인 플로우:
  - clean 레포 + unpushed 커밋: 리모트 없으면 push 메뉴 자체를 표시하지 않음
  - dirty 레포: 리모트 없으면 자동으로 `"skip"` 액션 (커밋만, push 안 함)
  - headless 모드에서도 리모트 없으면 push 시도하지 않음
- `ui.ts` 테이블에 리모트 없는 레포는 `[local]` 태그 표시
- `mcp-server.ts` commit 도구에서 push 전 리모트 존재 여부 확인
- i18n 메시지 추가: `noRemoteSkipPush`, `noRemoteCommitOnly`

### 2. 삭제된 파일 staging 오류 수정
- **문제**: 삭제된 파일에 `git.add(fp)`를 실행하면 `pathspec '파일명' did not match any files` 에러 발생
- **원인**: 로컬에서 이미 삭제된 파일은 `git add`로 staging할 수 없음. `git rm`을 사용해야 함
- **수정**: `committer.ts`와 `index.ts`의 `getDiff` 함수에서 `f.status === "deleted"`인 경우 `git.rm()` 사용

### 현실 비유
우체부(scanner)가 집집마다(repo) 돌면서 우편물(변경사항)을 수거하는데, 주소(remote)가 없는 집은 우편함에 넣어두기만(commit) 하고 배달(push)을 시도하지 않는 것과 같다. 기존에는 주소 없는 집에도 배달을 시도해서 "주소 없음" 오류가 났다.

삭제 파일 문제는 이미 이사 간 사람(deleted file)한테 택배(git add)를 보내려다 실패한 것. 이사 완료 처리(git rm)를 먼저 해야 하는 것.

## 결과
- 타입 체크, 53개 테스트, 빌드 모두 통과
- 9개 파일 변경, 87줄 추가, 43줄 삭제

## 변경 파일
- `src/types.ts` — RepoState에 hasRemote 추가
- `src/scanner.ts` — 리모트 감지 로직
- `src/index.ts` — 메인 플로우 리모트 분기 + getDiff 삭제 파일 처리
- `src/committer.ts` — staging 시 삭제 파일 git.rm() 처리
- `src/i18n.ts` — 리모트 관련 메시지 추가
- `src/ui.ts` — [local] 태그 표시
- `src/mcp-server.ts` — push 전 리모트 확인
- `src/conflict-resolver.ts` — hasRemote 필드 추가
- `tests/committer.test.ts` — hasRemote 필드 추가
