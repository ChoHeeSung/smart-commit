# smart-commit CLI 도구 초기 구현

> 2026-04-07 12:20 | feat: AI 기반 자동 커밋/푸시 도구

## 지시 요약

기존 `auto_commit_push.sh` Bash 스크립트를 TypeScript npm 패키지로 재작성. `npx smart-commit`으로 즉시 실행 가능한 오픈소스 도구로 배포 목표.

## 작업 내용

### Phase 1: Core (기본 동작 + 안전장치)
- Commander.js CLI + cosmiconfig 설정 로딩
- simple-git 기반 저장소 스캐너 (Detached HEAD, Rebase, Merge, Lock, Hook 실패 5종 예외 처리)
- 안전 필터: `.env`, `.pem`, 대용량 파일 자동 차단, 경고 파일 사용자 확인
- AI 클라이언트: execa로 Gemini/Claude CLI 호출 + fallback
- terminal-kit TUI: 프로그레스바, 테이블, 메뉴 선택
- pino 기반 실행 로그 (~/.smart-commit/logs/)
- dry-run 모드

### Phase 2: Smart (지능적 커밋)
- AI 기반 파일 그룹핑 (JSON 응답 파싱) + 규칙 기반 폴백
- Conventional commit 형식 검증 + AI 재생성
- 대용량 diff 지능적 요약 (stat + 핵심 hunk 추출)
- 충돌 마커 단위 정밀 AI 해결

### Phase 3: Advanced
- 다중 AI 모델: GPT, Ollama, 커스텀 도구 지원
- Headless/CI 모드 (--no-interactive)
- Git Hook 설치/제거 (smart-commit hook / hook --uninstall)
- 오프라인 모드 (--offline, AI 미감지 시 자동 전환)

## 결과

- 31파일, 2916줄 코드
- 53개 테스트 전부 통과 (vitest, 959ms)
- 빌드: tsup → dist/index.js (29.10 KB)
- 로컬 dry-run 테스트 성공

## 현실 비유

이 도구는 **우체국 자동 분류 시스템**과 비슷하다.

1. **스캐너** = 모든 우체통을 순회하며 편지(변경 파일)를 수거
2. **안전 필터** = X-ray 검사기 — 위험물(.env, 비밀키)은 자동 걸러내고, 의심스러운 것(.log)은 사람에게 확인
3. **AI 그룹핑** = AI가 편지를 목적지별로 자동 분류 (같은 기능 관련 파일끼리 묶음)
4. **커밋 메시지 생성** = 각 묶음에 배송 라벨을 자동 작성 (conventional commit)
5. **오프라인 모드** = AI 분류기가 고장나면 수동 분류대로 전환
