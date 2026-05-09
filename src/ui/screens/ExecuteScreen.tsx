import { Box, Text, useInput } from "ink";
import { store, useUi } from "../store.js";
import { shortRepoPath } from "../helpers.js";
import { cwTruncate, displayWidth } from "../width.js";
import { useTerminalSize } from "../useTerminalSize.js";
import type { ExecRepoState, ExecStep } from "../store.js";

export function ExecuteScreen() {
  const execRepos = useUi((s) => s.execRepos);
  const cursor = useUi((s) => s.execCursor);
  const abortRequested = useUi((s) => s.abortRequested);
  const { columns, rows } = useTerminalSize();

  useInput((input, key) => {
    if (key.escape || input === "q" || input === "Q") return store.requestAbort();
  });

  const total = execRepos.length;
  const done = execRepos.filter((r) => r.status === "done" || r.status === "failed" || r.status === "skipped").length;
  const failed = execRepos.filter((r) => r.status === "failed").length;
  const skipped = execRepos.filter((r) => r.status === "skipped").length;

  const viewport = Math.max(8, rows - 8);
  const start = computeViewStart(cursor, total, viewport);
  const visible = execRepos.slice(start, start + viewport);
  const innerWidth = Math.max(40, columns - 4);

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}>
        <Text bold color="cyan">실행 중</Text>
        <Text dimColor>  ({done}/{total} 완료, {failed} 실패, {skipped} 건너뜀)</Text>
        {abortRequested && <Text color="yellow"> · 중단 요청됨 (현재 작업 끝나면 정지)</Text>}
      </Box>
      <Box flexDirection="column">
        {visible.map((r, i) => (
          <ExecRepoRow key={r.repo.path} state={r} index={start + i} focused={start + i === cursor} width={innerWidth} />
        ))}
      </Box>
      {total > viewport && (
        <Box marginTop={1}>
          <Text dimColor>... {total - viewport - start} more</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>ESC/q 중단 요청</Text>
      </Box>
    </Box>
  );
}

function ExecRepoRow({ state, index, focused, width }: { state: ExecRepoState; index: number; focused: boolean; width: number }) {
  const icon = repoIcon(state.status);
  const color = repoColor(state.status);
  const name = shortRepoPath(state.repo.path);
  const stepSummary = state.steps
    .map((s) => stepBadge(s))
    .join(" ");
  const head = `[${String(index + 1).padStart(2)}] ${icon} ${name}`;
  const headTruncated = cwTruncate(head, Math.floor(width * 0.55));
  const headPad = Math.floor(width * 0.55) - displayWidth(headTruncated);
  const tail = stepSummary ? `  ${stepSummary}` : "";
  const tailTruncated = cwTruncate(tail, width - displayWidth(headTruncated) - headPad);

  return (
    <Text color={color} inverse={focused}>
      {headTruncated}{" ".repeat(Math.max(0, headPad))}{tailTruncated}
    </Text>
  );
}

function stepBadge(step: ExecStep): string {
  const icon = stepIcon(step.status);
  return `${icon}${step.label}`;
}

function stepIcon(s: ExecStep["status"]): string {
  if (s === "ok") return "✓";
  if (s === "fail") return "✗";
  if (s === "skip") return "—";
  if (s === "running") return "⏳";
  return "·";
}

function repoIcon(s: ExecRepoState["status"]): string {
  if (s === "done") return "✓";
  if (s === "failed") return "✗";
  if (s === "skipped") return "—";
  if (s === "running") return "⏳";
  return "·";
}

function repoColor(s: ExecRepoState["status"]): string | undefined {
  if (s === "done") return "green";
  if (s === "failed") return "red";
  if (s === "skipped") return "gray";
  if (s === "running") return "cyan";
  return undefined;
}

function computeViewStart(cursorIdx: number, total: number, viewport: number): number {
  if (total <= viewport) return 0;
  const maxStart = total - viewport;
  const desired = cursorIdx - Math.floor(viewport / 2);
  return Math.max(0, Math.min(maxStart, desired));
}

