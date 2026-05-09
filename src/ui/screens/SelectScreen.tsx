import { Box, Text, useInput } from "ink";
import { store, useUi } from "../store.js";
import { t } from "../../i18n.js";
import { shortRepoPath, statusText, changeSummary } from "../helpers.js";
import { alignTable, cwTruncate, inkWidth, inkPad } from "../width.js";
import { useTerminalSize } from "../useTerminalSize.js";

const HEADER_ROWS = 4;
const FOOTER_ROWS = 3;
const MIN_VIEWPORT = 5;
const PREFIX_WIDTH = 5; // "▶ ✓ " or "  ✓ " — fixed 5 cols

export function SelectScreen() {
  const repos = useUi((s) => s.repos);
  const cursor = useUi((s) => s.cursor);
  const selection = useUi((s) => s.selection);
  const { columns, rows } = useTerminalSize();
  const m = t();

  useInput((input, key) => {
    if (key.upArrow || input === "k") return store.moveCursor(-1);
    if (key.downArrow || input === "j") return store.moveCursor(1);
    if (key.pageUp) return store.moveCursor(-10);
    if (key.pageDown) return store.moveCursor(10);
    if (input === " ") return store.toggleCurrent();
    if (input === "a" || input === "A") return store.toggleAll();
    if (key.return) return store.confirmSelect();
    if (key.escape || input === "q" || input === "Q") return store.cancelSelect();
  });

  const tableWidth = Math.max(40, columns - 4 - PREFIX_WIDTH);
  const viewport = Math.max(MIN_VIEWPORT, rows - HEADER_ROWS - FOOTER_ROWS - 2);
  const start = computeViewStart(cursor, repos.length, viewport);
  const visible = repos.slice(start, start + viewport);

  const header = ["#", "저장소", "브랜치", "변경", "상태"];
  const dataRows: string[][] = visible.map((repo, i) => {
    const idx = start + i;
    return [
      String(idx + 1),
      shortRepoPath(repo.path) + (repo.hasRemote ? "" : " *"),
      repo.branch,
      changeSummary(repo, m),
      statusText(repo.status, m),
    ];
  });

  const aligned = alignTable([header, ...dataRows], tableWidth, [
    { min: 3, max: 5 },
    { min: 15, weight: 4 },
    { min: 8, weight: 2 },
    { min: 9, weight: 1 },
    { min: 10, weight: 1 },
  ]);

  const dirtyCount = repos.filter((r) => r.status === "dirty").length;
  const checkedCount = selection.size;
  const dividerWidth = Math.max(1, Math.min(tableWidth + PREFIX_WIDTH, columns - 4));

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}>
        <Text bold color="cyan">{m.selectRepos}</Text>
        <Text dimColor>  (선택 </Text>
        <Text bold color={checkedCount > 0 ? "green" : undefined}>{checkedCount}</Text>
        <Text dimColor>/{dirtyCount}, 전체 {repos.length})</Text>
      </Box>
      <Box>
        <Text dimColor>{"     "}</Text>
        <Text bold dimColor>{aligned[0]}</Text>
      </Box>
      <Box>
        <Text dimColor>{"─".repeat(dividerWidth)}</Text>
      </Box>
      <Box flexDirection="column">
        {aligned.slice(1).map((line, i) => {
          const idx = start + i;
          const repo = repos[idx];
          const focused = idx === cursor;
          const checked = selection.has(repo.path);
          const togglable = repo.status === "dirty";
          return (
            <RepoRow
              key={repo.path}
              line={line}
              focused={focused}
              checked={checked}
              togglable={togglable}
            />
          );
        })}
      </Box>
      {repos.length > viewport + start && (
        <Box marginTop={1}>
          <Text dimColor>{cwTruncate(`▼ ${repos.length - viewport - start} 개 더 ▼`, columns - 4)}</Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>↑↓ 이동 · </Text>
        <Text>
          <Text bold color="green">Space</Text>
          <Text dimColor> 토글 · </Text>
          <Text bold color="cyan">a</Text>
          <Text dimColor> 전체 · </Text>
          <Text bold color="green">Enter</Text>
          <Text dimColor> 확정 · </Text>
          <Text bold color="yellow">ESC/q</Text>
          <Text dimColor> 취소</Text>
        </Text>
      </Box>
    </Box>
  );
}

interface RowProps {
  line: string;
  focused: boolean;
  checked: boolean;
  togglable: boolean;
}

function RepoRow({ line, focused, checked, togglable }: RowProps) {
  // prefix 5 cols: "▶ ✓ " or "  ✓ " (cursor 1 + space 1 + check 1 + space 2)
  const cursorMark = focused ? "▶ " : "  ";
  const checkMark = togglable ? (checked ? "✓ " : "· ") : "  ";
  const trailing = " "; // 5th col gap before line
  const cursorColor = focused ? "cyan" : undefined;
  const checkColor = togglable
    ? (checked ? "green" : "gray")
    : undefined;
  const lineColor = !togglable
    ? "gray"
    : focused
      ? "cyan"
      : checked
        ? "green"
        : undefined;
  const lineDim = !togglable;
  const lineBold = focused || checked;

  // Pad the line text exactly to its declared width using Ink-compatible width.
  // alignTable already produced the line; we just keep it as-is. The PREFIX (5 cols)
  // is fixed: 2(cursor) + 2(check) + 1(trailing).
  return (
    <Text>
      <Text bold color={cursorColor}>{cursorMark}</Text>
      <Text bold color={checkColor}>{checkMark}</Text>
      <Text>{trailing}</Text>
      <Text color={lineColor} dimColor={lineDim} bold={lineBold}>{inkPad(line, inkWidth(line))}</Text>
    </Text>
  );
}

function computeViewStart(cursorIdx: number, total: number, viewport: number): number {
  if (total <= viewport) return 0;
  const maxStart = total - viewport;
  const desired = cursorIdx - Math.floor(viewport / 2);
  return Math.max(0, Math.min(maxStart, desired));
}
