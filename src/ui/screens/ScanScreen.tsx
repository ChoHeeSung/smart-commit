import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useUi } from "../store.js";
import { t } from "../../i18n.js";
import { cwTruncate, displayWidth } from "../width.js";
import { useTerminalSize } from "../useTerminalSize.js";

export function ScanScreen() {
  const scan = useUi((s) => s.scan);
  const { columns } = useTerminalSize();
  const m = t();

  if (!scan) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text> {m.scanning}</Text>
        </Text>
      </Box>
    );
  }

  const pct = scan.total > 0 ? Math.floor((scan.current / scan.total) * 100) : 0;
  const barWidth = Math.max(10, Math.min(40, columns - 30));
  const filled = Math.floor((barWidth * pct) / 100);
  const bar = "█".repeat(filled) + "░".repeat(Math.max(0, barWidth - filled));
  const labelMax = Math.max(10, columns - barWidth - 20);
  const label = cwTruncate(scan.label, labelMax);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text>
        <Text color="cyan"><Spinner type="dots" /></Text>
        <Text> {m.scanning}</Text>
      </Text>
      <Box marginTop={1}>
        <Text>
          <Text color="green">{bar}</Text>
          <Text dimColor> {String(scan.current).padStart(3)}/{scan.total} ({pct}%)</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{label}{" ".repeat(Math.max(0, labelMax - displayWidth(label)))}</Text>
      </Box>
    </Box>
  );
}
