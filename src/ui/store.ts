import { useSyncExternalStore } from "react";
import type {
  BlockedFile,
  FileChange,
  GroupAction,
  LfsInstallPlan,
  PushAction,
  RepoState,
  SmartCommitConfig,
} from "../types.js";

export type Phase = "idle" | "scanning" | "selecting" | "processing" | "done";

export type LogLevel = "info" | "success" | "warn" | "error";

export interface LogEntry {
  id: number;
  level: LogLevel;
  text: string;
}

export interface Activity {
  repoPath: string;
  message: string;
  files: FileChange[];
  groupReason?: string;
}

export type Modal =
  | { type: "confirm-warned"; repo: RepoState; files: FileChange[]; resolve: (yes: boolean) => void }
  | { type: "lfs-init"; repo: RepoState; resolve: (yes: boolean) => void }
  | { type: "lfs-install"; plan: LfsInstallPlan; resolve: (yes: boolean) => void }
  | { type: "lfs-ext-select"; extensions: string[]; resolve: (picked: string[]) => void }
  | { type: "group-action-menu"; resolve: (action: GroupAction) => void }
  | { type: "push-action-menu"; commitCount: number; resolve: (action: PushAction) => void }
  | { type: "offline-template"; templates: string[]; resolve: (msg: string) => void }
  | { type: "input"; label: string; resolve: (text: string) => void };

export interface UiState {
  phase: Phase;
  header: { config: SmartCommitConfig; version: string } | null;
  scanProgress: { label: string; current: number; total: number } | null;
  repos: RepoState[];
  cursor: number;
  selection: Set<string>;
  selectingResolve: ((selected: RepoState[]) => void) | null;
  activity: Activity | null;
  log: LogEntry[];
  blocked: { repoPath: string; files: BlockedFile[] } | null;
  modal: Modal | null;
  spinnerLabel: string | null;
}

const MAX_LOG = 50;

let state: UiState = {
  phase: "idle",
  header: null,
  scanProgress: null,
  repos: [],
  cursor: 0,
  selection: new Set(),
  selectingResolve: null,
  activity: null,
  log: [],
  blocked: null,
  modal: null,
  spinnerLabel: null,
};

const listeners = new Set<() => void>();
let logId = 0;

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

  setScanProgress(p: { label: string; current: number; total: number } | null): void {
    update({
      scanProgress: p,
      phase: p && p.current < p.total ? "scanning" : state.phase,
    });
  },

  setRepos(repos: RepoState[]): void {
    update({ repos, phase: "processing", scanProgress: null });
  },

  openRepoSelect(repos: RepoState[], resolve: (selected: RepoState[]) => void): void {
    update({
      repos,
      phase: "selecting",
      cursor: 0,
      selection: new Set(repos.map((r) => r.path)),
      selectingResolve: resolve,
    });
  },

  moveCursor(delta: number): void {
    const total = state.repos.length;
    if (total === 0) return;
    const cursor = (state.cursor + delta + total) % total;
    update({ cursor });
  },

  toggleCurrent(): void {
    const repo = state.repos[state.cursor];
    if (!repo) return;
    const selection = new Set(state.selection);
    if (selection.has(repo.path)) selection.delete(repo.path);
    else selection.add(repo.path);
    update({ selection });
  },

  toggleAll(): void {
    if (state.selection.size === state.repos.length) {
      update({ selection: new Set() });
    } else {
      update({ selection: new Set(state.repos.map((r) => r.path)) });
    }
  },

  confirmRepoSelection(): void {
    const resolve = state.selectingResolve;
    if (!resolve) return;
    const picked = state.repos.filter((r) => state.selection.has(r.path));
    update({ selectingResolve: null, phase: "processing" });
    resolve(picked);
  },

  cancelRepoSelection(): void {
    const resolve = state.selectingResolve;
    if (!resolve) return;
    update({ selectingResolve: null, phase: "processing" });
    resolve([]);
  },

  setActivity(activity: Activity | null): void {
    update({ activity });
  },

  setBlocked(blocked: UiState["blocked"]): void {
    update({ blocked });
  },

  appendLog(level: LogLevel, text: string): void {
    const entry: LogEntry = { id: ++logId, level, text };
    const log = [...state.log, entry].slice(-MAX_LOG);
    update({ log });
  },

  setSpinner(label: string | null): void {
    update({ spinnerLabel: label });
  },

  openModal(modal: Modal): void {
    update({ modal });
  },

  closeModal(): void {
    update({ modal: null });
  },

  setPhase(phase: Phase): void {
    update({ phase });
  },

  reset(): void {
    state = {
      ...state,
      phase: "idle",
      scanProgress: null,
      repos: [],
      cursor: 0,
      selection: new Set(),
      activity: null,
      log: [],
      blocked: null,
      modal: null,
      spinnerLabel: null,
    };
    emit();
  },
};

export function useUi<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
