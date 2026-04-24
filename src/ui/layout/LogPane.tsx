import { Box, Text } from "ink";
import type { LogEntry, LogLevel } from "../store.js";
import { useUi } from "../store.js";

const VISIBLE = 6;

const ICON: Record<LogLevel, string> = {
  info: "ℹ",
  success: "✓",
  warn: "⚠",
  error: "✖",
};

const COLOR: Record<LogLevel, "cyan" | "green" | "yellow" | "red"> = {
  info: "cyan",
  success: "green",
  warn: "yellow",
  error: "red",
};

export function LogPane() {
  const log = useUi((s) => s.log);
  const phase = useUi((s) => s.phase);
  if (phase === "idle" || phase === "scanning") return null;

  const recent = log.slice(-VISIBLE);
  const hidden = log.length - recent.length;

  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Text bold><Text color="cyan">Log</Text><Text dimColor> ({log.length})</Text></Text>
      {hidden > 0 && <Text dimColor>  ↑ {hidden} earlier</Text>}
      {recent.map((entry) => <LogRow key={entry.id} entry={entry} />)}
      {log.length === 0 && <Text dimColor>  No messages yet</Text>}
    </Box>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  return (
    <Box>
      <Text color={COLOR[entry.level]}>{ICON[entry.level]}</Text>
      <Text wrap="truncate-end"> {entry.text}</Text>
    </Box>
  );
}
