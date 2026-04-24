import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { t } from "../../i18n.js";

interface Props {
  extensions: string[];
  onSubmit: (selected: string[]) => void;
}

export function LfsExtSelect({ extensions, onSubmit }: Props) {
  const m = t();
  const [cursor, setCursor] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(
    new Set(extensions.map((_, i) => i))
  );

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c - 1 + extensions.length) % extensions.length);
      return;
    }
    if (key.downArrow) {
      setCursor((c) => (c + 1) % extensions.length);
      return;
    }
    if (input === " ") {
      setChecked((s) => toggleIndex(s, cursor));
      return;
    }
    if (input === "a") {
      setChecked((s) => toggleAll(s, extensions.length));
      return;
    }
    if (key.return) {
      onSubmit(extensions.filter((_, i) => checked.has(i)));
      return;
    }
    if (key.escape || input === "q") onSubmit([]);
  });

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold>{m.lfsSelectExtensions}</Text>
      <Text dimColor>{m.lfsSelectHint}</Text>
      <Box marginTop={1} flexDirection="column">
        {extensions.map((ext, i) => (
          <ExtRow
            key={ext}
            ext={ext}
            focused={i === cursor}
            checked={checked.has(i)}
          />
        ))}
      </Box>
    </Box>
  );
}

function ExtRow({
  ext, focused, checked,
}: { ext: string; focused: boolean; checked: boolean }) {
  const mark = checked ? "[✓]" : "[ ]";
  const color = focused ? "cyan" : undefined;
  return (
    <Text color={color} inverse={focused}>    {mark} {ext}</Text>
  );
}

function toggleIndex(s: Set<number>, idx: number): Set<number> {
  const n = new Set(s);
  if (n.has(idx)) n.delete(idx);
  else n.add(idx);
  return n;
}

function toggleAll(s: Set<number>, total: number): Set<number> {
  if (s.size === total) return new Set();
  return new Set(Array.from({ length: total }, (_, i) => i));
}
