import { spawn } from 'child_process';

export interface RunCmdOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  maxBuffer?: number;
}

export interface RunCmdResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const DEFAULT_MAX_BUFFER = 5 * 1024 * 1024;

export function runCmd(cmd: string, args: string[] = [], opts: RunCmdOptions = {}): Promise<RunCmdResult> {
  return new Promise((resolve) => {
    const { cwd, env, timeout = 180000, maxBuffer = DEFAULT_MAX_BUFFER } = opts;
    const child = spawn(cmd, args, { cwd, env, shell: false, windowsHide: true });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const done = (code: number | null, timedOut: boolean) => {
      if (finished) {
        return;
      }
      finished = true;
      resolve({ code, stdout, stderr, timedOut });
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length + chunk.length > maxBuffer) {
        stdout += chunk.slice(0, Math.max(0, maxBuffer - stdout.length)).toString();
        stderr += `\n[SafeCheck] stdout truncated after ${maxBuffer} bytes.`;
        child.kill();
        return;
      }
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length + chunk.length > maxBuffer) {
        stderr += chunk.slice(0, Math.max(0, maxBuffer - stderr.length)).toString();
        stderr += `\n[SafeCheck] stderr truncated after ${maxBuffer} bytes.`;
        child.kill();
        return;
      }
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      stderr += `\n${error.message}`;
      done(null, false);
    });

    child.on('close', (code) => done(code, false));

    if (timeout > 0) {
      setTimeout(() => {
        if (!finished) {
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 2000);
          done(null, true);
        }
      }, timeout);
    }
  });
}
