import type { RepoState, BlockedFile } from "../types.js";
import type { Messages } from "../i18n.js";

export function shortRepoPath(repoPath: string, segments = 2): string {
  return repoPath.split("/").slice(-segments).join("/");
}

export function statusText(status: RepoState["status"], m: Messages): string {
  switch (status) {
    case "dirty": return m.statusDirty;
    case "clean": return m.statusClean;
    case "detached": return m.statusDetached;
    case "rebasing": return m.statusRebasing;
    case "merging": return m.statusMerging;
    case "locked": return m.statusLocked;
  }
}

export function changeSummary(repo: RepoState, m: Messages): string {
  if (repo.files.length > 0) return `${repo.files.length} ${m.filesUnit}`;
  if (repo.unpushedCommits > 0) return `${repo.unpushedCommits} ${m.unpushedUnit}`;
  return "—";
}

export function blockedReasonText(reason: BlockedFile["reason"], m: Messages): string {
  if (reason === "size") return m.blockedReasonSize;
  if (reason === "binary") return m.blockedReasonBinary;
  return m.blockedReasonPattern;
}
