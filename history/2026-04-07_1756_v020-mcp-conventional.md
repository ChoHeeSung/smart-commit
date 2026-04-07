# v0.2.0 — MCP 서버 + Conventional Commits 표준화

> 2026-04-07 17:56 | feat: AI 기반 커밋 메시지 생성 및 MCP 서버 통합

## 지시 요약

초기 구현 이후 사용자 피드백을 반영하여 UI 개선, AI 프롬프트 표준화, MCP 서버 추가, 안전 필터 강화를 진행.

## 작업 내용

### AI 프롬프트 표준화
- Conventional Commits 가이드(RomuloOliveira) 기반으로 AI 프롬프트 전면 개편
- Type 11종 선택 기준, 좋은/나쁜 예시, 작성 원칙 5가지를 프롬프트에 반영
- retry 프롬프트도 동일 기준으로 개선

### MCP 서버
- `src/mcp-server.ts` 신규 — @modelcontextprotocol/sdk 기반
- 5개 도구: scan, analyze, generate-message, commit, config
- Claude Code 등에서 `.mcp.json`으로 연동 가능

### UI 개선
- `term.table` → 수동 포맷 (한글 경로 깨짐 해결)
- `term.cyan.bind()` 에러 수정
- Skip repo / Exit 메뉴 추가

### 안전 필터 강화
- 글로벌 `.gitignore` 패턴 자동 로딩 + blockedPatterns에 합침
- `classifyFiles` async 전환

### 다중 AI + 오프라인
- GPT, Ollama, 커스텀 도구 지원 (`buildAiCommand`)
- `--offline` 모드, AI 미감지 시 자동 전환

## 결과

- 53개 테스트 전부 통과
- 빌드 성공 (index.js + mcp-server.js)
- dry-run 로컬 테스트 성공
- npm publish 완료 (@blum84/smart-commit)
