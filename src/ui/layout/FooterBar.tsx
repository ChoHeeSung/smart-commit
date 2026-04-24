import { Box, Text } from "ink";
import { useUi } from "../store.js";

export function FooterBar() {
  const phase = useUi((s) => s.phase);
  const hints = hintsForPhase(phase);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor wrap="truncate-end">{hints}</Text>
    </Box>
  );
}

function hintsForPhase(phase: string): string {
  if (phase === "selecting") {
    return "  [↑↓/jk] nav   [space] toggle   [a] all   [enter] confirm   [q] quit";
  }
  if (phase === "processing") {
    return "  processing…";
  }
  if (phase === "scanning") {
    return "  scanning repositories…";
  }
  if (phase === "done") {
    return "  ✓ all done · [q] quit";
  }
  return "  ready";
}
