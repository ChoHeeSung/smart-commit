import { Command } from "commander";
import { loadConfig } from "./config.js";
import { scanRepositories } from "./scanner.js";
import { classifyFiles, groupFiles } from "./classifier.js";
import { createAiClient, isAiAvailable, getOfflineTemplates } from "./ai-client.js";
import { commitAndPush } from "./committer.js";
import { createUI } from "./ui.js";
import { createLogger } from "./logger.js";
import type { RepoState, UserAction } from "./types.js";

const program = new Command();

program
  .name("smart-commit")
  .description("AI-powered intelligent Git auto-commit & push CLI tool")
  .version("0.1.0")
  .option("-d, --dry-run", "Preview without committing or pushing")
  .option("-g, --group <strategy>", "Grouping strategy: smart | single | manual")
  .option("-a, --ai <tool>", "AI tool: gemini | claude | gpt | ollama")
  .option("--no-interactive", "Headless mode (no prompts)")
  .option("--offline", "Offline mode (use templates instead of AI)")
  .action(async (options) => {
    const config = await loadConfig(options);
    const logger = createLogger();
    const ui = createUI();
    const ai = createAiClient(config, logger);
    const isHeadless = options.interactive === false;

    logger.info({ options }, "smart-commit started");

    ui.showHeader(config);

    // Check AI availability (skip in offline mode)
    let offlineMode = options.offline ?? false;
    if (!offlineMode) {
      const primaryAvail = await isAiAvailable(config.ai.primary);
      const fallbackAvail = await isAiAvailable(config.ai.fallback);
      if (!primaryAvail && !fallbackAvail) {
        ui.showMessage("AI 도구를 찾을 수 없습니다. 오프라인 모드로 전환합니다.", "warn");
        offlineMode = true;
        logger.warn("No AI tools available, switching to offline mode");
      } else if (!primaryAvail) {
        ui.showMessage(`${config.ai.primary}를 찾을 수 없습니다. ${config.ai.fallback}를 사용합니다.`, "warn");
      }
    }

    const repos = await scanRepositories(process.cwd(), ui, logger);

    if (repos.length === 0) {
      ui.showMessage("변경 사항이 있는 저장소가 없습니다.", "info");
      ui.cleanup();
      return;
    }

    ui.showRepoTable(repos);

    for (const repo of repos) {
      if (repo.status !== "dirty") {
        // Handle unpushed commits
        if (repo.status === "clean" && repo.unpushedCommits > 0) {
          ui.showMessage(`${repo.path}: 푸시되지 않은 커밋 ${repo.unpushedCommits}개`, "info");
          if (!isHeadless) {
            const action = await ui.promptAction();
            if (action === "push") {
              await commitAndPush(repo, [], "", "push", ui, logger);
            }
          }
        }
        continue;
      }

      const safety = await classifyFiles(repo.files, config);

      if (safety.blocked.length > 0) {
        ui.showBlocked(repo, safety.blocked);
      }

      if (safety.warned.length > 0) {
        if (isHeadless) {
          ui.showMessage(`${repo.path}: 경고 파일 ${safety.warned.length}개 — headless 모드에서 제외`, "warn");
        } else {
          const proceed = await ui.confirmWarned(repo, safety.warned);
          if (proceed) {
            safety.safe.push(...safety.warned);
          }
        }
      }

      if (safety.safe.length === 0) {
        ui.showMessage(`${repo.path}: 커밋할 안전한 파일이 없습니다.`, "warn");
        continue;
      }

      // Group files (skip AI grouping in offline mode)
      const groups = await groupFiles(
        safety.safe,
        offlineMode ? "single" : config.grouping.strategy,
        !offlineMode && config.grouping.strategy === "smart"
          ? (fileList) => ai.groupFiles(fileList)
          : null,
        logger,
      );

      for (const group of groups) {
        let commitMsg: string | null = null;

        if (offlineMode) {
          // Offline mode: use template
          if (isHeadless) {
            commitMsg = `chore: auto-commit ${group.files.length} files`;
          } else {
            commitMsg = await ui.promptOfflineTemplate(getOfflineTemplates());
          }
        } else {
          // AI mode
          const diff = await getDiff(repo, group.files.map((f) => f.path));
          const summarizedDiff = await ai.summarizeDiff(diff);
          commitMsg = await ai.generateCommitMessage(summarizedDiff, config.commit.language);

          if (!commitMsg) {
            ui.showMessage(`${repo.path} [${group.label}]: AI 메시지 생성 실패`, "warn");
            if (!isHeadless) {
              ui.showMessage("오프라인 템플릿으로 전환합니다.", "info");
              commitMsg = await ui.promptOfflineTemplate(getOfflineTemplates());
            } else {
              commitMsg = `chore: auto-commit ${group.files.length} files`;
            }
          }
        }

        if (!commitMsg) continue;

        ui.showCommitPreview(repo, commitMsg, group.files);

        if (group.reason) {
          ui.showMessage(`  그룹핑 이유: ${group.reason}`, "info");
        }

        if (options.dryRun) {
          ui.showMessage("(dry-run) 실제 커밋/푸시를 수행하지 않습니다.", "info");
          continue;
        }

        const action: UserAction = isHeadless ? "push" : await ui.promptAction();

        if (action === "exit") {
          ui.showMessage("종료합니다.", "info");
          ui.cleanup();
          return;
        }

        if (action === "skip-repo") {
          ui.showMessage(`${repo.path}: 저장소 건너뛰기`, "info");
          break; // break out of groups loop, continue to next repo
        }

        await commitAndPush(repo, group.files, commitMsg, action, ui, logger);
      }
    }

    ui.showComplete();
    ui.cleanup();
  });

// ─── Hook subcommand ───

program
  .command("hook")
  .description("Install or uninstall Git hooks")
  .option("--uninstall", "Remove smart-commit hooks")
  .action(async (options) => {
    const { installHooks, uninstallHooks } = await import("./hooks/install.js");
    const ui = createUI();

    if (options.uninstall) {
      const removed = await uninstallHooks(process.cwd());
      if (removed.length > 0) {
        ui.showMessage(`훅 제거 완료: ${removed.join(", ")}`, "success");
      } else {
        ui.showMessage("제거할 smart-commit 훅이 없습니다.", "info");
      }
    } else {
      const { installed, skipped } = await installHooks(process.cwd());
      if (installed.length > 0) {
        ui.showMessage(`훅 설치 완료: ${installed.join(", ")}`, "success");
      }
      if (skipped.length > 0) {
        ui.showMessage(`기존 훅이 있어 건너뜀: ${skipped.join(", ")}`, "warn");
      }
    }

    ui.cleanup();
  });

async function getDiff(repo: RepoState, filePaths: string[]): Promise<string> {
  const { simpleGit } = await import("simple-git");
  const git = simpleGit(repo.path);
  await git.add(filePaths);
  const diff = await git.diff(["--cached", "--", ...filePaths]);
  return diff;
}

program.parse();
