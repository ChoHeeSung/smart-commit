import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RepoState, FileChange } from "../src/types.js";
import pino from "pino";

// Mock simple-git
const mockGit = {
  add: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  pull: vi.fn().mockResolvedValue(undefined),
};

vi.mock("simple-git", () => ({
  simpleGit: () => mockGit,
}));

import { commitAndPush } from "../src/committer.js";

const logger = pino({ level: "silent" });

const mockUI = {
  showHeader: vi.fn(),
  showProgress: vi.fn(),
  showRepoTable: vi.fn(),
  showBlocked: vi.fn(),
  confirmWarned: vi.fn().mockResolvedValue(true),
  showCommitPreview: vi.fn(),
  promptAction: vi.fn().mockResolvedValue("push"),
  promptOfflineTemplate: vi.fn().mockResolvedValue("chore: "),
  promptInput: vi.fn().mockResolvedValue(""),
  showMessage: vi.fn(),
  showSpinner: vi.fn().mockReturnValue(() => {}),
  showComplete: vi.fn(),
  cleanup: vi.fn(),
};

const repo: RepoState = {
  path: "/test/repo",
  branch: "main",
  status: "dirty",
  files: [],
  unpushedCommits: 0,
  hasRemote: true,
};

const files: FileChange[] = [
  { path: "src/app.ts", status: "modified", size: 500, isBinary: false },
  { path: "src/utils.ts", status: "added", size: 200, isBinary: false },
];

describe("commitAndPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should stage files, commit, and push on 'push' action", async () => {
    await commitAndPush(repo, files, "feat: 테스트", "push", mockUI, logger);

    expect(mockGit.add).toHaveBeenCalledWith("src/app.ts");
    expect(mockGit.add).toHaveBeenCalledWith("src/utils.ts");
    expect(mockGit.commit).toHaveBeenCalledWith("feat: 테스트");
    expect(mockGit.push).toHaveBeenCalled();
    expect(mockUI.showMessage).toHaveBeenCalledWith(
      expect.stringContaining("/test/repo"),
      "success",
    );
  });

  it("should commit but not push on 'skip' action", async () => {
    await commitAndPush(repo, files, "feat: 테스트", "skip", mockUI, logger);

    expect(mockGit.add).toHaveBeenCalled();
    expect(mockGit.commit).toHaveBeenCalled();
    expect(mockGit.push).not.toHaveBeenCalled();
  });

  it("should do nothing on 'cancel' action", async () => {
    await commitAndPush(repo, files, "feat: 테스트", "cancel", mockUI, logger);

    expect(mockGit.add).not.toHaveBeenCalled();
    expect(mockGit.commit).not.toHaveBeenCalled();
    expect(mockGit.push).not.toHaveBeenCalled();
  });

  it("should retry push with pull on push failure", async () => {
    mockGit.push
      .mockRejectedValueOnce(new Error("rejected non-fast-forward"))
      .mockResolvedValueOnce(undefined);

    await commitAndPush(repo, files, "feat: 테스트", "push", mockUI, logger);

    expect(mockGit.pull).toHaveBeenCalled();
    expect(mockGit.push).toHaveBeenCalledTimes(2);
  });

  it("should show error when commit fails", async () => {
    mockGit.commit.mockRejectedValueOnce(new Error("hook failed"));

    await commitAndPush(repo, files, "feat: 테스트", "push", mockUI, logger);

    expect(mockUI.showMessage).toHaveBeenCalledWith(
      expect.stringContaining("/test/repo"),
      "error",
    );
    expect(mockGit.push).not.toHaveBeenCalled();
  });
});
