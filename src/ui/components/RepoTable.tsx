import { Box, Text } from "ink";
import type { RepoState } from "../../types.js";
import { t } from "../../i18n.js";
import { shortRepoPath, changeSummary, statusText } from "../helpers.js";
import { cellPad } from "../width.js";

interface Props {
  repos: RepoState[];
  maxRows?: number;
}

const COL_NUM = 4;
const COL_REPO = 30;
const COL_BRANCH = 14;
const COL_CHANGES = 13;

export function RepoTable({ repos, maxRows = 20 }: Props) {
  const m = t();
  const visible = repos.slice(0, maxRows);
  const hidden = repos.length - visible.length;

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column" marginY={1}>
      <HeaderRow m={m} />
      {visible.map((repo, i) => <DataRow key={repo.path} repo={repo} index={i + 1} />)}
      {hidden > 0 && (
        <Text dimColor>  … and {hidden} more</Text>
      )}
    </Box>
  );
}

function HeaderRow({ m }: { m: ReturnType<typeof t> }) {
  const line =
    cellPad(m.thNum, COL_NUM) +
    cellPad(m.thRepo, COL_REPO) +
    cellPad(m.thBranch, COL_BRANCH) +
    cellPad(m.thChanges, COL_CHANGES) +
    m.thStatus;
  return <Text bold dimColor>{line}</Text>;
}

function DataRow({ repo, index }: { repo: RepoState; index: number }) {
  const m = t();
  const color = repo.status === "dirty" ? "yellow" : undefined;
  const repoCell = shortRepoPath(repo.path) + (repo.hasRemote ? "" : " ·");
  const line =
    cellPad(String(index), COL_NUM) +
    cellPad(repoCell, COL_REPO) +
    cellPad(repo.branch, COL_BRANCH) +
    cellPad(changeSummary(repo, m), COL_CHANGES) +
    statusText(repo.status, m);
  return <Text color={color}>{line}</Text>;
}
