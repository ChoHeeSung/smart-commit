import { Box, Text } from "ink";
import { t } from "../../i18n.js";

export function Complete() {
  const m = t();
  return (
    <Box marginY={1}>
      <Text bold color="green">🎉 {m.allComplete}</Text>
    </Box>
  );
}
