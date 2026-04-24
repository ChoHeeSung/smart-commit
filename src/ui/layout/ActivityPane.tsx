import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { FileChange } from "../../types.js";
import { useUi } from "../store.js";
import { shortRepoPath } from "../helpers.js";
import { t } from "../../i18n.js";
import { useTerminalSize } from "../useTerminalSize.js";

const MAX_FILES = 6;

export function ActivityPane() {
  const activity = useUi((s) => s.activity);
  const blocked = useUi((s) => s.blocked);
  const spinnerLabel = useUi((s) => s.spinnerLabel);
  const phase = useUi((s) => s.phase);
  const { columns } = useTerminalSize();
  const m = t();

  if (phase === "idle" || phase === "scanning") return null;
  const paneWidth = Math.floor(columns / 2) - 2;

  return (
    <Box flexDirection="column">
      <HeadingBar width={paneWidth} label="ACTIVITY" />
      {spinnerLabel && (
        <Box gap={1} marginTop={1}>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text>{spinnerLabel}</Text>
        </Box>
      )}
      {blocked && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red">x {shortRepoPath(blocked.repoPath, 1)}: {m.blocked}</Text>
          {blocked.files.slice(0, 3).map((b) => (
            <Text key={b.file.path} color="red" dimColor>    - {b.file.path}</Text>
          ))}
          {blocked.files.length > 3 && (
            <Text dimColor>    ... and {blocked.files.length - 3} more</Text>
          )}
        </Box>
      )}
      {activity ? <ActivityView /> : null}
      {!activity && !spinnerLabel && !blocked && (
        <Text dimColor>  Waiting...</Text>
      )}
    </Box>
  );
}

function ActivityView() {
  const activity = useUi((s) => s.activity);
  if (!activity) return null;

  const { repoPath, message, files, groupReason } = activity;
  const [subject, ...rest] = message.split("\n");
  const body = rest.join("\n").trim();
  const visible = files.slice(0, MAX_FILES);
  const hidden = files.length - visible.length;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{shortRepoPath(repoPath)}</Text>
      <Box marginTop={1}><Text color="green">{subject}</Text></Box>
      {body && (
        <Box marginTop={1} flexDirection="column">
          {body.split("\n").slice(0, 3).map((line, i) => (
            <Text key={i} dimColor wrap="truncate-end">{line}</Text>
          ))}
        </Box>
      )}
      {groupReason && (
        <Box marginTop={1}>
          <Text dimColor wrap="truncate-end">-- {groupReason}</Text>
        </Box>
      )}
      <Box marginTop={1}><Text dimColor>Files ({files.length})</Text></Box>
      {visible.map((f) => <FileRow key={f.path} file={f} />)}
      {hidden > 0 && <Text dimColor>    ... and {hidden} more</Text>}
    </Box>
  );
}

function FileRow({ file }: { file: FileChange }) {
  const icon = file.status === "added" || file.status === "untracked"
    ? "+" : file.status === "deleted" ? "-" : "~";
  const color = file.status === "added" || file.status === "untracked"
    ? "green" : file.status === "deleted" ? "red" : "yellow";
  return (
    <Box>
      <Text color={color}>  {icon}</Text>
      <Text dimColor wrap="truncate-end"> {file.path}</Text>
    </Box>
  );
}

function HeadingBar({ width, label }: { width: number; label: string }) {
  const line = ` ${label} `;
  const fill = Math.max(0, width - line.length);
  return (
    <Text>
      <Text bold inverse color="cyan">{line}</Text>
      <Text dimColor>{" ".repeat(fill)}</Text>
    </Text>
  );
}
