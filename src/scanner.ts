import { simpleGit, type SimpleGit } from "simple-git";
import { readdir, stat, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RepoState, RepoGitStatus, FileChange } from "./types.js";
import type { UI } from "./ui/index.js";
import type { Logger } from "pino";

export async function scanRepositories(
  baseDir: string,
  ui: UI,
  logger: Logger,
): Promise<RepoState[]> {
  const gitDirs = await findGitDirs(baseDir);
  const repos: RepoState[] = [];

  ui.showProgress("Scanning repositories...", 0, gitDirs.length);

  for (let i = 0; i < gitDirs.length; i++) {
    const dir = gitDirs[i];
    ui.showProgress(`Scanning: ${dir}`, i + 1, gitDirs.length);

    try {
      const repo = await inspectRepo(dir, logger);
      repos.push(repo);
    } catch (err) {
      logger.warn({ dir, err }, "Failed to inspect repository");
    }
  }

  return repos;
}

async function findGitDirs(baseDir: string): Promise<string[]> {
  const dirs: string[] = [];
  const entries = await readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;

    const fullPath = join(baseDir, entry.name);
    const gitPath = join(fullPath, ".git");

    try {
      await access(gitPath);
      dirs.push(fullPath);
    } catch {
      // not a git repo, check subdirectories
      const subDirs = await findGitDirs(fullPath);
      dirs.push(...subDirs);
    }
  }

  // also check if baseDir itself is a git repo
  try {
    const selfGit = join(baseDir, ".git");
    await access(selfGit);
    if (!dirs.some((d) => d === baseDir)) {
      dirs.unshift(baseDir);
    }
  } catch {
    // baseDir is not a git repo
  }

  return dirs;
}

async function inspectRepo(dir: string, logger: Logger): Promise<RepoState> {
  const git: SimpleGit = simpleGit(dir);

  const gitStatus = await detectGitStatus(dir, git);

  if (gitStatus === "locked") {
    logger.warn({ dir }, "Git index locked — skipping");
    return { path: dir, branch: "", status: "locked", files: [], unpushedCommits: 0, hasRemote: false };
  }
  if (gitStatus === "detached") {
    logger.warn({ dir }, "Detached HEAD — skipping");
    return { path: dir, branch: "HEAD (detached)", status: "detached", files: [], unpushedCommits: 0, hasRemote: false };
  }
  if (gitStatus === "rebasing") {
    logger.warn({ dir }, "Rebase in progress — skipping");
    return { path: dir, branch: "", status: "rebasing", files: [], unpushedCommits: 0, hasRemote: false };
  }

  const statusResult = await git.status();
  const branch = statusResult.current ?? "unknown";

  // Get list of ignored paths to filter them out
  const ignoredPaths = new Set<string>();
  try {
    const checkIgnore = await git.raw(["check-ignore", ...statusResult.files.map((f) => f.path)]);
    for (const line of checkIgnore.split("\n")) {
      if (line.trim()) ignoredPaths.add(line.trim());
    }
  } catch {
    // check-ignore returns non-zero if no files are ignored — that's fine
  }

  const files: FileChange[] = [];
  for (const f of statusResult.files) {
    // Skip files that are ignored by .gitignore
    if (ignoredPaths.has(f.path)) continue;

    const filePath = join(dir, f.path);
    let size = 0;
    try {
      const s = await stat(filePath);
      size = s.size;
    } catch {
      // file might have been deleted
    }

    files.push({
      path: f.path,
      status: mapGitStatus(f.working_dir, f.index),
      size,
      isBinary: false, // will be checked by classifier
    });
  }

  // Check if remote exists
  let hasRemote = false;
  try {
    const remotes = await git.getRemotes();
    hasRemote = remotes.length > 0;
  } catch {
    // failed to get remotes
  }

  let unpushedCommits = 0;
  if (hasRemote) {
    try {
      const log = await git.log(["@{u}..HEAD"]);
      unpushedCommits = log.total;
    } catch {
      // no upstream set
    }
  }

  const repoStatus: RepoGitStatus =
    gitStatus === "merging"
      ? "merging"
      : files.length > 0
        ? "dirty"
        : "clean";

  return { path: dir, branch, status: repoStatus, files, unpushedCommits, hasRemote };
}

async function detectGitStatus(dir: string, git: SimpleGit): Promise<RepoGitStatus> {
  // Check lock file
  try {
    await access(join(dir, ".git", "index.lock"));
    return "locked";
  } catch {
    // no lock
  }

  // Check rebase
  try {
    await access(join(dir, ".git", "rebase-merge"));
    return "rebasing";
  } catch {
    // not rebasing
  }
  try {
    await access(join(dir, ".git", "rebase-apply"));
    return "rebasing";
  } catch {
    // not rebasing
  }

  // Check merge
  try {
    await access(join(dir, ".git", "MERGE_HEAD"));
    return "merging";
  } catch {
    // not merging
  }

  // Check detached HEAD
  try {
    await git.raw(["symbolic-ref", "HEAD"]);
  } catch {
    return "detached";
  }

  return "clean";
}

function mapGitStatus(workingDir: string, index: string): FileChange["status"] {
  if (index === "?" || workingDir === "?") return "untracked";
  if (index === "A" || workingDir === "A") return "added";
  if (index === "D" || workingDir === "D") return "deleted";
  if (index === "R" || workingDir === "R") return "renamed";
  return "modified";
}
