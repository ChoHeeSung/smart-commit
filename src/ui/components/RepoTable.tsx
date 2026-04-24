import { Box, Text } from "ink";
import type { RepoState } from "../../types.js";
import { t } from "../../i18n.js";
import { shortRepoPath, changeSummary, statusText } from "../helpers.js";

interface Props {
  repos: RepoState[];
}

const W_NUM = 4;
const W_REPO = 28;
const W_BRANCH = 14;
const W_CHANGES = 13;

export function RepoTable({ repos }: Props) {
  const m = t();
  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column" marginY={1}>
      <Box>
        <Box width={W_NUM}><Text bold dimColor>{m.thNum}</Text></Box>
        <Box width={W_REPO}><Text bold dimColor>{m.thRepo}</Text></Box>
        <Box width={W_BRANCH}><Text bold dimColor>{m.thBranch}</Text></Box>
        <Box width={W_CHANGES}><Text bold dimColor>{m.thChanges}</Text></Box>
        <Text bold dimColor>{m.thStatus}</Text>
      </Box>
      {repos.map((repo, i) => <TableRow key={repo.path} repo={repo} index={i + 1} />)}
    </Box>
  );
}

function TableRow({ repo, index }: { repo: RepoState; index: number }) {
  const m = t();
  const color = repo.status === "dirty" ? "yellow" : undefined;
  return (
    <Box>
      <Box width={W_NUM}><Text color={color}>{String(index)}</Text></Box>
      <Box width={W_REPO}><Text color={color} wrap="truncate-end">{shortRepoPath(repo.path)}</Text></Box>
      <Box width={W_BRANCH}><Text color={color} wrap="truncate-end">{repo.branch}</Text></Box>
      <Box width={W_CHANGES}><Text color={color}>{changeSummary(repo, m)}</Text></Box>
      <Text color={color}>{statusText(repo.status, m)}</Text>
      {!repo.hasRemote && <Text dimColor> [local]</Text>}
    </Box>
  );
}
