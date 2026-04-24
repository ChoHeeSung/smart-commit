import { Box, useInput } from "ink";
import { store, useUi } from "./store.js";
import { HeaderPanel } from "./layout/HeaderPanel.js";
import { ScanView } from "./layout/ScanView.js";
import { RepoPane } from "./layout/RepoPane.js";
import { ActivityPane } from "./layout/ActivityPane.js";
import { LogPane } from "./layout/LogPane.js";
import { FooterBar } from "./layout/FooterBar.js";
import { ModalArea } from "./layout/ModalArea.js";
import { useTerminalSize } from "./useTerminalSize.js";

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
  const inPairLayout = phase !== "idle" && phase !== "scanning";

  return (
    <Box flexDirection="column" height={appHeight}>
      <HeaderPanel />
      {phase === "scanning" && <ScanView />}
      {inPairLayout && (
        <Box flexDirection="row" flexGrow={1} overflow="hidden">
          <Box
            width="50%"
            borderStyle="round"
            borderColor="cyan"
            flexDirection="column"
            overflow="hidden"
          >
            <RepoPane />
          </Box>
          <Box
            width="50%"
            borderStyle="round"
            borderColor="cyan"
            flexDirection="column"
            overflow="hidden"
          >
            <ActivityPane />
            <LogPane />
          </Box>
        </Box>
      )}
      {modal ? <ModalArea modal={modal} /> : <FooterBar />}
    </Box>
  );
}
