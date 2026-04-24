import type { ReactNode } from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  title: ReactNode;
  body?: ReactNode;
  onSubmit: (yes: boolean) => void;
  defaultYes?: boolean;
}

export function Confirm({ title, body, onSubmit, defaultYes = true }: Props) {
  useInput((input, key) => {
    const low = input.toLowerCase();
    if (low === "y") return onSubmit(true);
    if (low === "n") return onSubmit(false);
    if (key.return) return onSubmit(defaultYes);
    if (key.escape) return onSubmit(false);
  });

  return (
    <Box flexDirection="column" marginY={1}>
      {title}
      {body}
      <Text dimColor>({defaultYes ? "Y/n" : "y/N"})</Text>
    </Box>
  );
}
