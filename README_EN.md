# @blum84/smart-commit

> Built by a developer who got sick of manually committing across dozens of repos every single day.
> Stop doing `git add . && git commit -m 'fix stuff' && git push`. Let AI handle it.

AI-powered intelligent Git auto-commit & push CLI tool

Scans all Git repositories under the current directory, lets AI (Gemini/Claude/GPT/Ollama) analyze your diffs and generate commit messages automatically. Dangerous files like `.env` are filtered out, and commit messages follow the Conventional Commits format.

## Install & Run

```bash
# Run without installing
npx @blum84/smart-commit

# Global install
npm install -g @blum84/smart-commit
smart-commit
```

## Prerequisites

- **Node.js** >= 18
- At least one AI CLI tool:

| AI Tool | Install |
|---------|---------|
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `npm install -g @google/gemini-cli` |
| [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) | Anthropic official CLI |
| [OpenAI CLI](https://platform.openai.com/docs/guides/command-line) | `pip install openai` |
| [Ollama](https://ollama.com/) | `brew install ollama` |

No AI tool? It automatically switches to offline mode (template selection).

## Features

- **AI Commit Messages** — Analyzes diffs, generates Conventional Commits messages
- **AI File Grouping** — Groups related files into logical commit units
- **Safety Filter** — Auto-blocks `.env`, `.pem`, large files + respects global `.gitignore`
- **Git State Detection** — Safely skips detached HEAD, rebase/merge in progress, lock files
- **AI Fallback** — Auto-switches to backup AI when primary fails
- **Conventional Commits Validation** — Re-generates if format is invalid
- **Smart Diff Summary** — Compresses large diffs (stat + key hunks) before sending to AI
- **AI Conflict Resolution** — Resolves merge conflicts block-by-block with user confirmation
- **Dry-run Mode** — Preview without committing or pushing
- **Offline Mode** — Local commit templates when AI is unavailable
- **Headless/CI Mode** — Non-interactive auto-commit/push
- **Git Hooks** — Install/uninstall prepare-commit-msg & post-commit hooks
- **MCP Server** — Use as MCP tools in Claude Code
- **TUI** — terminal-kit based progress bar, tables, menus
- **Error Diagnosis** — Analyzes 13+ failure patterns with specific fix suggestions

## Usage

```bash
# Basic (scans all sub-repos)
smart-commit

# Dry-run (preview only)
smart-commit --dry-run

# Specify AI tool
smart-commit --ai claude
smart-commit --ai gpt
smart-commit --ai ollama

# Grouping strategy
smart-commit --group smart     # AI groups by intent (default)
smart-commit --group single    # All changes in one commit
smart-commit --group manual    # Select files manually

# Non-interactive (CI/automation)
smart-commit --no-interactive

# Offline mode (templates, no AI)
smart-commit --offline

# Git hooks
smart-commit hook
smart-commit hook --uninstall
```

### Interactive Menu

For each repo/group, you can choose:

| Action | Description |
|--------|-------------|
| **Push** | Commit + push to remote |
| **Skip** | Keep local commit only |
| **Cancel** | Don't commit this group |
| **Skip repo** | Skip entire repository |
| **Exit** | Quit immediately |

## Commit Message Convention

smart-commit follows [Conventional Commits](https://www.conventionalcommits.org/) + the [Commit Messages Guide](https://github.com/RomuloOliveira/commit-messages-guide).

### Structure

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Part | Rule | Example |
|------|------|---------|
| **type** | Change type (required) | `feat`, `fix`, `refactor` |
| **scope** | Affected area (optional) | `auth`, `api`, `ui` |
| **subject** | Under 50 chars, imperative (required) | `add user login API` |
| **body** | 72 chars/line, explain "why" (optional) | Bullet list of changes |
| **footer** | Issue refs, breaking changes (optional) | `Closes #123` |

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code improvement (no behavior change) |
| `docs` | Documentation |
| `style` | Formatting (no logic change) |
| `test` | Add/modify tests |
| `chore` | Build, config, dependencies |
| `perf` | Performance improvement |
| `ci` | CI/CD configuration |
| `build` | Build system |
| `revert` | Revert previous commit |

## Configuration

Create `.smart-commitrc.yaml` in your project root or home directory. Uses [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig), so `.smart-commitrc`, `.smart-commitrc.json`, `smart-commit.config.js` also work.

```yaml
ai:
  primary: gemini          # gemini | claude | gpt | ollama
  fallback: claude         # Fallback AI
  timeout: 30              # AI response timeout (seconds)
  ollama:
    model: llama3
    host: http://localhost:11434

safety:
  maxFileSize: 10MB
  blockedPatterns:         # Never commit
    - "*.env"
    - ".env.*"
    - "*.pem"
    - "*.key"
    - "credentials*"
    - "*.sqlite"
  warnPatterns:            # Warn before including
    - "*.log"
    - "*.csv"
    - "package-lock.json"
    - "yarn.lock"

commit:
  style: conventional      # conventional | free
  language: ko             # Commit message language (ko | en)
  maxDiffSize: 10000       # Max diff chars sent to AI

grouping:
  strategy: smart          # smart | single | manual
```

Works with defaults if no config file exists. Global `.gitignore` patterns are automatically added to the block list.

## Safety Filter

| Category | Behavior | Pattern Examples |
|----------|----------|-----------------|
| **Blocked** | Auto-excluded from commit | `.env`, `.pem`, `.key`, `credentials*`, >10MB, binary, global gitignore |
| **Warned** | Included after user confirmation | `.log`, `.csv`, `package-lock.json` |
| **Safe** | Normal commit | Everything else |

## Git State Handling

| State | Response |
|-------|----------|
| Detached HEAD | Warning + skip |
| Rebase in progress | "Complete rebase first" + skip |
| Merge in progress | Routes to conflict resolution flow |
| Git Hook failure | Error + retry/skip choice |
| Lock file exists | "Another Git process running" + skip |

## Error Diagnosis

When commit or push fails, smart-commit analyzes the error and provides specific guidance:

```
  ✖ /path/repo: Push failed
  ✖   Cause: Authentication failed — Git credentials expired or invalid
  ℹ   Fix: Refresh git credentials or check SSH key

  ✖   Cause: Protected branch — Direct push is blocked (PR required)
  ℹ   Fix: Create PR from new branch (git checkout -b feature/main)
```

Recognizes 13+ error patterns: authentication, permissions, conflicts, network, LFS, hooks, lock files, and more.

## MCP Server

Use as MCP tools in Claude Code or similar:

```json
// .mcp.json
{
  "smart-commit": {
    "command": "node",
    "args": ["/path/to/smart-commit/dist/mcp-server.js"]
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `scan` | Scan sub-repos for changes |
| `analyze` | Analyze changed files + apply safety filter |
| `generate-message` | Generate commit message from diff |
| `commit` | Execute commit (auto or manual message, push option) |
| `config` | View current configuration |

## Dependencies

### Runtime

| Package | Purpose |
|---------|---------|
| [commander](https://github.com/tj/commander.js) | CLI parser |
| [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) | Config file discovery |
| [simple-git](https://github.com/steveukx/git-js) | Git operations |
| [execa](https://github.com/sindresorhus/execa) | AI CLI subprocess |
| [terminal-kit](https://github.com/cronvel/terminal-kit) | TUI (progress, tables, menus) |
| [string-width](https://github.com/sindresorhus/string-width) | CJK-aware string width |
| [minimatch](https://github.com/isaacs/minimatch) | Glob pattern matching |
| [pino](https://github.com/pinojs/pino) | Structured logging |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MCP server |
| [zod](https://github.com/colinhacks/zod) | MCP parameter validation |

### Dev

| Package | Purpose |
|---------|---------|
| [typescript](https://www.typescriptlang.org/) | Type safety |
| [tsup](https://github.com/egoist/tsup) | Build/bundle |
| [vitest](https://vitest.dev/) | Testing |

## Development

```bash
npm install          # Install dependencies
npm run dev          # Watch mode
npm run build        # Build
npm run lint         # Type check
npm test             # Tests (watch)
npm run test:run     # Tests (single run)
```

## Project Structure

```
src/
├── index.ts              CLI entrypoint
├── mcp-server.ts         MCP server
├── config.ts             Config loading (cosmiconfig)
├── scanner.ts            Repo discovery + Git state handling
├── classifier.ts         Safety filter + AI/rule-based grouping
├── ai-client.ts          AI calls (Gemini/Claude/GPT/Ollama) + validation
├── committer.ts          Commit/push + pull retry + error diagnosis
├── conflict-resolver.ts  Block-level AI conflict resolution
├── ui.ts                 terminal-kit TUI + CJK alignment
├── logger.ts             pino logging
├── types.ts              Type definitions
└── hooks/install.ts      Git hook install/uninstall
```

## License

MIT
