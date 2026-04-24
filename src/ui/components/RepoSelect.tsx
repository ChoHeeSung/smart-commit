import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { RepoState } from "../../types.js";
import { t } from "../../i18n.js";
import { shortRepoPath } from "../helpers.js";

interface Props {
  repos: RepoState[];
  onSubmit: (selected: RepoState[]) => void;
}

export function RepoSelect({ repos, onSubmit }: Props) {
  const m = t();
  const [cursor, setCursor] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(
    new Set(repos.map((_, i) => i))
  );

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c - 1 + repos.length) % repos.length);
      return;
    }
    if (key.downArrow) {
      setCursor((c) => (c + 1) % repos.length);
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

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold>{m.selectRepos} <Text dimColor>{m.selectReposHint}</Text></Text>
      <Box marginTop={1} flexDirection="column">
        {repos.map((repo, i) => (
          <RepoSelectRow
            key={repo.path}
            repo={repo}
            focused={i === cursor}
            checked={checked.has(i)}
          />
        ))}
      </Box>
    </Box>
  );
}

function RepoSelectRow({
  repo, focused, checked,
}: { repo: RepoState; focused: boolean; checked: boolean }) {
  const mark = checked ? "●" : "○";
  const arrow = focused ? "▸" : " ";
  const color = focused ? "cyan" : checked ? "yellow" : undefined;
  const dim = !focused && !checked;
  return (
    <Text color={color} dimColor={dim}>
      {` ${arrow} ${mark} ${shortRepoPath(repo.path)} (${repo.branch}, ${repo.files.length} files)`}
    </Text>
  );
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
