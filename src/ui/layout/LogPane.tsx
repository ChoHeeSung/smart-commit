import { Box, Text } from "ink";
import type { LogEntry, LogLevel } from "../store.js";
import { useUi } from "../store.js";
import { useTerminalSize } from "../useTerminalSize.js";

// ASCII 고정 — 환경 무관 1 col
const ICON: Record<LogLevel, string> = {
  info: "i",
  success: "+",
  warn: "!",
  error: "x",
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
  const { rows } = useTerminalSize();
  if (phase === "idle" || phase === "scanning") return null;

  // 우측 pane: Activity가 상단 고정 분량 차지, Log는 남는 영역.
  // 전체 pane height ≈ rows - 12. Activity 약 12줄 → Log available ≈ rows - 24.
  const visible = Math.max(3, Math.min(log.length, rows - 24));
  const recent = log.slice(-visible);
  const hidden = log.length - recent.length;

  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Text bold color="cyan">Log <Text dimColor>({log.length})</Text></Text>
      {hidden > 0 && <Text dimColor>  ^ {hidden} earlier</Text>}
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
