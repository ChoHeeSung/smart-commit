import { Box, Text } from "ink";
import type { LogEntry, LogLevel } from "../store.js";
import { useUi } from "../store.js";
import { useTerminalSize } from "../useTerminalSize.js";

interface Props {
  paneHeight: number;
}

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

// Activity 기본 예상 점유(heading + subject + body + files) = 약 14 줄
const ACTIVITY_BUDGET = 14;

export function LogPane({ paneHeight }: Props) {
  const log = useUi((s) => s.log);
  const phase = useUi((s) => s.phase);
  const { columns } = useTerminalSize();
  if (phase === "idle" || phase === "scanning") return null;

  const paneWidth = Math.floor(columns / 2) - 2;
  const available = Math.max(2, paneHeight - ACTIVITY_BUDGET - 2); // heading 1 + earlier 1
  const visibleCount = Math.max(2, Math.min(log.length, available));
  const recent = log.slice(-visibleCount);
  const hidden = log.length - recent.length;

  return (
    <Box flexDirection="column" marginTop={1}>
      <HeadingBar width={paneWidth} label="LOG" count={`(${log.length})`} />
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

function HeadingBar({ width, label, count }: { width: number; label: string; count: string }) {
  const line = ` ${label} ${count} `;
  const fill = Math.max(0, width - line.length);
  return (
    <Text>
      <Text bold inverse color="cyan">{line}</Text>
      <Text dimColor>{" ".repeat(fill)}</Text>
    </Text>
  );
}
