import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import type {
  OsKind,
  PackageManager,
  LfsInstallPlan,
  FileChange,
} from "./types.js";

const pExecFile = promisify(execFile);

// ─── OS / PM detection ───

export function detectOs(): OsKind {
  switch (process.platform) {
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
      return "win32";
    default:
      return "unknown";
  }
}

function which(cmd: string): boolean {
  try {
    const lookup = process.platform === "win32" ? "where" : "which";
    execFileSync(lookup, [cmd], { stdio: "ignore", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export function detectPackageManager(os: OsKind): PackageManager | null {
  const candidates: Record<OsKind, PackageManager[]> = {
    darwin: ["brew", "port"],
    linux: ["apt", "dnf", "yum", "pacman", "zypper", "apk"],
    win32: ["winget", "choco", "scoop"],
    unknown: [],
  };

  const pmBinary: Record<PackageManager, string> = {
    brew: "brew",
    port: "port",
    apt: "apt-get",
    dnf: "dnf",
    yum: "yum",
    pacman: "pacman",
    zypper: "zypper",
    apk: "apk",
    winget: "winget",
    choco: "choco",
    scoop: "scoop",
  };

  for (const pm of candidates[os]) {
    if (which(pmBinary[pm])) return pm;
  }
  return null;
}

// ─── git-lfs detection ───

export function isLfsInstalled(): boolean {
  return which("git-lfs");
}

export async function getLfsVersion(): Promise<string | null> {
  try {
    const { stdout } = await pExecFile("git-lfs", ["version"], { timeout: 5000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

export function isLfsInitialized(repoPath: string): boolean {
  const hookPath = join(repoPath, ".git", "hooks", "pre-push");
  if (!existsSync(hookPath)) return false;
  try {
    const content = execFileSync("cat", [hookPath], { timeout: 2000 }).toString();
    return content.includes("git lfs") || content.includes("git-lfs");
  } catch {
    return false;
  }
}

// ─── Install plan ───

export function buildInstallPlan(os: OsKind, pm: PackageManager | null): LfsInstallPlan | null {
  if (!pm) return null;

  const plans: Record<PackageManager, { cmd: string[]; sudo: boolean }> = {
    brew: { cmd: ["brew", "install", "git-lfs"], sudo: false },
    port: { cmd: ["port", "install", "git-lfs"], sudo: true },
    apt: { cmd: ["apt-get", "install", "-y", "git-lfs"], sudo: true },
    dnf: { cmd: ["dnf", "install", "-y", "git-lfs"], sudo: true },
    yum: { cmd: ["yum", "install", "-y", "git-lfs"], sudo: true },
    pacman: { cmd: ["pacman", "-S", "--noconfirm", "git-lfs"], sudo: true },
    zypper: { cmd: ["zypper", "install", "-y", "git-lfs"], sudo: true },
    apk: { cmd: ["apk", "add", "git-lfs"], sudo: true },
    winget: { cmd: ["winget", "install", "--id", "GitHub.GitLFS", "-e"], sudo: false },
    choco: { cmd: ["choco", "install", "git-lfs", "-y"], sudo: true },
    scoop: { cmd: ["scoop", "install", "git-lfs"], sudo: false },
  };

  const plan = plans[pm];
  const cmd = plan.sudo ? ["sudo", ...plan.cmd] : plan.cmd;

  return {
    os,
    pm,
    installCommand: cmd,
    needsSudo: plan.sudo,
  };
}

export async function runInstallPlan(plan: LfsInstallPlan): Promise<{ ok: boolean; stderr: string }> {
  const [cmd, ...args] = plan.installCommand;
  try {
    const { stderr } = await pExecFile(cmd, args, {
      timeout: 180_000,
      env: { ...process.env, DEBIAN_FRONTEND: "noninteractive" },
    });
    return { ok: true, stderr };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, stderr: msg };
  }
}

// ─── LFS operations ───

export async function initLfsRepo(repoPath: string): Promise<void> {
  await pExecFile("git", ["lfs", "install"], { cwd: repoPath, timeout: 15_000 });
}

export async function trackExtensions(
  repoPath: string,
  extensions: string[],
): Promise<string[]> {
  const gitattrsPath = join(repoPath, ".gitattributes");
  const existing = await readExistingAttrs(gitattrsPath);
  const lines = existing.split("\n");

  const added: string[] = [];
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

  if (added.length === 0) return [];

  // Ensure file ends with newline
  const output = lines.join("\n").replace(/\n+$/, "") + "\n";
  await writeFile(gitattrsPath, output, "utf-8");
  return added;
}

async function readExistingAttrs(path: string): Promise<string> {
  try {
    await access(path);
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

export function isLfsTrackedPath(repoPath: string, filePath: string): boolean {
  try {
    const out = execFileSync(
      "git",
      ["check-attr", "filter", "--", filePath],
      { cwd: repoPath, timeout: 3000 },
    ).toString();
    return /filter: lfs/.test(out);
  } catch {
    return false;
  }
}

// ─── Helpers for UI ───

export function uniqueExtensions(files: FileChange[]): string[] {
  const set = new Set<string>();
  for (const f of files) {
    const ext = extname(f.path).toLowerCase();
    if (ext) set.add(ext);
  }
  return [...set].sort();
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)}${units[i]}`;
}

export function isBitbucketRemote(remoteUrl: string): boolean {
  return /bitbucket\.org/i.test(remoteUrl);
}
