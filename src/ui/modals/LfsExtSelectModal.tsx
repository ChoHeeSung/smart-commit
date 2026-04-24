import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { t } from "../../i18n.js";

interface Props {
  extensions: string[];
  onSubmit: (selected: string[]) => void;
}

export function LfsExtSelectModal({ extensions, onSubmit }: Props) {
  const m = t();
  const [cursor, setCursor] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(
    new Set(extensions.map((_, i) => i))
  );

  useInput((input, key) => {
    if (key.upArrow) return setCursor((c) => (c - 1 + extensions.length) % extensions.length);
    if (key.downArrow) return setCursor((c) => (c + 1) % extensions.length);
    if (input === " ") return setChecked((s) => toggleIndex(s, cursor));
    if (input === "a") return setChecked((s) => toggleAll(s, extensions.length));
    if (key.return) return onSubmit(extensions.filter((_, i) => checked.has(i)));
    if (key.escape || input === "q") onSubmit([]);
  });

  return (
    <Box flexDirection="column">
      <Text bold>{m.lfsSelectExtensions}</Text>
      <Text dimColor>{m.lfsSelectHint}</Text>
      {extensions.map((ext, i) => (
        <Text key={ext} color={i === cursor ? "cyan" : undefined} inverse={i === cursor}>
          {"   " + (checked.has(i) ? "[✓] " : "[ ] ") + ext}
        </Text>
      ))}
    </Box>
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
