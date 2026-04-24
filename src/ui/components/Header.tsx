import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import type { SmartCommitConfig } from "../../types.js";
import { t } from "../../i18n.js";

interface Props {
  config: SmartCommitConfig;
  version: string;
}

export function Header({ config, version }: Props) {
  const m = t();
  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      <Gradient name="cristal">
        <BigText text="smart commit" font="tiny" />
      </Gradient>
      <Text dimColor>◆ AI-powered git automation · v{version} ◆</Text>
      <Box marginTop={1} gap={3}>
        <Meta label={m.aiLabel} value={`${config.ai.primary} → ${config.ai.fallback}`} />
        <Meta label={m.styleLabel} value={config.commit.style} />
        <Meta label={m.langLabel} value={config.commit.language} />
      </Box>
    </Box>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Text>
      <Text dimColor>{label} </Text>
      <Text color="cyan">{value}</Text>
    </Text>
  );
}
