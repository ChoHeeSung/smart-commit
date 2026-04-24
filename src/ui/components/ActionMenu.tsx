import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { UserAction } from "../../types.js";
import { t } from "../../i18n.js";

interface Props {
  onSubmit: (action: UserAction) => void;
}

export function ActionMenu({ onSubmit }: Props) {
  const m = t();
  const items: Array<{ label: string; value: UserAction; key: string }> = [
    { label: m.actionPush, value: "push", key: "push" },
    { label: m.actionSkip, value: "skip", key: "skip" },
    { label: m.actionCancel, value: "cancel", key: "cancel" },
    { label: m.actionSkipRepo, value: "skip-repo", key: "skip-repo" },
    { label: m.actionExit, value: "exit", key: "exit" },
  ];

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="cyan">▶ {m.selectAction}</Text>
      <SelectInput items={items} onSelect={(item) => onSubmit(item.value)} />
    </Box>
  );
}
