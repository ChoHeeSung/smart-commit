import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { PushAction } from "../../types.js";
import { t } from "../../i18n.js";

interface Props {
  commitCount: number;
  onSubmit: (action: PushAction) => void;
}

export function PushMenuModal({ commitCount, onSubmit }: Props) {
  const m = t();
  const items: Array<{ label: string; value: PushAction; key: string }> = [
    { label: m.actionPush, value: "push", key: "push" },
    { label: m.actionKeepLocal, value: "keep-local", key: "keep-local" },
    { label: m.actionExit, value: "exit", key: "exit" },
  ];

  return (
    <Box flexDirection="column">
      <Text dimColor>{m.pushReadyHeader(commitCount)}</Text>
      <Text bold color="cyan">▶ {m.selectPushAction}</Text>
      <SelectInput items={items} onSelect={(item) => onSubmit(item.value)} />
    </Box>
  );
}
