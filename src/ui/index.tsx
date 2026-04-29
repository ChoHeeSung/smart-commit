import { render } from "ink";
import type {
  RepoState,
  FileChange,
  BlockedFile,
  SmartCommitConfig,
  GroupAction,
  PushAction,
  LfsInstallPlan,
} from "../types.js";
import { App } from "./App.js";
import { store } from "./store.js";
import { t } from "../i18n.js";

export interface UI {
  showHeader(config: SmartCommitConfig, version?: string): void;
  showProgress(label: string, current: number, total: number): void;
  showRepoTable(repos: RepoState[]): void;
  selectRepos(repos: RepoState[]): Promise<RepoState[]>;
  showBlocked(repo: RepoState, files: BlockedFile[]): void;
  confirmWarned(repo: RepoState, files: FileChange[]): Promise<boolean>;
  confirmLfsInit(repo: RepoState): Promise<boolean>;
  selectLfsExtensions(extensions: string[]): Promise<string[]>;
  confirmLfsInstall(plan: LfsInstallPlan): Promise<boolean>;
  showCommitPreview(repo: RepoState, message: string, files: FileChange[]): void;
  promptGroupAction(): Promise<GroupAction>;
  promptPushAction(commitCount: number): Promise<PushAction>;
  promptOfflineTemplate(templates: string[]): Promise<string>;
  promptInput(label: string): Promise<string>;
  showMessage(msg: string, level: "info" | "success" | "warn" | "error"): void;
  showSpinner(label: string): () => void;
  showComplete(): void;
  cleanup(): void;
}

type RenderInstance = ReturnType<typeof render>;

export function createUI(): UI {
  let appInstance: RenderInstance | null = null;

  function ensureApp(): void {
    if (appInstance) return;
    process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
    appInstance = render(<App />, {
      exitOnCtrlC: false,
      patchConsole: false,
    });
  }

  return {
    showHeader(config, version) {
      store.setHeader(config, version ?? "unknown");
      ensureApp();
    },

    showProgress(label, current, total) {
      store.setScanProgress({ label, current, total });
      if (current >= total) {
        // end of scanning — phase will move to processing when repos arrive
        store.setScanProgress(null);
      }
    },

    showRepoTable(repos) {
      store.setRepos(repos);
    },

    selectRepos(repos) {
      const dirty = repos.filter((r) => r.status === "dirty");
      if (dirty.length === 0) return Promise.resolve([]);
      if (dirty.length === 1) return Promise.resolve(dirty);
      return new Promise<RepoState[]>((resolve) => {
        store.openRepoSelect(repos, resolve);
      });
    },

    showBlocked(repo, files) {
      store.setBlocked({ repoPath: repo.path, files });
      store.appendLog("error", `${repo.path}: ${files.length} blocked files`);
    },

    confirmWarned(repo, files) {
      return new Promise<boolean>((resolve) => {
        store.openModal({
          type: "confirm-warned",
          repo, files,
          resolve: (yes) => { store.closeModal(); resolve(yes); },
        });
      });
    },

    confirmLfsInit(repo) {
      return new Promise<boolean>((resolve) => {
        store.openModal({
          type: "lfs-init", repo,
          resolve: (yes) => { store.closeModal(); resolve(yes); },
        });
      });
    },

    selectLfsExtensions(extensions) {
      if (extensions.length === 0) return Promise.resolve([]);
      return new Promise<string[]>((resolve) => {
        store.openModal({
          type: "lfs-ext-select", extensions,
          resolve: (picked) => { store.closeModal(); resolve(picked); },
        });
      });
    },

    confirmLfsInstall(plan) {
      return new Promise<boolean>((resolve) => {
        store.openModal({
          type: "lfs-install", plan,
          resolve: (yes) => { store.closeModal(); resolve(yes); },
        });
      });
    },

    showCommitPreview(repo, message, files) {
      store.setActivity({ repoPath: repo.path, message, files });
      store.setBlocked(null);
    },

    promptGroupAction() {
      return new Promise<GroupAction>((resolve) => {
        store.openModal({
          type: "group-action-menu",
          resolve: (action) => { store.closeModal(); resolve(action); },
        });
      });
    },

    promptPushAction(commitCount) {
      return new Promise<PushAction>((resolve) => {
        store.openModal({
          type: "push-action-menu",
          commitCount,
          resolve: (action) => { store.closeModal(); resolve(action); },
        });
      });
    },

    promptOfflineTemplate(templates) {
      return new Promise<string>((resolve) => {
        store.openModal({
          type: "offline-template", templates,
          resolve: (msg) => { store.closeModal(); resolve(msg); },
        });
      });
    },

    promptInput(label) {
      return new Promise<string>((resolve) => {
        store.openModal({
          type: "input", label,
          resolve: (text) => { store.closeModal(); resolve(text); },
        });
      });
    },

    showMessage(msg, level) {
      store.appendLog(level, msg);
    },

    showSpinner(label) {
      store.setSpinner(label);
      return () => store.setSpinner(null);
    },

    showComplete() {
      store.setPhase("done");
      store.appendLog("success", t().allComplete);
    },

    cleanup() {
      appInstance?.unmount();
      process.exit(0);
    },
  };
}
