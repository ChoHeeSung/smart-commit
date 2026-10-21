# smart-commit (로컬 전용)

> 이 파일은 gitignore 대상. 팀 공유용 정책은 루트 CLAUDE.md 참조.

## Failure Memory
dependency(0건) · file-io(10건) · general(1건) · judgment(1건) · lint(5건) · test(1건) — 상세: .leeloo/failure-memory/ 참조

### judgment 상위 패턴
- `CLI 존재 여부를 좁은 이름 후보 + 앱 번들만 보고 "불가" 단정` (freq 1, last 2026-08-04) → PATH 전체 스캔 + 컷오프 이후 릴리스는 WebSearch + 실측 후 결론

### test 상위 패턴
- ``npx vitest run` — TypeError: commitAndPush is not a function (tests/committer.test.ts)` (freq 1, last 2026-08-04, 미해결)

### file-io 상위 패턴
- ``Edit {path}` — {payload}` (freq 9, last 2026-05-09)
- ``Write {path}` — {"type":"update","filePath":"{path}","content":"import { Box` (freq 1, last 2026-04-24)

### lint 상위 패턴
- ``quality-check index.ts` — [lint] > smart-commit@0.1.0 lint` (freq 2, last 2026-04-07)
- ``quality-check lint` — > @blum84/smart-commit@0.9.5 lint` (freq 1, last 2026-04-24)
- ``quality-check index.ts` — [lint] > @blum84/smart-commit@0.4.2 lint` (freq 1, last 2026-04-08)
