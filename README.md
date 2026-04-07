# @blum84/smart-commit

AI 기반 지능형 Git 자동 커밋 & 푸시 CLI 도구

현재 디렉토리 하위의 모든 Git 저장소를 스캔하여, AI(Gemini/Claude/GPT/Ollama)로 커밋 메시지를 자동 생성하고, 안전하게 커밋/푸시합니다.

## 설치 & 실행

```bash
# 설치 없이 바로 실행
npx @blum84/smart-commit

# 글로벌 설치
npm install -g @blum84/smart-commit
smart-commit
```

## 사전 요구사항

- **Node.js** >= 18
- 다음 중 하나 이상의 AI CLI 도구:

| AI 도구 | 설치 방법 |
|---------|----------|
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `npm install -g @google/gemini-cli` |
| [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) | Anthropic 공식 CLI |
| [OpenAI CLI](https://platform.openai.com/docs/guides/command-line) | `pip install openai` |
| [Ollama](https://ollama.com/) | `brew install ollama` |

AI 도구가 없으면 자동으로 오프라인 모드(템플릿 선택)로 전환됩니다.

## 주요 기능

- **AI 커밋 메시지 생성** — diff 분석 후 Conventional Commits 형식의 한국어 메시지 자동 생성
- **AI 파일 그룹핑** — 관련 파일을 의미 단위로 묶어 커밋 분리
- **안전 필터** — `.env`, `.pem`, 대용량 파일 자동 차단 + 글로벌 `.gitignore` 반영
- **Git 상태 감지** — Detached HEAD, Rebase/Merge 진행 중, Lock 파일 등 비정상 상태 안전 스킵
- **AI Fallback** — 주 AI 도구 실패 시 대체 도구로 자동 전환
- **Conventional Commits 검증** — 생성된 메시지가 형식에 맞지 않으면 AI에게 재생성 요청
- **지능적 Diff 요약** — 대용량 diff를 stat + 핵심 hunk로 압축하여 AI에 전달
- **AI 충돌 해결** — 충돌 마커 단위로 블록별 정밀 해결 + 사용자 최종 확인
- **Dry-run 모드** — 실제 커밋/푸시 없이 미리보기
- **오프라인 모드** — AI 미접속 시 로컬 커밋 템플릿 선택
- **Headless/CI 모드** — 비대화형 환경에서 자동 커밋/푸시
- **Git Hook** — prepare-commit-msg / post-commit 훅 설치/제거
- **MCP 서버** — Claude Code 등에서 MCP 도구로 사용 가능
- **TUI** — terminal-kit 기반 프로그레스바, 테이블, 메뉴 선택

## 사용법

```bash
# 기본 실행 (하위 모든 Git 저장소 스캔)
smart-commit

# Dry-run (미리보기만, 실제 커밋 없음)
smart-commit --dry-run

# AI 도구 지정
smart-commit --ai claude
smart-commit --ai gpt
smart-commit --ai ollama

# 그룹핑 전략
smart-commit --group smart     # AI가 의미 단위로 그룹핑 (기본값)
smart-commit --group single    # 모든 변경을 하나의 커밋으로
smart-commit --group manual    # 파일별 선택

# 비대화형 모드 (CI/자동화용)
smart-commit --no-interactive

# 오프라인 모드 (AI 없이 템플릿 사용)
smart-commit --offline

# Git Hook 설치/제거
smart-commit hook
smart-commit hook --uninstall
```

### 대화형 메뉴

각 저장소/그룹마다 다음 액션을 선택할 수 있습니다:

| 액션 | 설명 |
|------|------|
| **Push** | 커밋 + 원격 푸시 |
| **Skip** | 로컬 커밋만 유지 |
| **Cancel** | 이 그룹 커밋 안 함 |
| **Skip repo** | 현재 저장소 전체 건너뛰기 |
| **Exit** | 즉시 종료 |

## 커밋 메시지 규칙

smart-commit은 [Conventional Commits](https://www.conventionalcommits.org/) + [커밋 메시지 가이드](https://github.com/RomuloOliveira/commit-messages-guide/blob/master/README_ko-KR.md) 표준을 따릅니다. AI가 자동으로 이 형식에 맞춰 메시지를 생성하고, 검증 후 재생성합니다.

### 구조

```
<type>(<scope>): <subject>

<body>

<footer>
```

| 구분 | 규칙 | 예시 |
|------|------|------|
| **type** | 변경 유형 (필수) | `feat`, `fix`, `refactor` |
| **scope** | 영향 범위 (선택) | `auth`, `api`, `ui` |
| **subject** | 50자 이내, 명령조, 핵심 요약 (필수) | `사용자 로그인 API 구현` |
| **body** | 72자/줄, "왜" 변경했는지 설명 (선택) | 상세 변경 내용 bullet 목록 |
| **footer** | 이슈 참조, Breaking Change (선택) | `Closes #123` |

### Type 종류

| Type | 설명 | 예시 |
|------|------|------|
| `feat` | 새로운 기능 추가 | `feat(auth): 소셜 로그인 구현` |
| `fix` | 버그 수정 | `fix(api): 토큰 만료 시 500 에러 수정` |
| `refactor` | 기능 변경 없는 코드 개선 | `refactor: 인증 미들웨어 구조 개선` |
| `docs` | 문서 변경 | `docs: API 엔드포인트 설명 추가` |
| `style` | 포맷팅, 세미콜론 등 | `style: 들여쓰기 2칸으로 통일` |
| `test` | 테스트 추가/수정 | `test(auth): 로그인 실패 케이스 추가` |
| `chore` | 빌드, 설정, 의존성 | `chore: typescript 5.8로 업그레이드` |
| `perf` | 성능 개선 | `perf(query): N+1 쿼리 제거` |
| `ci` | CI/CD 설정 | `ci: GitHub Actions 캐시 설정` |
| `build` | 빌드 시스템 | `build: webpack → vite 전환` |
| `revert` | 이전 커밋 되돌림 | `revert: feat(auth) 소셜 로그인 롤백` |

### 좋은 예시 vs 나쁜 예시

```
# 좋은 예시 ✅
feat(auth): JWT 기반 인증 미들웨어 구현

- Access/Refresh 토큰 발급 로직 추가
- 토큰 만료 시 자동 갱신 처리
- 인증 실패 시 401 응답 통일

Closes #42

# 나쁜 예시 ❌
수정함                          # type 없음, 무엇을 수정했는지 불명
fix: 버그 수정                  # 어떤 버그인지 불명
feat: 여러가지 수정 및 기능 추가   # 하나의 커밋에 여러 변경 혼합
FEAT: 로그인 추가               # 대문자 type
```

### 작성 원칙

1. **제목은 "무엇을"**, 본문은 **"왜"** 에 집중
2. **명령조** 사용 — "추가", "수정", "제거" (O) / "추가함", "수정했음" (X)
3. **하나의 커밋 = 하나의 논리적 변경** — 관련 없는 변경은 분리
4. **제목 50자, 본문 72자/줄** 제한 준수
5. **부수 효과**가 있으면 본문에 명시

> smart-commit의 `--group smart` 옵션은 AI가 관련 파일을 의미 단위로 자동 그룹핑하여 "하나의 커밋 = 하나의 논리적 변경" 원칙을 지킵니다.

## 설정

프로젝트 루트 또는 홈 디렉토리에 `.smart-commitrc.yaml` 파일을 생성하세요. [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig)을 사용하므로 다음 파일명도 지원합니다: `.smart-commitrc`, `.smart-commitrc.json`, `smart-commit.config.js`

```yaml
ai:
  primary: gemini          # 기본 AI: gemini | claude | gpt | ollama
  fallback: claude         # 실패 시 대체 AI
  timeout: 30              # AI 응답 타임아웃 (초)
  ollama:                  # Ollama 사용 시 설정
    model: llama3
    host: http://localhost:11434

safety:
  maxFileSize: 10MB        # 이 이상은 자동 차단
  blockedPatterns:         # 절대 커밋 금지
    - "*.env"
    - ".env.*"
    - "*.pem"
    - "*.key"
    - "credentials*"
    - "*.sqlite"
  warnPatterns:            # 경고 후 사용자 확인
    - "*.log"
    - "*.csv"
    - "package-lock.json"
    - "yarn.lock"

commit:
  style: conventional      # conventional | free
  language: ko             # 커밋 메시지 언어 (ko | en)
  maxDiffSize: 10000       # AI에 보낼 diff 최대 문자 수

grouping:
  strategy: smart          # smart | single | manual
```

설정 없이도 기본값으로 동작합니다. 글로벌 `.gitignore` 패턴도 자동으로 차단 목록에 반영됩니다.

## 안전 필터

| 분류 | 동작 | 패턴 예시 |
|------|------|----------|
| **차단** | 커밋에서 자동 제외 | `.env`, `.pem`, `.key`, `credentials*`, 10MB 초과, 바이너리, 글로벌 gitignore 패턴 |
| **경고** | 사용자 확인 후 포함 | `.log`, `.csv`, `package-lock.json` |
| **안전** | 정상 커밋 | 그 외 모든 파일 |

## Git 상태 예외 처리

| 상태 | 대응 |
|------|------|
| Detached HEAD | 경고 출력 후 스킵 |
| Rebase 진행 중 | "rebase 완료 후 재시도" 안내, 스킵 |
| Merge 진행 중 | 충돌 해결 플로우로 분기 |
| Git Hook 실패 | 에러 표시 + retry/skip 선택 |
| Lock 파일 존재 | "다른 Git 프로세스 실행 중" 안내, 스킵 |

## MCP 서버

Claude Code 등에서 MCP 도구로 사용할 수 있습니다.

```json
// .mcp.json
{
  "smart-commit": {
    "command": "node",
    "args": ["/path/to/smart-commit/dist/mcp-server.js"]
  }
}
```

### MCP 도구 목록

| Tool | 설명 |
|------|------|
| `scan` | 하위 Git 저장소 스캔 — 변경 상태 확인 |
| `analyze` | 변경 파일 분석 + 안전 필터 적용 |
| `generate-message` | AI로 diff 기반 커밋 메시지 생성 |
| `commit` | 커밋 실행 (AI 메시지 자동 생성 또는 직접 지정, push 옵션) |
| `config` | 현재 설정 확인 |

## 의존성

### Runtime

| 패키지 | 용도 |
|--------|------|
| [commander](https://github.com/tj/commander.js) | CLI 파서 |
| [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) | 설정 파일 자동 탐색 |
| [simple-git](https://github.com/steveukx/git-js) | Git 연동 |
| [execa](https://github.com/sindresorhus/execa) | AI CLI 서브프로세스 호출 |
| [terminal-kit](https://github.com/cronvel/terminal-kit) | TUI (프로그레스바, 테이블, 메뉴) |
| [minimatch](https://github.com/isaacs/minimatch) | glob 패턴 매칭 (안전 필터) |
| [pino](https://github.com/pinojs/pino) | 구조화 로깅 |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MCP 서버 |
| [zod](https://github.com/colinhacks/zod) | MCP 파라미터 검증 |

### DevDependencies

| 패키지 | 용도 |
|--------|------|
| [typescript](https://www.typescriptlang.org/) | 타입 안전성 |
| [tsup](https://github.com/egoist/tsup) | 빌드/번들링 |
| [vitest](https://vitest.dev/) | 테스트 |

## 개발

```bash
# 의존성 설치
npm install

# 개발 모드 (watch)
npm run dev

# 빌드
npm run build

# 타입 체크
npm run lint

# 테스트
npm test

# 테스트 (CI용, 단일 실행)
npm run test:run
```

## 프로젝트 구조

```
src/
├── index.ts              CLI 엔트리포인트
├── mcp-server.ts         MCP 서버
├── config.ts             설정 로딩 (cosmiconfig)
├── scanner.ts            저장소 탐색 + Git 상태 예외 처리
├── classifier.ts         안전 필터 + AI/규칙 기반 그룹핑
├── ai-client.ts          AI 호출 (Gemini/Claude/GPT/Ollama) + 검증
├── committer.ts          커밋/푸시 + pull 재시도
├── conflict-resolver.ts  충돌 마커 단위 AI 해결
├── ui.ts                 terminal-kit TUI
├── logger.ts             pino 로깅
├── types.ts              타입 정의
└── hooks/install.ts      Git Hook 설치/제거
```

## License

MIT
