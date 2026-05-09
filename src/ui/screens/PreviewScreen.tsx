import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { store, useUi } from "../store.js";
import { t } from "../../i18n.js";
import { shortRepoPath } from "../helpers.js";
import { cwTruncate, inkWidth, inkTruncate } from "../width.js";
import { useTerminalSize } from "../useTerminalSize.js";
import type { RepoPreview } from "../store.js";

export function PreviewScreen() {
  const previews = useUi((s) => s.previews);
  const cursor = useUi((s) => s.previewCursor);
  const previewResolve = useUi((s) => s.previewResolve);
  const { columns, rows } = useTerminalSize();

  useInput((input, key) => {
    if (key.upArrow || input === "k") return store.movePreview(-1);
    if (key.downArrow || input === "j") return store.movePreview(1);
    if (key.return) return store.confirmPreview();
    if (key.escape || input === "q" || input === "Q") return store.cancelPreview();
  });

  const allReady = previews.every((p) => p.status !== "pending" && p.status !== "generating");
  const generating = previews.filter((p) => p.status === "generating").length;
  const ready = previews.filter((p) => p.status === "ready").length;
  const skipped = previews.filter((p) => p.status === "skipped").length;
  const errored = previews.filter((p) => p.status === "error").length;

  const listW = Math.max(28, Math.floor(columns * 0.4));
  const detailW = Math.max(28, columns - listW - 5);
  const viewportH = Math.max(8, rows - 10);

  const start = computeViewStart(cursor, previews.length, viewportH);
  const visible = previews.slice(start, start + viewportH);
  const current = previews[cursor];

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}>
        <Text bold color="cyan">{allReady ? "커밋 메시지 미리보기" : "AI 메시지 생성 중"}</Text>
        <Text dimColor>  ({ready}/{previews.length} 준비, {skipped} 건너뜀, {errored} 오류{generating > 0 ? `, ${generating} 생성중` : ""})</Text>
      </Box>
      <Box flexDirection="row" height={viewportH + 2}>
        <Box flexDirection="column" width={listW} flexShrink={0} paddingRight={2}>
          {visible.map((p, i) => {
            const idx = start + i;
            const focused = idx === cursor;
            return (
              <PreviewListRow
                key={p.repo.path}
                preview={p}
                focused={focused}
                width={listW - 2}
              />
            );
          })}
        </Box>
        <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="gray" borderTop={false} borderRight={false} borderBottom={false} paddingLeft={2}>
          {current ? <PreviewDetail preview={current} width={detailW} /> : null}
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {allReady ? (
          <>
            <Text>
              <Text bold color={previewResolve ? "green" : "gray"}>[Enter]</Text>
              <Text> 모든 레포 commit + push 시작  </Text>
              <Text bold color="yellow">[ESC/q]</Text>
              <Text> 선택 단계로</Text>
            </Text>
            <Text dimColor>↑↓ 스크롤</Text>
          </>
        ) : (
          <Text>
            <Text color="cyan"><Spinner type="dots" /></Text>
            <Text> AI가 메시지 생성 중... ({generating}/{previews.length})</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
}

function PreviewListRow({ preview, focused, width }: { preview: RepoPreview; focused: boolean; width: number }) {
  const cursorMark = focused ? "▶ " : "  ";
  const icon = statusIcon(preview.status);
  const iconCell = `${icon} `;
  const headW = inkWidth(cursorMark) + inkWidth(iconCell);
  const nameMax = Math.max(4, width - headW);
  const nameTrunc = inkTruncate(shortRepoPath(preview.repo.path), nameMax);
  const used = headW + inkWidth(nameTrunc);
  const trailing = " ".repeat(Math.max(0, width - used));
  const color = focused ? "cyan" : statusColor(preview.status);
  return (
    <Text>
      <Text bold color={focused ? "cyan" : undefined}>{cursorMark}</Text>
      <Text bold color={statusColor(preview.status) ?? "gray"}>{iconCell}</Text>
      <Text color={color} bold={focused}>{nameTrunc}</Text>
      <Text>{trailing}</Text>
    </Text>
  );
}

function PreviewDetail({ preview, width }: { preview: RepoPreview; width: number }) {
  const m = t();
  if (preview.status === "generating" || preview.status === "pending") {
    return (
      <Text>
        <Text color="cyan"><Spinner type="dots" /></Text>
        <Text> {m.aiGenerating}</Text>
      </Text>
    );
  }
  if (preview.status === "skipped") {
    return (
      <Box flexDirection="column">
        <Text bold color="gray">{shortRepoPath(preview.repo.path)} ({preview.repo.branch})</Text>
        <Text dimColor>건너뜀: {preview.skipReason ?? "—"}</Text>
      </Box>
    );
  }
  if (preview.status === "error") {
    return (
      <Box flexDirection="column">
        <Text bold color="red">{shortRepoPath(preview.repo.path)} ({preview.repo.branch})</Text>
        <Text color="red">오류: {preview.skipReason ?? m.aiFailed}</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{cwTruncate(shortRepoPath(preview.repo.path), width)}</Text>
      <Text dimColor>브랜치 {preview.repo.branch} · 그룹 {preview.groups.length}개</Text>
      <Box marginTop={1} flexDirection="column">
        {preview.groups.map((g, i) => {
          const subject = g.message?.split("\n")[0] ?? "(메시지 없음)";
          const body = g.message?.split("\n").slice(1).join("\n").trim() ?? "";
          return (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text color="green">▸ [{i + 1}] {cwTruncate(subject, width - 6)}</Text>
              {body ? <Text dimColor>  {cwTruncate(body.split("\n")[0], width - 4)}</Text> : null}
              <Text dimColor>  파일 {g.files.length}개{g.reason ? ` · ${cwTruncate(g.reason, width - 18)}` : ""}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function statusIcon(s: RepoPreview["status"]): string {
  if (s === "ready") return "✓";
  if (s === "generating") return "⠿";
  if (s === "skipped") return "—";
  if (s === "error") return "✗";
  return "·";
}

function statusColor(s: RepoPreview["status"]): string | undefined {
  if (s === "ready") return "green";
  if (s === "skipped") return "gray";
  if (s === "error") return "red";
  return undefined;
}

function computeViewStart(cursorIdx: number, total: number, viewport: number): number {
  if (total <= viewport) return 0;
  const maxStart = total - viewport;
  const desired = cursorIdx - Math.floor(viewport / 2);
  return Math.max(0, Math.min(maxStart, desired));
}
