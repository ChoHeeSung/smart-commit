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

export interface SafetyResult {
  blocked: FileChange[];
  warned: FileChange[];
  safe: FileChange[];
}

export type UserAction = "push" | "skip" | "cancel" | "edit" | "skip-repo" | "exit";
