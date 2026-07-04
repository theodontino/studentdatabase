import { execFile, type ExecFileException } from "node:child_process";

export const WECOMCATCH_SCRIPT_PATH = "$HOME/.openclaw/skills/wecomcatch-archive/scripts/wecomcatch.sh";

export type WeComCatchCommand = "status" | "sync-start" | "sync-status" | "export";

export interface WeComCatchResult {
  command: WeComCatchCommand;
  scriptPath: string;
  stdout: string;
  stderr: string;
  parsed: unknown | null;
}

export type WeComCatchExecFile = (
  file: string,
  args: string[],
  options: { timeout: number; maxBuffer: number },
  callback: (error: ExecFileException | null, stdout: string | Buffer, stderr: string | Buffer) => void
) => void;

const COMMANDS = new Set<WeComCatchCommand>(["status", "sync-start", "sync-status", "export"]);

function parseOutput(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export async function runWeComCatchCommand(
  command: WeComCatchCommand,
  options: { execFileImpl?: WeComCatchExecFile; timeoutMs?: number } = {}
): Promise<WeComCatchResult> {
  if (!COMMANDS.has(command)) throw new Error("不允许的 WeComCatch 命令");

  const execFileImpl = options.execFileImpl ?? (execFile as WeComCatchExecFile);
  const timeout = options.timeoutMs ?? 120_000;
  const maxBuffer = 20 * 1024 * 1024;

  return new Promise((resolve, reject) => {
    execFileImpl(WECOMCATCH_SCRIPT_PATH, [command], { timeout, maxBuffer }, (error, stdoutValue, stderrValue) => {
      const stdout = Buffer.isBuffer(stdoutValue) ? stdoutValue.toString("utf8") : stdoutValue;
      const stderr = Buffer.isBuffer(stderrValue) ? stderrValue.toString("utf8") : stderrValue;
      const result: WeComCatchResult = {
        command,
        scriptPath: WECOMCATCH_SCRIPT_PATH,
        stdout,
        stderr,
        parsed: parseOutput(stdout),
      };

      if (error) {
        const message = stderr.trim() || stdout.trim() || error.message || "WeComCatch 执行失败";
        reject(Object.assign(new Error(message), { result, code: error.code }));
        return;
      }

      resolve(result);
    });
  });
}
