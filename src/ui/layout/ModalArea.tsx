import { Box, Text } from "ink";
import type { Modal } from "../store.js";
// Text 는 위 줄의 heading bar 용으로 사용.
import { ConfirmModal } from "../modals/ConfirmModal.js";
import { ActionMenuModal } from "../modals/ActionMenuModal.js";
import { PushMenuModal } from "../modals/PushMenuModal.js";
import { LfsExtSelectModal } from "../modals/LfsExtSelectModal.js";
import { OfflineTemplateModal } from "../modals/OfflineTemplateModal.js";
import { InputModal } from "../modals/InputModal.js";
import { t } from "../../i18n.js";
import { shortRepoPath } from "../helpers.js";

interface Props {
  modal: Modal;
}

export function ModalArea({ modal }: Props) {
  // heading bar (inverse magenta) + content, border/padding 없이 컴팩트하게.
  // border 를 쓰면 모달이 필요한 rows 가 커져 App 하단 overflow 원인.
  return (
    <Box flexDirection="column">
      <Text bold inverse color="magenta">{" MODAL ".padEnd(12)}</Text>
      <Box paddingLeft={1} flexDirection="column">
        {renderModal(modal)}
      </Box>
    </Box>
  );
}

function renderModal(modal: Modal) {
  const m = t();
  switch (modal.type) {
    case "confirm-warned": {
      const title = `⚠ ${shortRepoPath(modal.repo.path, 1)}: ${m.warnFiles}`;
      const body = (
        <Box flexDirection="column">
          {modal.files.slice(0, 5).map((f) => (
            <Text key={f.path} color="yellow">  - {f.path}</Text>
          ))}
          {modal.files.length > 5 && (
            <Text dimColor>  … and {modal.files.length - 5} more</Text>
          )}
          <Text>{m.includeQuestion}</Text>
        </Box>
      );
      return <ConfirmModal title={title} body={body} onSubmit={modal.resolve} defaultYes />;
    }
    case "lfs-init": {
      const title = m.lfsPromptTitle;
      const body = (
        <Box flexDirection="column">
          <Text dimColor>{m.lfsPromptDesc}</Text>
          <Text>{shortRepoPath(modal.repo.path, 1)}</Text>
        </Box>
      );
      return <ConfirmModal title={title} body={body} onSubmit={modal.resolve} defaultYes />;
    }
    case "lfs-install": {
      const cmd = modal.plan.installCommand.join(" ");
      const title = `⚠ ${m.lfsNotInstalled}`;
      const body = (
        <Box flexDirection="column">
          <Text>OS: {modal.plan.os}</Text>
          <Text>{m.lfsInstallPrompt(modal.plan.pm ?? "unknown", cmd)}</Text>
          {modal.plan.needsSudo && (
            <Text color="yellow">{m.lfsInstallSudoWarn}</Text>
          )}
        </Box>
      );
      return <ConfirmModal title={title} body={body} onSubmit={modal.resolve} defaultYes />;
    }
    case "lfs-ext-select":
      return <LfsExtSelectModal extensions={modal.extensions} onSubmit={modal.resolve} />;
    case "group-action-menu":
      return <ActionMenuModal onSubmit={modal.resolve} />;
    case "push-action-menu":
      return <PushMenuModal commitCount={modal.commitCount} onSubmit={modal.resolve} />;
    case "offline-template":
      return <OfflineTemplateModal templates={modal.templates} onSubmit={modal.resolve} />;
    case "input":
      return <InputModal label={modal.label} onSubmit={modal.resolve} />;
  }
}
