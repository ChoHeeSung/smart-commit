import { Box, Text } from "ink";
import type { ReactNode } from "react";
import Spinner from "ink-spinner";
import type { BlockedFile, FileChange } from "../../types.js";
import type { Activity } from "../store.js";
import { useUi } from "../store.js";
import { shortRepoPath } from "../helpers.js";
import { t } from "../../i18n.js";
import { useTerminalSize } from "../useTerminalSize.js";
import { cwTruncate } from "../width.js";

const MAX_FILES = 6;

export function ActivityPane() {
  const activity = useUi((s) => s.activity);
  const blocked = useUi((s) => s.blocked);
  const spinnerLabel = useUi((s) => s.spinnerLabel);
  const phase = useUi((s) => s.phase);
  const { columns } = useTerminalSize();

  if (phase === "idle" || phase === "scanning") return null;
  const paneWidth = Math.max(40, Math.floor(columns / 2) - 2);
  const textWidth = paneWidth; // heading bar와 동일 좌측 정렬, padding 없음

  const lines: ReactNode[] = [];
  if (spinnerLabel) {
    lines.push(
      <Box key="spin" gap={1}>
        <Text color="cyan"><Spinner type="dots" /></Text>
        <Text>{cwTruncate(spinnerLabel, textWidth - 2)}</Text>
      </Box>
    );
  }
  if (blocked) pushBlocked(lines, blocked, textWidth);
  if (activity) pushActivity(lines, activity, textWidth);
  if (!activity && !spinnerLabel && !blocked) {
    lines.push(<Text key="idle" dimColor>Waiting...</Text>);
  }

  return (
    <Box flexDirection="column">
      <HeadingBar width={paneWidth} label="ACTIVITY" />
      <Text> </Text>
      {lines}
    </Box>
  );
}

function pushBlocked(
  lines: ReactNode[],
  blocked: { repoPath: string; files: BlockedFile[] },
  textWidth: number,
): void {
  const m = t();
  lines.push(
    <Text key="b-title" color="red">
      {cwTruncate(`x ${shortRepoPath(blocked.repoPath, 1)}: ${m.blocked}`, textWidth)}
    </Text>
  );
  blocked.files.slice(0, 3).forEach((b, i) => {
    lines.push(
      <Text key={`b-${i}`} color="red" dimColor>
        {cwTruncate(`- ${b.file.path}`, textWidth)}
      </Text>
    );
  });
  if (blocked.files.length > 3) {
    lines.push(<Text key="b-more" dimColor>... and {blocked.files.length - 3} more</Text>);
  }
  lines.push(<Text key="b-gap"> </Text>);
}

function pushActivity(lines: ReactNode[], activity: Activity, textWidth: number): void {
  const [subject, ...rest] = activity.message.split("\n");
  const body = rest.join("\n").trim();
  const visible = activity.files.slice(0, MAX_FILES);
  const hidden = activity.files.length - visible.length;

  lines.push(<Text key="a-repo" bold>{cwTruncate(shortRepoPath(activity.repoPath), textWidth)}</Text>);
  lines.push(<Text key="a-g1"> </Text>);
  lines.push(<Text key="a-subj" color="green">{cwTruncate(subject, textWidth)}</Text>);

  if (body) {
    lines.push(<Text key="a-g2"> </Text>);
    body.split("\n").slice(0, 3).forEach((line, i) => {
      lines.push(<Text key={`a-body-${i}`} dimColor>{cwTruncate(line, textWidth)}</Text>);
    });
  }
  if (activity.groupReason) {
    lines.push(<Text key="a-g3"> </Text>);
    lines.push(<Text key="a-reason" dimColor>{cwTruncate(`-- ${activity.groupReason}`, textWidth)}</Text>);
  }
  lines.push(<Text key="a-g4"> </Text>);
  lines.push(<Text key="a-files" dimColor>Files ({activity.files.length})</Text>);
  visible.forEach((f) => {
    lines.push(<FileRow key={`a-f-${f.path}`} file={f} textWidth={textWidth} />);
  });
  if (hidden > 0) {
    lines.push(<Text key="a-more" dimColor>... and {hidden} more</Text>);
  }
}

function FileRow({ file, textWidth }: { file: FileChange; textWidth: number }) {
  const icon = fileIcon(file.status);
  const color = fileColor(file.status);
  const pathBudget = Math.max(8, textWidth - 2); // "+ " prefix 2 cols
  return (
    <Text>
      <Text color={color}>{icon} </Text>
      <Text dimColor>{cwTruncate(file.path, pathBudget)}</Text>
    </Text>
  );
}

function fileIcon(status: FileChange["status"]): string {
  if (status === "added" || status === "untracked") return "+";
  if (status === "deleted") return "-";
  return "~";
}

function fileColor(status: FileChange["status"]): "green" | "red" | "yellow" {
  if (status === "added" || status === "untracked") return "green";
  if (status === "deleted") return "red";
  return "yellow";
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
