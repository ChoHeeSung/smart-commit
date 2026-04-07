import pino from "pino";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";

export function createLogger(): pino.Logger {
  const logDir = join(homedir(), ".smart-commit", "logs");

  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // fallback: log to stderr only
    return pino({ level: "info" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const logFile = join(logDir, `${today}.log`);

  return pino(
    { level: "info" },
    pino.destination({ dest: logFile, append: true, sync: false }),
  );
}
