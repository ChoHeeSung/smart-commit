import { Box, Text } from "ink";
import type { RepoState } from "../../types.js";
import { useUi } from "../store.js";
import { shortRepoPath } from "../helpers.js";
import { cellPad } from "../width.js";

const VIEWPORT = 14;
const COL_REPO = 22;
const COL_BRANCH = 7;
const COL_CHANGES = 6;

export function RepoPane() {
  const repos = useUi((s) => s.repos);
  const phase = useUi((s) => s.phase);
  const cursor = useUi((s) => s.cursor);
  const selection = useUi((s) => s.selection);
  const activity = useUi((s) => s.activity);

  const dirtyCount = repos.filter((r) => r.status === "dirty").length;
  const viewStart = computeViewStart(cursor, repos.length);
  const end = Math.min(repos.length, viewStart + VIEWPORT);
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
      {repos.length > VIEWPORT && (
        <Text dimColor>Showing {viewStart + 1}–{end} of {repos.length}</Text>
      )}
      {above > 0 && <Text dimColor>   ↑ {above} more</Text>}
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
          />
        );
      })}
      {below > 0 && <Text dimColor>   ↓ {below} more</Text>}
    </Box>
  );
}

interface RowProps {
  repo: RepoState;
  focused: boolean;
  checked: boolean;
  active: boolean;
  phase: string;
}

function RepoRow({ repo, focused, checked, active, phase }: RowProps) {
  const cursor = focused ? "▸" : " ";
  const mark = selectMarker(repo, checked, active, phase);
  const repoName = shortRepoPath(repo.path) + (repo.hasRemote ? "" : " ·");
  const line =
    ` ${cursor} ${mark} ` +
    cellPad(repoName, COL_REPO) +
    cellPad(repo.branch, COL_BRANCH) +
    cellPad(changeText(repo), COL_CHANGES);
  const color = rowColor(repo, focused, checked, active, phase);
  const dim = !focused && !active && !checked && repo.status !== "dirty";
  return <Text color={color} dimColor={dim}>{line}</Text>;
}

function selectMarker(
  repo: RepoState, checked: boolean, active: boolean, phase: string,
): string {
  if (active) return "⠿";
  if (phase === "selecting" && repo.status === "dirty") return checked ? "●" : "○";
  if (repo.status === "dirty") return "●";
  return "·";
}

function changeText(repo: RepoState): string {
  if (repo.files.length > 0) return `${repo.files.length} files`;
  if (repo.unpushedCommits > 0) return `⇡${repo.unpushedCommits}`;
  return "—";
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

function computeViewStart(cursor: number, total: number): number {
  if (total <= VIEWPORT) return 0;
  const maxStart = total - VIEWPORT;
  const desired = cursor - Math.floor(VIEWPORT / 2);
  return Math.max(0, Math.min(maxStart, desired));
}
