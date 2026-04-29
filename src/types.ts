export type AiTool = "gemini" | "claude" | "gpt" | "ollama" | string;

export interface OllamaConfig {
  model: string;
  host?: string;
}

export interface SmartCommitConfig {
  ai: {
    primary: AiTool;
    fallback: AiTool;
    timeout: number;
    ollama?: OllamaConfig;
  };
  safety: {
    maxFileSize: string;
    blockedPatterns: string[];
    warnPatterns: string[];
    lfsPrompt: boolean;
    lfsAutoInstall: boolean;
    lfsAutoTrack: boolean;
    lfsTrackExtensions: string[];
  };
  commit: {
    style: "conventional" | "free";
    language: string;
    maxDiffSize: number;
  };
  grouping: {
    strategy: "smart" | "single" | "manual";
  };
}

export interface RepoState {
  path: string;
  branch: string;
  status: RepoGitStatus;
  files: FileChange[];
  unpushedCommits: number;
  hasRemote: boolean;
}

export type RepoGitStatus =
  | "clean"
  | "dirty"
  | "detached"
  | "rebasing"
  | "merging"
  | "locked";

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
  size: number;
  isBinary: boolean;
}

export interface CommitGroup {
  label: string;
  files: FileChange[];
  message?: string;
  reason?: string;
}

export interface AiGroupingResult {
  groups: Array<{
    label: string;
    files: string[];
    reason: string;
  }>;
}

export type BlockedReason = "size" | "binary" | "pattern";

export interface BlockedFile {
  file: FileChange;
  reason: BlockedReason;
}

export interface SafetyResult {
  blocked: BlockedFile[];
  warned: FileChange[];
  safe: FileChange[];
}

export type OsKind = "darwin" | "linux" | "win32" | "unknown";

export type PackageManager =
  | "brew"
  | "port"
  | "apt"
  | "dnf"
  | "yum"
  | "pacman"
  | "zypper"
  | "apk"
  | "winget"
  | "choco"
  | "scoop";

export interface LfsInstallPlan {
  os: OsKind;
  pm: PackageManager | null;
  installCommand: string[];
  needsSudo: boolean;
}

export type GroupAction = "commit" | "skip-group" | "skip-repo" | "exit";
export type PushAction = "push" | "keep-local" | "exit";
