import { Box, Text, useInput } from "ink";
import { store, useUi } from "../store.js";
import { cwTruncate } from "../width.js";
import { useTerminalSize } from "../useTerminalSize.js";

export function DoneScreen() {
  const summary = useUi((s) => s.summary);
  const { columns } = useTerminalSize();

  useInput(() => {
    store.finishDone();
  });

  if (!summary) return null;

  const innerW = Math.max(40, columns - 4);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan">완료</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text bold color="green">✓ {summary.committed}</Text>
          <Text> 커밋  ·  </Text>
          <Text bold color="cyan">⇡ {summary.pushed}</Text>
          <Text> 푸시  ·  </Text>
          <Text bold color="red">✗ {summary.failed}</Text>
          <Text> 실패  ·  </Text>
          <Text bold color="gray">— {summary.skipped}</Text>
          <Text> 건너뜀  /  전체 {summary.total}</Text>
        </Text>
      </Box>

      {summary.failures.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="red">실패 레포</Text>
          {summary.failures.map((f, i) => (
            <Text key={i} color="red">  ✗ {cwTruncate(`${f.repo} — ${f.reason}`, innerW - 2)}</Text>
          ))}
        </Box>
      )}

      {summary.skips.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">건너뛴 레포</Text>
          {summary.skips.map((s, i) => (
            <Text key={i} dimColor>  — {cwTruncate(`${s.repo} — ${s.reason}`, innerW - 2)}</Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>아무 키나 눌러 종료</Text>
      </Box>
    </Box>
  );
}
