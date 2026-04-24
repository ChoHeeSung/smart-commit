import { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface Props {
  label: string;
  onSubmit: (value: string) => void;
}

export function InputModal({ label, onSubmit }: Props) {
  const [value, setValue] = useState("");
  return (
    <Box>
      <Text bold>{label}: </Text>
      <TextInput value={value} onChange={setValue} onSubmit={onSubmit} />
    </Box>
  );
}
