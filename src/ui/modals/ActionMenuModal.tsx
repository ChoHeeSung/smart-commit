import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { GroupAction } from "../../types.js";
import { t } from "../../i18n.js";

interface Props {
  onSubmit: (action: GroupAction) => void;
}

export function ActionMenuModal({ onSubmit }: Props) {
  const m = t();
  const items: Array<{ label: string; value: GroupAction; key: string }> = [
    { label: m.actionCommit, value: "commit", key: "commit" },
    { label: m.actionSkipGroup, value: "skip-group", key: "skip-group" },
    { label: m.actionSkipRepo, value: "skip-repo", key: "skip-repo" },
    { label: m.actionExit, value: "exit", key: "exit" },
  ];

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">▶ {m.selectGroupAction}</Text>
      <SelectInput items={items} onSelect={(item) => onSubmit(item.value)} />
    </Box>
  );
}
