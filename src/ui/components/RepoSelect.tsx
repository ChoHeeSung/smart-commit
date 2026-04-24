import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { RepoState } from "../../types.js";
import { t } from "../../i18n.js";
import { shortRepoPath } from "../helpers.js";
import { cellPad } from "../width.js";

interface Props {
  repos: RepoState[];
  onSubmit: (selected: RepoState[]) => void;
  viewportSize?: number;
}

const COL_REPO = 32;
const COL_BRANCH = 16;
const COL_FILES = 10;

export function RepoSelect({ repos, onSubmit, viewportSize = 15 }: Props) {
  const m = t();
  const [cursor, setCursor] = useState(0);
  const [viewStart, setViewStart] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(
    new Set(repos.map((_, i) => i))
  );

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      const next = (cursor - 1 + repos.length) % repos.length;
      setCursor(next);
      setViewStart((vs) => keepCursorInView(next, vs, viewportSize, repos.length));
      return;
    }
    if (key.downArrow || input === "j") {
      const next = (cursor + 1) % repos.length;
      setCursor(next);
      setViewStart((vs) => keepCursorInView(next, vs, viewportSize, repos.length));
      return;
    }
    if (input === " ") {
      setChecked((s) => toggleIndex(s, cursor));
      return;
    }
    if (input === "a") {
      setChecked((s) => toggleAll(s, repos.length));
      return;
    }
    if (key.return) {
      onSubmit(repos.filter((_, i) => checked.has(i)));
      return;
    }
    if (key.escape || input === "q") onSubmit([]);
  });

  const end = Math.min(repos.length, viewStart + viewportSize);
  const visible = repos.slice(viewStart, end);

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold>{m.selectRepos} <Text dimColor>{m.selectReposHint}</Text></Text>
      <Text dimColor>  Showing {viewStart + 1}–{end} of {repos.length}</Text>
      <Box marginTop={1} flexDirection="column">
        {visible.map((repo, i) => {
          const globalIdx = viewStart + i;
          return (
            <SelectRow
              key={repo.path}
              repo={repo}
              focused={globalIdx === cursor}
              checked={checked.has(globalIdx)}
            />
          );
        })}
      </Box>
    </Box>
  );
}

function SelectRow({
  repo, focused, checked,
}: { repo: RepoState; focused: boolean; checked: boolean }) {
  const mark = checked ? "●" : "○";
  const arrow = focused ? "▸" : " ";
  const color = focused ? "cyan" : checked ? "yellow" : undefined;
  const dim = !focused && !checked;

  const line =
    ` ${arrow} ${mark} ` +
    cellPad(shortRepoPath(repo.path), COL_REPO) +
    cellPad(repo.branch, COL_BRANCH) +
    cellPad(`${repo.files.length} files`, COL_FILES);

  return <Text color={color} dimColor={dim}>{line}</Text>;
}

function keepCursorInView(
  cursor: number, viewStart: number, viewportSize: number, total: number,
): number {
  if (cursor < viewStart) return cursor;
  if (cursor >= viewStart + viewportSize) return cursor - viewportSize + 1;
  // Clamp against end
  const maxStart = Math.max(0, total - viewportSize);
  return Math.min(viewStart, maxStart);
}

function toggleIndex(s: Set<number>, idx: number): Set<number> {
  const n = new Set(s);
  if (n.has(idx)) n.delete(idx);
  else n.add(idx);
  return n;
}

function toggleAll(s: Set<number>, total: number): Set<number> {
  if (s.size === total) return new Set();
  return new Set(Array.from({ length: total }, (_, i) => i));
}
