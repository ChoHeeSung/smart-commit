import { Box, Text } from "ink";
import Spinner from "ink-spinner";

interface Props {
  label: string;
  current: number;
  total: number;
}

const BAR_WIDTH = 28;

export function ScanDashboard({ label, current, total }: Props) {
  const ratio = total > 0 ? current / total : 0;
  const percent = Math.min(100, Math.floor(ratio * 100));
  const filled = Math.min(BAR_WIDTH, Math.floor(ratio * BAR_WIDTH));
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const done = current >= total;

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column" marginY={1}>
      <Box gap={1}>
        {done ? <Text color="green">✓</Text> : <Text color="cyan"><Spinner type="dots" /></Text>}
        <Text bold>{label}</Text>
      </Box>
      <Box gap={1} marginTop={1}>
        <Text color="cyan">{bar}</Text>
        <Text dimColor>{percent}%</Text>
        <Text dimColor>({current}/{total})</Text>
      </Box>
    </Box>
  );
}
