import { cosmiconfig } from "cosmiconfig";
import type { SmartCommitConfig } from "./types.js";

const DEFAULT_CONFIG: SmartCommitConfig = {
  ai: {
    primary: "gemini",
    fallback: "claude",
    timeout: 30,
  },
  safety: {
    maxFileSize: "10MB",
    blockedPatterns: [
      "*.env",
      ".env.*",
      "*.pem",
      "*.key",
      "credentials*",
      "*.sqlite",
      "*.sqlite3",
    ],
    warnPatterns: [
      "*.log",
      "*.csv",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
    ],
    lfsPrompt: true,
    lfsAutoInstall: false,
    lfsAutoTrack: false,
    lfsTrackExtensions: [],
  },
  commit: {
    style: "conventional",
    language: "ko",
    maxDiffSize: 10000,
  },
  grouping: {
    strategy: "smart",
  },
};

export async function loadConfig(
  cliOptions: Record<string, unknown> = {},
): Promise<SmartCommitConfig> {
  const explorer = cosmiconfig("smart-commit", {
    searchPlaces: [
      ".smart-commitrc",
      ".smart-commitrc.yaml",
      ".smart-commitrc.yml",
      ".smart-commitrc.json",
      "smart-commit.config.js",
      "package.json",
    ],
  });

  const result = await explorer.search();
  const fileConfig = result?.config ?? {};

  const config = deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    fileConfig as Record<string, unknown>,
  ) as unknown as SmartCommitConfig;

  if (cliOptions.ai && typeof cliOptions.ai === "string") {
    config.ai.primary = cliOptions.ai as string;
  }
  if (cliOptions.group && typeof cliOptions.group === "string") {
    config.grouping.strategy = cliOptions.group as "smart" | "single" | "manual";
  }

  return config;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
