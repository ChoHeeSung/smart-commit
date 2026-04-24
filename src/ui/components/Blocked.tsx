import { Box, Text } from "ink";
import type { BlockedFile, RepoState } from "../../types.js";
import { t } from "../../i18n.js";
import { shortRepoPath, blockedReasonText } from "../helpers.js";

interface Props {
  repo: RepoState;
  files: BlockedFile[];
}

export function Blocked({ repo, files }: Props) {
  const m = t();
  return (
    <Box flexDirection="column" marginY={1}>
      <Text color="red">✖ {shortRepoPath(repo.path, 1)}: {m.blocked}</Text>
      {files.map((b) => (
        <Box key={b.file.path}>
          <Text color="red">    - {b.file.path}</Text>
          <Text dimColor> [{blockedReasonText(b.reason, m)}]</Text>
        </Box>
      ))}
    </Box>
  );
}
