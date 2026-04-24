import { Box, Text } from "ink";
import type { FileChange, RepoState } from "../../types.js";
import { shortRepoPath } from "../helpers.js";

interface Props {
  repo: RepoState;
  message: string;
  files: FileChange[];
}

const MAX_FILES = 10;

export function CommitPreview({ repo, message, files }: Props) {
  const [subject, ...rest] = message.split("\n");
  const body = rest.join("\n").trim();
  const visible = files.slice(0, MAX_FILES);
  const hidden = files.length - visible.length;

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      flexDirection="column"
      marginY={1}
    >
      <Text bold>📂 {shortRepoPath(repo.path)}</Text>
      <Box marginTop={1}><Text color="green">{subject}</Text></Box>
      {body && (
        <Box marginTop={1} flexDirection="column">
          {body.split("\n").map((line, i) => (
            <Text key={i} dimColor>{line}</Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Files ({files.length})</Text>
      </Box>
      {visible.map((f) => <FileRow key={f.path} file={f} />)}
      {hidden > 0 && <Text dimColor>    … and {hidden} more</Text>}
    </Box>
  );
}

function FileRow({ file }: { file: FileChange }) {
  const icon = fileIcon(file.status);
  const color = fileColor(file.status);
  return (
    <Box>
      <Text color={color}>  {icon}</Text>
      <Text dimColor> {file.path}</Text>
    </Box>
  );
}

function fileIcon(status: FileChange["status"]): string {
  if (status === "added" || status === "untracked") return "+";
  if (status === "deleted") return "−";
  if (status === "renamed") return "→";
  return "~";
}

function fileColor(status: FileChange["status"]): string {
  if (status === "added" || status === "untracked") return "green";
  if (status === "deleted") return "red";
  return "yellow";
}
