import { Box, Text } from "ink";
import type { RepoState } from "../../types.js";
import { t } from "../../i18n.js";
import { shortRepoPath } from "../helpers.js";
import { Confirm } from "./Confirm.js";

interface Props {
  repo: RepoState;
  onSubmit: (yes: boolean) => void;
}

export function LfsInit({ repo, onSubmit }: Props) {
  const m = t();
  const title = <Text bold color="cyan">{m.lfsPromptTitle}</Text>;
  const body = (
    <Box flexDirection="column">
      <Text dimColor>     {m.lfsPromptDesc}</Text>
      <Text>     {shortRepoPath(repo.path, 1)}</Text>
    </Box>
  );
  return <Confirm title={title} body={body} onSubmit={onSubmit} />;
}
