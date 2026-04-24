import { Text } from "ink";

type Level = "info" | "success" | "warn" | "error";

interface Props {
  message: string;
  level: Level;
}

const ICON: Record<Level, string> = {
  info: "ℹ",
  success: "✅",
  warn: "⚠",
  error: "✖",
};

const COLOR: Record<Level, "cyan" | "green" | "yellow" | "red"> = {
  info: "cyan",
  success: "green",
  warn: "yellow",
  error: "red",
};

export function Message({ message, level }: Props) {
  return <Text color={COLOR[level]}>  {ICON[level]} {message}</Text>;
}
