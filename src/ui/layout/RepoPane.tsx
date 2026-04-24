import { Box, Text } from "ink";
import type { RepoState } from "../../types.js";
import { useUi } from "../store.js";
import { shortRepoPath } from "../helpers.js";
import { cellPad } from "../width.js";
import { useTerminalSize } from "../useTerminalSize.js";

interface Props {
  contentHeight: number;
}

interface Layout {
  viewport: number;
  colRepo: number;
  colBranch: number;
  colChanges: number;
}

// Prefix: " cursor checkbox " → 1 + 1 + 1 + 3 + 1 = 7 chars (ASCII 고정폭)
const PREFIX = 7;
const MIN_REPO = 18;
const MIN_BRANCH = 6;
const MIN_CHANGES = 6;

// Heading bar(1) + repo count + showing line(최대 1) + up-more(최대 1) + down-more(최대 1)
const CHROME_ROWS = 4;

function computeLayout(columns: number, contentHeight: number): Layout {
  const paneInner = Math.max(30, Math.floor(columns / 2) - 2); // paddingRight 2 감안
  const available = Math.max(MIN_REPO + MIN_BRANCH + MIN_CHANGES, paneInner - PREFIX);
  const colRepo = Math.max(MIN_REPO, Math.floor(available * 0.55));
  const colBranch = Math.max(MIN_BRANCH, Math.floor(available * 0.22));
  const colChanges = Math.max(MIN_CHANGES, available - colRepo - colBranch);
  const viewport = Math.max(3, contentHeight - CHROME_ROWS);
  return { viewport, colRepo, colBranch, colChanges };
}

export function RepoPane({ contentHeight }: Props) {
  const repos = useUi((s) => s.repos);
  const phase = useUi((s) => s.phase);
  const cursor = useUi((s) => s.cursor);
  const selection = useUi((s) => s.selection);
  const activity = useUi((s) => s.activity);
  const { columns } = useTerminalSize();

  const layout = computeLayout(columns, contentHeight);
  const dirty = repos.filter((r) => r.status === "dirty").length;
  const viewStart = computeViewStart(cursor, repos.length, layout.viewport);
  const end = Math.min(repos.length, viewStart + layout.viewport);
  const visible = repos.slice(viewStart, end);
  const above = viewStart;
  const below = repos.length - end;
  const currentPath = activity?.repoPath ?? null;

  const paneWidth = Math.floor(columns / 2) - 2;

  return (
    <Box flexDirection="column">
      <HeadingBar
        width={paneWidth}
        label="REPOS"
        hint={`${repos.length} · ${dirty} changed  ·  Showing ${viewStart + 1}-${end} of ${repos.length}`}
      />
      {above > 0 ? <Text dimColor>   ^ {above} more</Text> : <Text> </Text>}
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
      {below > 0 ? <Text dimColor>   v {below} more</Text> : <Text> </Text>}
    </Box>
  );
}

function HeadingBar({ width, label, hint }: { width: number; label: string; hint: string }) {
  const line = ` ${label} `;
  const suffix = ` ${hint} `;
  const fill = Math.max(0, width - line.length - suffix.length);
  return (
    <Text>
      <Text bold inverse color="cyan">{line}</Text>
      <Text dimColor>{suffix}{" ".repeat(fill)}</Text>
    </Text>
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
