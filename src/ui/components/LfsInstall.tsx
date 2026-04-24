import { Box, Text } from "ink";
import type { LfsInstallPlan } from "../../types.js";
import { t } from "../../i18n.js";
import { Confirm } from "./Confirm.js";

interface Props {
  plan: LfsInstallPlan;
  onSubmit: (yes: boolean) => void;
}

export function LfsInstall({ plan, onSubmit }: Props) {
  const m = t();
  const cmd = plan.installCommand.join(" ");
  const title = <Text bold color="yellow">⚠ {m.lfsNotInstalled}</Text>;
  const body = (
    <Box flexDirection="column">
      <Text>     OS: {plan.os}</Text>
      <Text>     {m.lfsInstallPrompt(plan.pm ?? "unknown", cmd)}</Text>
      {plan.needsSudo && (
        <Text color="yellow">     {m.lfsInstallSudoWarn}</Text>
      )}
    </Box>
  );
  return <Confirm title={title} body={body} onSubmit={onSubmit} />;
}
