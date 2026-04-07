# smart-commit

AI 기반 지능형 Git 자동 커밋 & 푸시 CLI 도구

현재 디렉토리 하위의 모든 Git 저장소를 스캔하여, AI(Gemini/Claude)로 커밋 메시지를 자동 생성하고, 안전하게 커밋/푸시합니다.

## 설치 & 실행

```bash
# 설치 없이 바로 실행
npx smart-commit

# 글로벌 설치
npm install -g smart-commit
smart-commit
```

## 주요 기능

- **AI 커밋 메시지 생성** — Gemini/Claude CLI로 diff 분석 후 한국어 커밋 메시지 자동 생성
- **안전 필터** — `.env`, `.pem`, 대용량 파일 자동 차단, 위험 파일 경고
- **Git 상태 감지** — Detached HEAD, Rebase/Merge 진행 중, Lock 파일 등 비정상 상태 안전 스킵
- **AI Fallback** — 주 AI 도구 실패 시 대체 도구로 자동 전환
- **Dry-run 모드** — 실제 커밋/푸시 없이 미리보기
- **TUI** — terminal-kit 기반 프로그레스바, 테이블, 메뉴 선택

## 사전 요구사항

다음 중 하나 이상의 AI CLI 도구가 설치되어 있어야 합니다:

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `npm install -g @google/gemini-cli`
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) — Anthropic 공식 CLI

## 사용법

```bash
# 기본 실행 (하위 모든 Git 저장소 스캔)
smart-commit

# Dry-run (미리보기만)
smart-commit --dry-run

# AI 도구 지정
smart-commit --ai claude

# 그룹핑 전략 지정
smart-commit --group single    # 모든 변경을 하나의 커밋으로
smart-commit --group smart     # AI가 의미 단위로 그룹핑 (기본값)

# 비대화형 모드
smart-commit --no-interactive
```

## 설정

프로젝트 루트 또는 홈 디렉토리에 `.smart-commitrc.yaml` 파일을 생성하세요:

```yaml
ai:
  primary: gemini
  fallback: claude
  timeout: 30

safety:
  maxFileSize: 10MB
  blockedPatterns:
    - "*.env"
    - "*.pem"
    - "*.key"
    - "credentials*"
  warnPatterns:
    - "*.log"
    - "package-lock.json"

commit:
  style: conventional
  language: ko
  maxDiffSize: 10000

grouping:
  strategy: smart
```

## 안전 필터

| 분류 | 동작 | 패턴 예시 |
|------|------|----------|
| **차단** | 커밋에서 자동 제외 | `.env`, `.pem`, `.key`, `credentials*`, 10MB 초과 |
| **경고** | 사용자 확인 후 포함 | `.log`, `.csv`, `package-lock.json` |
| **안전** | 정상 커밋 | 그 외 모든 파일 |

## License

MIT
