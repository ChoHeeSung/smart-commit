import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import { useUi } from "../store.js";

export function HeaderPanel() {
  const header = useUi((s) => s.header);
  if (!header) return null;

  const { config, version } = header;

  return (
    <Box flexDirection="column" alignItems="center" paddingY={0}>
      <Gradient name="cristal">
        <BigText text="smart commit" font="tiny" />
      </Gradient>
      <Text>
        <Text dimColor>◆ v{version} · </Text>
        <Text color="cyan">{config.ai.primary} → {config.ai.fallback}</Text>
        <Text dimColor> · {config.commit.style} · {config.commit.language} ◆</Text>
      </Text>
    </Box>
  );
}
