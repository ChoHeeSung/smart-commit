import type { ReactElement } from "react";
import { render } from "ink";
import type {
  RepoState,
  FileChange,
  BlockedFile,
  SmartCommitConfig,
  UserAction,
  LfsInstallPlan,
} from "../types.js";
import { Header } from "./components/Header.js";
import { ScanDashboard } from "./components/ScanDashboard.js";
import { RepoTable } from "./components/RepoTable.js";
import { RepoSelect } from "./components/RepoSelect.js";
import { Blocked } from "./components/Blocked.js";
import { ConfirmWarned } from "./components/ConfirmWarned.js";
import { LfsInit } from "./components/LfsInit.js";
import { LfsInstall } from "./components/LfsInstall.js";
import { LfsExtSelect } from "./components/LfsExtSelect.js";
import { CommitPreview } from "./components/CommitPreview.js";
import { ActionMenu } from "./components/ActionMenu.js";
import { OfflineTemplate } from "./components/OfflineTemplate.js";
import { Input } from "./components/Input.js";
import { Message } from "./components/Message.js";
import { Spinner } from "./components/Spinner.js";
import { Complete } from "./components/Complete.js";

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
  promptAction(): Promise<UserAction>;
  promptOfflineTemplate(templates: string[]): Promise<string>;
  promptInput(label: string): Promise<string>;
  showMessage(msg: string, level: "info" | "success" | "warn" | "error"): void;
  showSpinner(label: string): () => void;
  showComplete(): void;
  cleanup(): void;
}

type RenderInstance = ReturnType<typeof render>;

/** Render once; Ink commits synchronously so final output stays in scrollback after unmount. */
function renderStatic(element: ReactElement): void {
  const instance = render(element);
  instance.unmount();
}

/** Render an interactive component; component calls onSubmit, we unmount and resolve. */
function renderPrompt<T>(
  build: (onSubmit: (value: T) => void) => ReactElement,
): Promise<T> {
  return new Promise<T>((resolve) => {
    let instance: RenderInstance | null = null;
    const submit = (value: T) => {
      instance?.unmount();
      resolve(value);
    };
    instance = render(build(submit));
  });
}

export function createUI(): UI {
  let progress: RenderInstance | null = null;
  let spinner: RenderInstance | null = null;

  return {
    showHeader(config, version) {
      renderStatic(<Header config={config} version={version ?? "unknown"} />);
    },

    showProgress(label, current, total) {
      const node = <ScanDashboard label={label} current={current} total={total} />;
      if (!progress) progress = render(node);
      else progress.rerender(node);
      if (current >= total) {
        progress.unmount();
        progress = null;
      }
    },

    showRepoTable(repos) {
      renderStatic(<RepoTable repos={repos} />);
    },

    selectRepos(repos) {
      const dirty = repos.filter((r) => r.status === "dirty");
      if (dirty.length === 0) return Promise.resolve([]);
      if (dirty.length === 1) return Promise.resolve(dirty);
      return renderPrompt<RepoState[]>((onSubmit) => (
        <RepoSelect repos={dirty} onSubmit={onSubmit} />
      ));
    },

    showBlocked(repo, files) {
      renderStatic(<Blocked repo={repo} files={files} />);
    },

    confirmWarned(repo, files) {
      return renderPrompt<boolean>((onSubmit) => (
        <ConfirmWarned repo={repo} files={files} onSubmit={onSubmit} />
      ));
    },

    confirmLfsInit(repo) {
      return renderPrompt<boolean>((onSubmit) => (
        <LfsInit repo={repo} onSubmit={onSubmit} />
      ));
    },

    selectLfsExtensions(extensions) {
      if (extensions.length === 0) return Promise.resolve([]);
      return renderPrompt<string[]>((onSubmit) => (
        <LfsExtSelect extensions={extensions} onSubmit={onSubmit} />
      ));
    },

    confirmLfsInstall(plan) {
      return renderPrompt<boolean>((onSubmit) => (
        <LfsInstall plan={plan} onSubmit={onSubmit} />
      ));
    },

    showCommitPreview(repo, message, files) {
      renderStatic(<CommitPreview repo={repo} message={message} files={files} />);
    },

    promptAction() {
      return renderPrompt<UserAction>((onSubmit) => (
        <ActionMenu onSubmit={onSubmit} />
      ));
    },

    promptOfflineTemplate(templates) {
      return renderPrompt<string>((onSubmit) => (
        <OfflineTemplate templates={templates} onSubmit={onSubmit} />
      ));
    },

    promptInput(label) {
      return renderPrompt<string>((onSubmit) => (
        <Input label={label} onSubmit={onSubmit} />
      ));
    },

    showMessage(msg, level) {
      renderStatic(<Message message={msg} level={level} />);
    },

    showSpinner(label) {
      spinner = render(<Spinner label={label} />);
      return () => {
        spinner?.unmount();
        spinner = null;
      };
    },

    showComplete() {
      renderStatic(<Complete />);
    },

    cleanup() {
      process.exit(0);
    },
  };
}
