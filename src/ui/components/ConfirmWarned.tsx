import { Box, Text } from "ink";
import type { FileChange, RepoState } from "../../types.js";
import { t } from "../../i18n.js";
import { shortRepoPath } from "../helpers.js";
import { Confirm } from "./Confirm.js";

interface Props {
  repo: RepoState;
  files: FileChange[];
  onSubmit: (yes: boolean) => void;
}

export function ConfirmWarned({ repo, files, onSubmit }: Props) {
  const m = t();
  const title = (
    <Text bold color="yellow">⚠ {shortRepoPath(repo.path, 1)}: {m.warnFiles}</Text>
  );
  const body = (
    <Box flexDirection="column">
      {files.map((f) => (
        <Text color="yellow" key={f.path}>    - {f.path}</Text>
      ))}
      <Box marginTop={1}><Text>{m.includeQuestion}</Text></Box>
    </Box>
  );
  return <Confirm title={title} body={body} onSubmit={onSubmit} />;
}
