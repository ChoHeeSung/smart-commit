import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { FileChange } from "../../types.js";
import { useUi } from "../store.js";
import { shortRepoPath } from "../helpers.js";
import { t } from "../../i18n.js";
import { useTerminalSize } from "../useTerminalSize.js";
import { cwTruncate } from "../width.js";

const MAX_FILES = 6;
const ICON_COLS = 4; // "  + " / "  - " / "  ~ "

export function ActivityPane() {
  const activity = useUi((s) => s.activity);
  const blocked = useUi((s) => s.blocked);
  const spinnerLabel = useUi((s) => s.spinnerLabel);
  const phase = useUi((s) => s.phase);
  const { columns } = useTerminalSize();
  const m = t();

  if (phase === "idle" || phase === "scanning") return null;
  const paneWidth = Math.max(40, Math.floor(columns / 2) - 2);
  const textWidth = Math.max(20, paneWidth - 2); // 내부 padding 감안

  return (
    <Box flexDirection="column">
      <HeadingBar width={paneWidth} label="ACTIVITY" />
      {spinnerLabel && (
        <Box gap={1} marginTop={1}>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text>{cwTruncate(spinnerLabel, textWidth - 2)}</Text>
        </Box>
      )}
      {blocked && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red">
            {cwTruncate(`x ${shortRepoPath(blocked.repoPath, 1)}: ${m.blocked}`, textWidth)}
          </Text>
          {blocked.files.slice(0, 3).map((b) => (
            <Text key={b.file.path} color="red" dimColor>
              {cwTruncate(`    - ${b.file.path}`, textWidth)}
            </Text>
          ))}
          {blocked.files.length > 3 && (
            <Text dimColor>    ... and {blocked.files.length - 3} more</Text>
          )}
        </Box>
      )}
      {activity ? <ActivityView textWidth={textWidth} /> : null}
      {!activity && !spinnerLabel && !blocked && (
        <Text dimColor>  Waiting...</Text>
      )}
    </Box>
  );
}

function ActivityView({ textWidth }: { textWidth: number }) {
  const activity = useUi((s) => s.activity);
  if (!activity) return null;

  const { repoPath, message, files, groupReason } = activity;
  const [subject, ...rest] = message.split("\n");
  const body = rest.join("\n").trim();
  const visible = files.slice(0, MAX_FILES);
  const hidden = files.length - visible.length;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{cwTruncate(shortRepoPath(repoPath), textWidth)}</Text>
      <Box marginTop={1}>
        <Text color="green">{cwTruncate(subject, textWidth)}</Text>
      </Box>
      {body && (
        <Box marginTop={1} flexDirection="column">
          {body.split("\n").slice(0, 3).map((line, i) => (
            <Text key={i} dimColor>{cwTruncate(line, textWidth)}</Text>
          ))}
        </Box>
      )}
      {groupReason && (
        <Box marginTop={1}>
          <Text dimColor>{cwTruncate(`-- ${groupReason}`, textWidth)}</Text>
        </Box>
      )}
      <Box marginTop={1}><Text dimColor>Files ({files.length})</Text></Box>
      {visible.map((f) => <FileRow key={f.path} file={f} textWidth={textWidth} />)}
      {hidden > 0 && <Text dimColor>    ... and {hidden} more</Text>}
    </Box>
  );
}

function FileRow({ file, textWidth }: { file: FileChange; textWidth: number }) {
  const icon = file.status === "added" || file.status === "untracked"
    ? "+" : file.status === "deleted" ? "-" : "~";
  const color = file.status === "added" || file.status === "untracked"
    ? "green" : file.status === "deleted" ? "red" : "yellow";
  const pathBudget = Math.max(8, textWidth - ICON_COLS);
  const truncated = cwTruncate(file.path, pathBudget);
  return (
    <Text>
      <Text color={color}>  {icon} </Text>
      <Text dimColor>{truncated}</Text>
    </Text>
  );
}

function HeadingBar({ width, label }: { width: number; label: string }) {
  const head = ` ${label} `;
  const fill = Math.max(0, width - head.length);
  return (
    <Text>
      <Text bold inverse color="cyan">{head}</Text>
      <Text dimColor>{" ".repeat(fill)}</Text>
    </Text>
  );
}
