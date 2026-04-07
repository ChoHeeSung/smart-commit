import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { scanRepositories } from "../src/scanner.js";
import pino from "pino";

const TEST_DIR = join(process.cwd(), ".test-repos");
const logger = pino({ level: "silent" });

const noopUI = {
  showHeader: () => {},
  showProgress: () => {},
  showRepoTable: () => {},
  showBlocked: () => {},
  confirmWarned: async () => true,
  showCommitPreview: () => {},
  promptAction: async () => "skip" as const,
  showMessage: () => {},
  showComplete: () => {},
  cleanup: () => {},
};

function gitExec(dir: string, ...args: string[]) {
  execFileSync("git", args, { cwd: dir, stdio: "ignore" });
}

function gitOutput(dir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: dir }).toString().trim();
}

function initRepo(name: string): string {
  const dir = join(TEST_DIR, name);
  mkdirSync(dir, { recursive: true });
  gitExec(dir, "init");
  gitExec(dir, "config", "user.email", "test@test.com");
  gitExec(dir, "config", "user.name", "Test");
  return dir;
}

describe("scanRepositories", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should find git repositories in subdirectories", async () => {
    initRepo("repo-a");
    initRepo("repo-b");

    const repos = await scanRepositories(TEST_DIR, noopUI, logger);
    expect(repos.length).toBe(2);
  });

  it("should detect dirty status when files are changed", async () => {
    const dir = initRepo("dirty-repo");
    writeFileSync(join(dir, "init.txt"), "init");
    gitExec(dir, "add", ".");
    gitExec(dir, "commit", "-m", "init");
    writeFileSync(join(dir, "changed.txt"), "hello");

    const repos = await scanRepositories(TEST_DIR, noopUI, logger);
    const repo = repos.find((r) => r.path.includes("dirty-repo"));
    expect(repo).toBeDefined();
    expect(repo!.status).toBe("dirty");
    expect(repo!.files.length).toBeGreaterThan(0);
  });

  it("should detect clean status", async () => {
    const dir = initRepo("clean-repo");
    writeFileSync(join(dir, "file.txt"), "content");
    gitExec(dir, "add", ".");
    gitExec(dir, "commit", "-m", "init");

    const repos = await scanRepositories(TEST_DIR, noopUI, logger);
    const repo = repos.find((r) => r.path.includes("clean-repo"));
    expect(repo).toBeDefined();
    expect(repo!.status).toBe("clean");
  });

  it("should detect detached HEAD", async () => {
    const dir = initRepo("detached-repo");
    writeFileSync(join(dir, "file.txt"), "v1");
    gitExec(dir, "add", ".");
    gitExec(dir, "commit", "-m", "v1");
    const hash = gitOutput(dir, "rev-parse", "HEAD");
    gitExec(dir, "checkout", hash);

    const repos = await scanRepositories(TEST_DIR, noopUI, logger);
    const repo = repos.find((r) => r.path.includes("detached-repo"));
    expect(repo).toBeDefined();
    expect(repo!.status).toBe("detached");
  });

  it("should detect locked index", async () => {
    const dir = initRepo("locked-repo");
    writeFileSync(join(dir, "file.txt"), "content");
    gitExec(dir, "add", ".");
    gitExec(dir, "commit", "-m", "init");
    writeFileSync(join(dir, ".git", "index.lock"), "");

    const repos = await scanRepositories(TEST_DIR, noopUI, logger);
    const repo = repos.find((r) => r.path.includes("locked-repo"));
    expect(repo).toBeDefined();
    expect(repo!.status).toBe("locked");
  });

  it("should return empty for directory with no repos", async () => {
    mkdirSync(join(TEST_DIR, "empty-dir"), { recursive: true });
    writeFileSync(join(TEST_DIR, "empty-dir", "file.txt"), "not a repo");

    const repos = await scanRepositories(TEST_DIR, noopUI, logger);
    expect(repos.length).toBe(0);
  });
});
