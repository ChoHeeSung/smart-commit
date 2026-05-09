import { useSyncExternalStore } from "react";
import type { CommitGroup, RepoState, SmartCommitConfig } from "../types.js";

export type Phase = "scan" | "select" | "preview" | "execute" | "done";

export interface ScanProgress {
  current: number;
  total: number;
  label: string;
}

export interface RepoPreview {
  repo: RepoState;
  groups: CommitGroup[];
  status: "pending" | "generating" | "ready" | "skipped" | "error";
  skipReason?: string;
}

export type ExecStepKind = "stage" | "commit" | "push" | "pull";
export type ExecStepStatus = "pending" | "running" | "ok" | "fail" | "skip";

export interface ExecStep {
  kind: ExecStepKind;
  label: string;
  status: ExecStepStatus;
  detail?: string;
}

export interface ExecRepoState {
  repo: RepoState;
  steps: ExecStep[];
  status: "pending" | "running" | "done" | "failed" | "skipped";
}

export interface DoneSummary {
  total: number;
  committed: number;
  pushed: number;
  failed: number;
  skipped: number;
  failures: { repo: string; reason: string }[];
  skips: { repo: string; reason: string }[];
}

export interface UiState {
  phase: Phase;
  header: { config: SmartCommitConfig; version: string } | null;

  scan: ScanProgress | null;

  repos: RepoState[];
  cursor: number;
  selection: Set<string>;
  selectResolve: ((paths: string[] | null) => void) | null;

  previews: RepoPreview[];
  previewCursor: number;
  previewResolve: ((proceed: boolean) => void) | null;

  execRepos: ExecRepoState[];
  execCursor: number;
  abortRequested: boolean;

  summary: DoneSummary | null;
  doneResolve: (() => void) | null;
}

let state: UiState = {
  phase: "scan",
  header: null,
  scan: null,
  repos: [],
  cursor: 0,
  selection: new Set(),
  selectResolve: null,
  previews: [],
  previewCursor: 0,
  previewResolve: null,
  execRepos: [],
  execCursor: 0,
  abortRequested: false,
  summary: null,
  doneResolve: null,
};

const listeners = new Set<() => void>();
function emit(): void {
  for (const l of listeners) l();
}
function update(patch: Partial<UiState>): void {
  state = { ...state, ...patch };
  emit();
}

export const store = {
  get(): UiState { return state; },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setHeader(config: SmartCommitConfig, version: string): void {
    update({ header: { config, version } });
  },

  setScan(p: ScanProgress | null): void {
    update({ scan: p, phase: p ? "scan" : state.phase });
  },

  startSelect(repos: RepoState[], resolve: (paths: string[] | null) => void): void {
    const dirty = repos.filter((r) => r.status === "dirty");
    update({
      phase: "select",
      repos,
      cursor: 0,
      selection: new Set(dirty.map((r) => r.path)),
      selectResolve: resolve,
    });
  },

  moveCursor(delta: number): void {
    const total = state.repos.length;
    if (total === 0) return;
    const next = Math.max(0, Math.min(total - 1, state.cursor + delta));
    update({ cursor: next });
  },

  toggleCurrent(): void {
    const repo = state.repos[state.cursor];
    if (!repo) return;
    if (repo.status !== "dirty") return;
    const sel = new Set(state.selection);
    if (sel.has(repo.path)) sel.delete(repo.path);
    else sel.add(repo.path);
    update({ selection: sel });
  },

  toggleAll(): void {
    const dirty = state.repos.filter((r) => r.status === "dirty");
    const allOn = dirty.every((r) => state.selection.has(r.path));
    update({ selection: allOn ? new Set() : new Set(dirty.map((r) => r.path)) });
  },

  confirmSelect(): void {
    const resolve = state.selectResolve;
    if (!resolve) return;
    const paths = state.repos
      .filter((r) => state.selection.has(r.path))
      .map((r) => r.path);
    update({ selectResolve: null });
    resolve(paths);
  },

  cancelSelect(): void {
    const resolve = state.selectResolve;
    if (!resolve) return;
    update({ selectResolve: null });
    resolve(null);
  },

  startPreview(previews: RepoPreview[], resolve: (proceed: boolean) => void): void {
    update({
      phase: "preview",
      previews,
      previewCursor: 0,
      previewResolve: resolve,
    });
  },

  updatePreview(idx: number, patch: Partial<RepoPreview>): void {
    const previews = state.previews.slice();
    if (!previews[idx]) return;
    previews[idx] = { ...previews[idx], ...patch };
    update({ previews });
  },

  movePreview(delta: number): void {
    const total = state.previews.length;
    if (total === 0) return;
    const next = Math.max(0, Math.min(total - 1, state.previewCursor + delta));
    update({ previewCursor: next });
  },

  confirmPreview(): void {
    const resolve = state.previewResolve;
    if (!resolve) return;
    update({ previewResolve: null });
    resolve(true);
  },

  cancelPreview(): void {
    const resolve = state.previewResolve;
    if (!resolve) return;
    update({ previewResolve: null });
    resolve(false);
  },

  startExecute(execRepos: ExecRepoState[]): void {
    update({
      phase: "execute",
      execRepos,
      execCursor: 0,
      abortRequested: false,
    });
  },

  setExecCursor(idx: number): void {
    update({ execCursor: idx });
  },

  updateExecRepo(idx: number, patch: Partial<ExecRepoState>): void {
    const execRepos = state.execRepos.slice();
    if (!execRepos[idx]) return;
    execRepos[idx] = { ...execRepos[idx], ...patch };
    update({ execRepos });
  },

  pushExecStep(idx: number, step: ExecStep): void {
    const execRepos = state.execRepos.slice();
    if (!execRepos[idx]) return;
    execRepos[idx] = { ...execRepos[idx], steps: [...execRepos[idx].steps, step] };
    update({ execRepos });
  },

  updateExecStep(idx: number, stepIdx: number, patch: Partial<ExecStep>): void {
    const execRepos = state.execRepos.slice();
    const r = execRepos[idx];
    if (!r) return;
    const steps = r.steps.slice();
    if (!steps[stepIdx]) return;
    steps[stepIdx] = { ...steps[stepIdx], ...patch };
    execRepos[idx] = { ...r, steps };
    update({ execRepos });
  },

  requestAbort(): void {
    update({ abortRequested: true });
  },

  startDone(summary: DoneSummary, resolve: () => void): void {
    update({ phase: "done", summary, doneResolve: resolve });
  },

  finishDone(): void {
    const r = state.doneResolve;
    if (!r) return;
    update({ doneResolve: null });
    r();
  },
};

export function useUi<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
