import { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { t } from "../../i18n.js";

interface Props {
  templates: string[];
  onSubmit: (message: string) => void;
}

export function OfflineTemplateModal({ templates, onSubmit }: Props) {
  const m = t();
  const [picked, setPicked] = useState<string | null>(null);
  const [input, setInput] = useState("");

  if (picked === null) {
    const items = templates.map((tpl) => ({ label: tpl, value: tpl, key: tpl }));
    return (
      <Box flexDirection="column">
        <Text color="yellow" bold>⚠ {m.offlineSelect}</Text>
        <SelectInput
          items={items}
          onSelect={(item) => { setPicked(item.value); setInput(item.value); }}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>{m.offlineInputMsg}</Text>
      <Box>
        <Text>  </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={(v) => onSubmit(v || picked)}
        />
      </Box>
    </Box>
  );
}
