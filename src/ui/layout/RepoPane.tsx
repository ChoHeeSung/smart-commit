import { Box, Text } from "ink";
import type { RepoState } from "../../types.js";
import { useUi } from "../store.js";
import { shortRepoPath } from "../helpers.js";
import { cellPad } from "../width.js";
import { useTerminalSize } from "../useTerminalSize.js";

interface Layout {
  viewport: number;
  colRepo: number;
  colBranch: number;
  colChanges: number;
}

// Prefix 구조 (모두 ASCII 고정폭):
//   " "         1  좌측 여백
//   "cursor"    1  focused=">" / unfocused=" "
//   " "         1
//   "[x]"       3  checkbox (selectable & checked="[x]", unchecked="[ ]", unselectable="   ")
//   " "         1
// 총 7 chars
const PREFIX_CHARS = 7;
const MIN_REPO = 18;
const MIN_BRANCH = 7;
const MIN_CHANGES = 7;

// 상단 타이틀 2줄 + (선택적) showing 1줄 + (선택적) 위아래 "more" 2줄 → 최대 5줄
const HEADER_ROWS = 5;

function computeLayout(columns: number, paneHeight: number): Layout {
  const paneInner = Math.max(30, Math.floor(columns / 2) - 4);
  const available = Math.max(MIN_REPO + MIN_BRANCH + MIN_CHANGES, paneInner - PREFIX_CHARS);
  const colRepo = Math.max(MIN_REPO, Math.floor(available * 0.55));
  const colBranch = Math.max(MIN_BRANCH, Math.floor(available * 0.22));
  const colChanges = Math.max(MIN_CHANGES, available - colRepo - colBranch);
  const viewport = Math.max(4, paneHeight - HEADER_ROWS);
  return { viewport, colRepo, colBranch, colChanges };
}

export function RepoPane() {
  const repos = useUi((s) => s.repos);
  const phase = useUi((s) => s.phase);
  const cursor = useUi((s) => s.cursor);
  const selection = useUi((s) => s.selection);
  const activity = useUi((s) => s.activity);
  const { columns, rows } = useTerminalSize();

  // App height = rows - 1, header panel ~ 7줄, footer ~ 2줄, 박스 border ~ 2줄
  const paneHeight = Math.max(10, rows - 12);
  const layout = computeLayout(columns, paneHeight);

  const dirtyCount = repos.filter((r) => r.status === "dirty").length;
  const viewStart = computeViewStart(cursor, repos.length, layout.viewport);
  const end = Math.min(repos.length, viewStart + layout.viewport);
  const visible = repos.slice(viewStart, end);
  const above = viewStart;
  const below = repos.length - end;
  const currentPath = activity?.repoPath ?? null;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan">Repos <Text dimColor>({repos.length} · {dirtyCount} changed)</Text></Text>
      {repos.length > layout.viewport && (
        <Text dimColor>Showing {viewStart + 1}-{end} of {repos.length}</Text>
      )}
      {above > 0 && <Text dimColor>   ^ {above} more</Text>}
      {visible.map((repo, i) => {
        const globalIdx = viewStart + i;
        return (
          <RepoRow
            key={repo.path}
            repo={repo}
            focused={phase === "selecting" && globalIdx === cursor}
            checked={selection.has(repo.path)}
            active={repo.path === currentPath}
            phase={phase}
            layout={layout}
          />
        );
      })}
      {below > 0 && <Text dimColor>   v {below} more</Text>}
    </Box>
  );
}

interface RowProps {
  repo: RepoState;
  focused: boolean;
  checked: boolean;
  active: boolean;
  phase: string;
  layout: Layout;
}

function RepoRow({ repo, focused, checked, active, phase, layout }: RowProps) {
  const cursor = focused ? ">" : " ";
  const checkbox = renderCheckbox(repo, checked, phase);
  const repoName = shortRepoPath(repo.path) + (repo.hasRemote ? "" : " [local]");
  const line =
    ` ${cursor} ${checkbox} ` +
    cellPad(repoName, layout.colRepo) +
    cellPad(repo.branch, layout.colBranch) +
    cellPad(changeText(repo), layout.colChanges);
  const { color, dim, inverse } = rowStyle(repo, focused, checked, active, phase);
  return <Text color={color} dimColor={dim} inverse={inverse}>{line}</Text>;
}

function renderCheckbox(repo: RepoState, checked: boolean, phase: string): string {
  if (phase === "selecting" && repo.status === "dirty") {
    return checked ? "[x]" : "[ ]";
  }
  if (repo.status === "dirty") return "[*]";
  return "   ";
}

function changeText(repo: RepoState): string {
  if (repo.files.length > 0) return `${repo.files.length} files`;
  if (repo.unpushedCommits > 0) return `up ${repo.unpushedCommits}`;
  return "-";
}

interface Style {
  color: "cyan" | "yellow" | "green" | undefined;
  dim: boolean;
  inverse: boolean;
}

function rowStyle(
  repo: RepoState, focused: boolean, checked: boolean, active: boolean, phase: string,
): Style {
  if (active) return { color: "green", dim: false, inverse: true };
  if (focused) return { color: "cyan", dim: false, inverse: false };
  if (phase === "selecting" && checked) return { color: "yellow", dim: false, inverse: false };
  if (repo.status === "dirty") return { color: "yellow", dim: false, inverse: false };
  return { color: undefined, dim: true, inverse: false };
}

function computeViewStart(cursorIdx: number, total: number, viewport: number): number {
  if (total <= viewport) return 0;
  const maxStart = total - viewport;
  const desired = cursorIdx - Math.floor(viewport / 2);
  return Math.max(0, Math.min(maxStart, desired));
}
