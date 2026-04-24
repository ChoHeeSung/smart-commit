import { Box, Text, useInput } from "ink";
import { store, useUi } from "./store.js";
import { HeaderPanel } from "./layout/HeaderPanel.js";
import { ScanView } from "./layout/ScanView.js";
import { RepoPane } from "./layout/RepoPane.js";
import { ActivityPane } from "./layout/ActivityPane.js";
import { LogPane } from "./layout/LogPane.js";
import { FooterBar } from "./layout/FooterBar.js";
import { ModalArea } from "./layout/ModalArea.js";
import { useTerminalSize } from "./useTerminalSize.js";

// 레이아웃 규격 (heading bar + content 기반, 박스 테두리 없음).
// 박스 테두리는 Ink + 넓은 터미널에서 overflow 관리에 부작용이 있어 전면 제거.
const HEADER_ROWS = 7;   // banner(5) + meta(1) + blank(1)
const FOOTER_ROWS_SLIM = 3;   // FooterBar: border(2) + hint(1)
const FOOTER_ROWS_MODAL = 10; // Modal heading 1 + content 최대 (confirm 8 / action 6 / select 8)

export function App() {
  const phase = useUi((s) => s.phase);
  const modal = useUi((s) => s.modal);
  const { rows } = useTerminalSize();

  const inputActive = phase === "selecting" && !modal;
  useInput((input, key) => {
    if (key.upArrow || input === "k") return store.moveCursor(-1);
    if (key.downArrow || input === "j") return store.moveCursor(1);
    if (key.pageUp) return store.moveCursor(-10);
    if (key.pageDown) return store.moveCursor(10);
    if (input === " ") return store.toggleCurrent();
    if (input === "a") return store.toggleAll();
    if (key.return) return store.confirmRepoSelection();
    if (key.escape || input === "q") return store.cancelRepoSelection();
  }, { isActive: inputActive });

  const appHeight = Math.max(20, rows - 1);
  const footerArea = modal ? FOOTER_ROWS_MODAL : FOOTER_ROWS_SLIM;
  const mainHeight = Math.max(8, appHeight - HEADER_ROWS - footerArea);
  const inPairLayout = phase !== "idle" && phase !== "scanning";

  return (
    <Box flexDirection="column" height={appHeight}>
      <HeaderPanel />
      {phase === "scanning" && <ScanView />}
      {inPairLayout && (
        <Box flexDirection="row" height={mainHeight}>
          <Box flexBasis="50%" flexGrow={0} flexShrink={0} flexDirection="column" paddingRight={1}>
            <RepoPane contentHeight={mainHeight} />
          </Box>
          <Box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1}>
            <ActivityPane />
            <LogPane paneHeight={mainHeight} />
          </Box>
        </Box>
      )}
      {modal ? <ModalArea modal={modal} /> : <FooterBar />}
    </Box>
  );
}

export function HBar({ width, label, count }: { width: number; label: string; count?: string }) {
  const text = count ? ` ${label} ${count} ` : ` ${label} `;
  return <Text bold inverse color="cyan">{text.padEnd(Math.max(width, text.length))}</Text>;
}
