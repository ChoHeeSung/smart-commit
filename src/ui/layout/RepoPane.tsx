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

const PREFIX_CHARS = 5; // " X X "
const MIN_REPO = 16;
const MIN_BRANCH = 6;
const MIN_CHANGES = 6;
const VERT_CHROME = 12; // header/footer/border/헤더정보 등 가로줄 점유량

function computeLayout(columns: number, rows: number): Layout {
  const paneInner = Math.max(30, Math.floor(columns / 2) - 4); // 좌측 50% 중 border/padding 제외
  const available = Math.max(MIN_REPO + MIN_BRANCH + MIN_CHANGES, paneInner - PREFIX_CHARS);
  const colRepo = Math.max(MIN_REPO, Math.floor(available * 0.55));
  const colBranch = Math.max(MIN_BRANCH, Math.floor(available * 0.22));
  const colChanges = Math.max(MIN_CHANGES, available - colRepo - colBranch);
  const viewport = Math.max(6, rows - VERT_CHROME);
  return { viewport, colRepo, colBranch, colChanges };
}

export function RepoPane() {
  const repos = useUi((s) => s.repos);
  const phase = useUi((s) => s.phase);
  const cursor = useUi((s) => s.cursor);
  const selection = useUi((s) => s.selection);
  const activity = useUi((s) => s.activity);
  const { columns, rows } = useTerminalSize();
  const layout = computeLayout(columns, rows);

  const dirtyCount = repos.filter((r) => r.status === "dirty").length;
  const viewStart = computeViewStart(cursor, repos.length, layout.viewport);
  const end = Math.min(repos.length, viewStart + layout.viewport);
  const visible = repos.slice(viewStart, end);
  const above = viewStart;
  const below = repos.length - end;
  const currentPath = activity?.repoPath ?? null;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>
        <Text color="cyan">Repos</Text>
        <Text dimColor> ({repos.length} · {dirtyCount} changed)</Text>
      </Text>
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
  const mark = selectMarker(repo, checked, active, phase);
  const remoteTag = repo.hasRemote ? " " : "*";
  const repoName = shortRepoPath(repo.path) + " " + remoteTag;
  const line =
    ` ${cursor} ${mark} ` +
    cellPad(repoName, layout.colRepo) +
    cellPad(repo.branch, layout.colBranch) +
    cellPad(changeText(repo), layout.colChanges);
  const color = rowColor(repo, focused, checked, active, phase);
  const dim = !focused && !active && !checked && repo.status !== "dirty";
  return <Text color={color} dimColor={dim}>{line}</Text>;
}

function selectMarker(
  repo: RepoState, checked: boolean, active: boolean, phase: string,
): string {
  if (active) return "@";
  if (phase === "selecting" && repo.status === "dirty") return checked ? "x" : "o";
  if (repo.status === "dirty") return "*";
  return ".";
}

function changeText(repo: RepoState): string {
  if (repo.files.length > 0) return `${repo.files.length} files`;
  if (repo.unpushedCommits > 0) return `up ${repo.unpushedCommits}`;
  return "-";
}

function rowColor(
  repo: RepoState, focused: boolean, checked: boolean, active: boolean, phase: string,
): "cyan" | "yellow" | "green" | undefined {
  if (focused) return "cyan";
  if (active) return "green";
  if (checked && phase === "selecting") return "yellow";
  if (repo.status === "dirty") return "yellow";
  return undefined;
}

function computeViewStart(cursorIdx: number, total: number, viewport: number): number {
  if (total <= viewport) return 0;
  const maxStart = total - viewport;
  const desired = cursorIdx - Math.floor(viewport / 2);
  return Math.max(0, Math.min(maxStart, desired));
}
