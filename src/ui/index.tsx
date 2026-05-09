import { render } from "ink";
import type {
  RepoState,
  CommitGroup,
  SmartCommitConfig,
} from "../types.js";
import { App } from "./App.js";
import {
  store,
  type RepoPreview,
  type ExecRepoState,
  type ExecStep,
  type ExecStepKind,
  type DoneSummary,
} from "./store.js";

export type LogLevel = "info" | "success" | "warn" | "error";

export interface ExecOps {
  addStep(kind: ExecStepKind, label: string): number;
  updateStep(stepIdx: number, status: ExecStep["status"], detail?: string): void;
  setStatus(status: ExecRepoState["status"]): void;
  isAborted(): boolean;
}

export interface UI {
  showHeader(config: SmartCommitConfig, version?: string): void;
  showProgress(label: string, current: number, total: number): void;
  showMessage(msg: string, level: LogLevel): void;
  showSpinner(label: string): () => void;

  runSelect(repos: RepoState[]): Promise<RepoState[] | null>;

  runPreview(
    initial: { repo: RepoState }[],
    generate: (idx: number, repo: RepoState) => Promise<{
      groups: CommitGroup[];
      status: "ready" | "skipped" | "error";
      reason?: string;
    }>,
  ): Promise<{ proceed: boolean; previews: RepoPreview[] }>;

  runExecute(
    plan: { repo: RepoState; groups: CommitGroup[] }[],
    runner: (idx: number, repo: RepoState, groups: CommitGroup[], ops: ExecOps) => Promise<void>,
  ): Promise<DoneSummary>;

  runDone(summary: DoneSummary): Promise<void>;

  cleanup(): void;
}

type RenderInstance = ReturnType<typeof render>;

export interface CreateUiOptions {
  headless?: boolean;
}

export function createUI(opts: CreateUiOptions = {}): UI {
  const headless = opts.headless ?? !process.stdout.isTTY;
  let appInstance: RenderInstance | null = null;

  function ensureApp(): void {
    if (headless) return;
    if (appInstance) return;
    process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
    appInstance = render(<App />, {
      exitOnCtrlC: false,
      patchConsole: false,
    });
  }

  function writeStatus(line: string): void {
    if (!headless) return;
    process.stderr.write(line + "\n");
  }

  function logToStderr(msg: string, level: LogLevel): void {
    const prefix = level === "error" ? "✗" : level === "warn" ? "!" : level === "success" ? "✓" : "·";
    process.stderr.write(`  ${prefix} ${msg}\n`);
  }

  return {
    showHeader(config, version) {
      store.setHeader(config, version ?? "unknown");
      ensureApp();
    },

    showProgress(label, current, total) {
      store.setScan({ label, current, total });
    },

    showMessage(msg, level) {
      // During interactive phases, log to stderr (won't disrupt Ink render).
      logToStderr(msg, level);
    },

    showSpinner(_label) {
      // No-op spinner: phase screens render their own progress.
      return () => {};
    },

    runSelect(repos) {
      const dirty = repos.filter((r) => r.status === "dirty");
      if (dirty.length === 0) return Promise.resolve([]);
      if (headless) return Promise.resolve(dirty);
      ensureApp();
      return new Promise<RepoState[] | null>((resolve) => {
        store.startSelect(repos, (paths) => {
          if (paths === null) resolve(null);
          else {
            const set = new Set(paths);
            resolve(repos.filter((r) => set.has(r.path)));
          }
        });
      });
    },

    async runPreview(initial, generate) {
      const previews: RepoPreview[] = initial.map((p) => ({
        repo: p.repo,
        groups: [],
        status: "pending",
      }));

      if (headless) {
        for (let i = 0; i < initial.length; i++) {
          writeStatus(`[preview ${i + 1}/${initial.length}] ${initial[i].repo.path}`);
          try {
            const result = await generate(i, initial[i].repo);
            previews[i] = { ...previews[i], groups: result.groups, status: result.status, skipReason: result.reason };
          } catch (err) {
            previews[i] = { ...previews[i], status: "error", skipReason: err instanceof Error ? err.message : String(err) };
          }
        }
        return { proceed: true, previews };
      }

      ensureApp();
      let resolveProceed!: (v: { proceed: boolean; previews: RepoPreview[] }) => void;
      const done = new Promise<{ proceed: boolean; previews: RepoPreview[] }>((res) => { resolveProceed = res; });
      store.startPreview(previews, (proceed) => {
        resolveProceed({ proceed, previews: store.get().previews });
      });

      for (let i = 0; i < initial.length; i++) {
        store.updatePreview(i, { status: "generating" });
        try {
          const result = await generate(i, initial[i].repo);
          store.updatePreview(i, {
            groups: result.groups,
            status: result.status,
            skipReason: result.reason,
          });
        } catch (err) {
          store.updatePreview(i, {
            status: "error",
            skipReason: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return done;
    },

    async runExecute(plan, runner) {
      const execRepos: ExecRepoState[] = plan.map((p) => ({
        repo: p.repo,
        steps: [],
        status: "pending",
      }));
      if (!headless) {
        ensureApp();
        store.startExecute(execRepos);
      } else {
        // headless: still mutate store for ops, no rendering
        store.startExecute(execRepos);
      }

      const summary: DoneSummary = {
        total: plan.length,
        committed: 0,
        pushed: 0,
        failed: 0,
        skipped: 0,
        failures: [],
        skips: [],
      };

      for (let i = 0; i < plan.length; i++) {
        if (store.get().abortRequested) {
          store.updateExecRepo(i, { status: "skipped" });
          summary.skipped++;
          summary.skips.push({ repo: plan[i].repo.path, reason: "사용자 중단" });
          continue;
        }

        store.setExecCursor(i);
        store.updateExecRepo(i, { status: "running" });
        if (headless) writeStatus(`[exec ${i + 1}/${plan.length}] ${plan[i].repo.path}`);

        const ops: ExecOps = {
          addStep: (kind, label) => {
            const stepIdx = store.get().execRepos[i].steps.length;
            store.pushExecStep(i, { kind, label, status: "running" });
            return stepIdx;
          },
          updateStep: (stepIdx, status, detail) => {
            store.updateExecStep(i, stepIdx, { status, detail });
          },
          setStatus: (status) => {
            store.updateExecRepo(i, { status });
          },
          isAborted: () => store.get().abortRequested,
        };

        try {
          await runner(i, plan[i].repo, plan[i].groups, ops);
          const finalStatus = store.get().execRepos[i].status;
          if (finalStatus === "running") {
            store.updateExecRepo(i, { status: "done" });
          }

          const repoState = store.get().execRepos[i];
          if (repoState.status === "done") {
            const commitSteps = repoState.steps.filter((s) => s.kind === "commit" && s.status === "ok").length;
            const pushSteps = repoState.steps.filter((s) => s.kind === "push" && s.status === "ok").length;
            summary.committed += commitSteps;
            summary.pushed += pushSteps;
          } else if (repoState.status === "failed") {
            summary.failed++;
            const failStep = repoState.steps.find((s) => s.status === "fail");
            summary.failures.push({
              repo: plan[i].repo.path,
              reason: failStep?.detail ?? failStep?.label ?? "unknown",
            });
          } else if (repoState.status === "skipped") {
            summary.skipped++;
            const skipStep = repoState.steps.find((s) => s.status === "skip");
            summary.skips.push({
              repo: plan[i].repo.path,
              reason: skipStep?.detail ?? skipStep?.label ?? "skipped",
            });
          }
        } catch (err) {
          store.updateExecRepo(i, { status: "failed" });
          summary.failed++;
          summary.failures.push({
            repo: plan[i].repo.path,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return summary;
    },

    runDone(summary) {
      if (headless) {
        const lines = [
          "",
          "── 완료 ──",
          `commit ${summary.committed} · push ${summary.pushed} · fail ${summary.failed} · skip ${summary.skipped} / total ${summary.total}`,
        ];
        for (const f of summary.failures) lines.push(`  ✗ ${f.repo} — ${f.reason}`);
        for (const s of summary.skips) lines.push(`  — ${s.repo} — ${s.reason}`);
        process.stdout.write(lines.join("\n") + "\n");
        return Promise.resolve();
      }
      ensureApp();
      return new Promise<void>((resolve) => {
        store.startDone(summary, resolve);
      });
    },

    cleanup() {
      appInstance?.unmount();
    },
  };
}
