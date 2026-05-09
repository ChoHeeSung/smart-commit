import { Box, Text } from "ink";
import { useUi } from "./store.js";
import { ScanScreen } from "./screens/ScanScreen.js";
import { SelectScreen } from "./screens/SelectScreen.js";
import { PreviewScreen } from "./screens/PreviewScreen.js";
import { ExecuteScreen } from "./screens/ExecuteScreen.js";
import { DoneScreen } from "./screens/DoneScreen.js";
import { useTerminalSize } from "./useTerminalSize.js";
import { t } from "../i18n.js";

export function App() {
  const phase = useUi((s) => s.phase);
  const { rows } = useTerminalSize();
  const appHeight = Math.max(20, rows - 1);

  return (
    <Box flexDirection="column" height={appHeight}>
      <Header />
      <Box flexDirection="column" flexGrow={1}>
        {phase === "scan" && <ScanScreen />}
        {phase === "select" && <SelectScreen />}
        {phase === "preview" && <PreviewScreen />}
        {phase === "execute" && <ExecuteScreen />}
        {phase === "done" && <DoneScreen />}
      </Box>
    </Box>
  );
}

function Header() {
  const header = useUi((s) => s.header);
  const phase = useUi((s) => s.phase);
  const m = t();
  if (!header) return null;
  const { config, version } = header;
  const phaseLabel: Record<string, string> = {
    scan: "스캔",
    select: "선택",
    preview: "미리보기",
    execute: "실행",
    done: "완료",
  };
  return (
    <Box paddingX={2} paddingY={0} flexDirection="column">
      <Text>
        <Text bold color="cyan">smart-commit</Text>
        <Text dimColor> v{version}  ·  </Text>
        <Text>{m.aiLabel} </Text>
        <Text color="green">{config.ai.primary}</Text>
        <Text dimColor> ({m.fallbackLabel} {config.ai.fallback})</Text>
        <Text dimColor>  ·  </Text>
        <Text>단계 </Text>
        <Text color="yellow">{phaseLabel[phase] ?? phase}</Text>
      </Text>
      <Text dimColor>{"─".repeat(60)}</Text>
    </Box>
  );
}
