import { writeFile, readFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { simpleGit } from "simple-git";

const HOOK_MARKER = "# smart-commit-hook";

const PREPARE_COMMIT_MSG_HOOK = `#!/bin/sh
${HOOK_MARKER}
# Auto-generate commit message with smart-commit AI
# This hook is installed by smart-commit

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# Only run for new commits (not merge, squash, etc.)
if [ -z "$COMMIT_SOURCE" ]; then
  # Check if smart-commit is available
  if command -v smart-commit >/dev/null 2>&1; then
    DIFF=$(git diff --cached)
    if [ -n "$DIFF" ]; then
      MSG=$(smart-commit --no-interactive --dry-run 2>/dev/null | head -1)
      if [ -n "$MSG" ]; then
        echo "$MSG" > "$COMMIT_MSG_FILE"
      fi
    fi
  fi
fi
`;

const POST_COMMIT_HOOK = `#!/bin/sh
${HOOK_MARKER}
# Log commit with smart-commit
# This hook is installed by smart-commit

COMMIT_MSG=$(git log -1 --pretty=%B)
COMMIT_HASH=$(git rev-parse --short HEAD)
echo "[smart-commit] Committed: $COMMIT_HASH - $COMMIT_MSG"
`;

export async function installHooks(repoPath: string): Promise<{ installed: string[]; skipped: string[] }> {
  const git = simpleGit(repoPath);
  const hookDir = join(repoPath, ".git", "hooks");

  const installed: string[] = [];
  const skipped: string[] = [];

  for (const [name, content] of [
    ["prepare-commit-msg", PREPARE_COMMIT_MSG_HOOK],
    ["post-commit", POST_COMMIT_HOOK],
  ] as const) {
    const hookPath = join(hookDir, name);
    const existing = await safeRead(hookPath);

    if (existing && !existing.includes(HOOK_MARKER)) {
      // Existing hook not from us — don't overwrite
      skipped.push(name);
      continue;
    }

    await writeFile(hookPath, content, "utf-8");
    await chmod(hookPath, 0o755);
    installed.push(name);
  }

  return { installed, skipped };
}

export async function uninstallHooks(repoPath: string): Promise<string[]> {
  const hookDir = join(repoPath, ".git", "hooks");
  const removed: string[] = [];

  for (const name of ["prepare-commit-msg", "post-commit"]) {
    const hookPath = join(hookDir, name);
    const content = await safeRead(hookPath);

    if (content && content.includes(HOOK_MARKER)) {
      await writeFile(hookPath, "", "utf-8");
      removed.push(name);
    }
  }

  return removed;
}

async function safeRead(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}
