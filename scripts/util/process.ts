import { spawn } from "node:child_process";

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ExecuteOptions {
  cmd: string[];
  cwd?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  env?: Record<string, string>;
}

/**
 * Execute a command safely using argument arrays (no shell interpolation).
 * Enforces timeouts and bounds on stdout/stderr output.
 */
export async function executeCommand(options: ExecuteOptions): Promise<ProcessResult> {
  const {
    cmd,
    cwd = process.cwd(),
    timeoutMs = 15000,
    maxOutputBytes = 5 * 1024 * 1024, // 5MB limit
    env = {},
  } = options;

  if (!cmd || cmd.length === 0) {
    throw new Error("Cannot execute empty command array");
  }

  const [executable, ...args] = cmd;

  return new Promise<ProcessResult>((resolve) => {
    let timedOut = false;
    let timer: NodeJS.Timeout | null = null;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;

    const child = spawn(executable, args, {
      cwd,
      env: {
        ...process.env,
        ...env,
        // Disable git pager and interactive prompts
        GIT_PAGER: "cat",
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
      },
      shell: false, // Strict: never invoke shell interpreter
      windowsHide: true,
    });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill("SIGKILL");
        } catch {
          // Process might already be dead
        }
      }, timeoutMs);
    }

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdoutBytes < maxOutputBytes) {
        const remaining = maxOutputBytes - stdoutBytes;
        const text = chunk.slice(0, remaining).toString("utf-8");
        stdoutBuffer += text;
        stdoutBytes += chunk.length;
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrBytes < maxOutputBytes) {
        const remaining = maxOutputBytes - stderrBytes;
        const text = chunk.slice(0, remaining).toString("utf-8");
        stderrBuffer += text;
        stderrBytes += chunk.length;
      }
    });

    child.on("error", (err: Error) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout: stdoutBuffer,
        stderr: (stderrBuffer ? stderrBuffer + "\n" : "") + err.message,
        timedOut,
      });
    });

    child.on("close", (code: number | null) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: code ?? (timedOut ? -2 : 0),
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
        timedOut,
      });
    });
  });
}
