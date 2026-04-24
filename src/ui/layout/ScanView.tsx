import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useUi } from "../store.js";

const BAR_WIDTH = 36;

export function ScanView() {
  const progress = useUi((s) => s.scanProgress);
  if (!progress) return null;

  const { label, current, total } = progress;
  const ratio = total > 0 ? current / total : 0;
  const percent = Math.min(100, Math.floor(ratio * 100));
  const filled = Math.min(BAR_WIDTH, Math.floor(ratio * BAR_WIDTH));
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const done = current >= total && total > 0;

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column" marginY={1}>
      <Box gap={1}>
        {done ? <Text color="green">✓</Text> : <Text color="cyan"><Spinner type="dots" /></Text>}
        <Text bold>{label}</Text>
      </Box>
      <Box gap={1} marginTop={1}>
        <Text color="cyan">{bar}</Text>
        <Text dimColor>{percent}%  ({current}/{total})</Text>
      </Box>
    </Box>
  );
}
