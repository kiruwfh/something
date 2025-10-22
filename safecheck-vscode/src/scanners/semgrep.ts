import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseSemgrepJson } from './parsers/semgrepParser';

export async function runSemgrepScan(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const args = ['-q', '--json', '--config', 'p/owasp-top-ten', '--no-git', '.'];
  const result = await runCmd(context.executable, args, {
    cwd: context.workspaceFolder,
    timeout: context.config.timeout
  });

  if (result.timedOut) {
    return { findings: [], warning: 'Semgrep timed out' };
  }

  if (result.code !== 0 && !result.stdout) {
    throw new Error(`Semgrep exited with code ${result.code}: ${result.stderr}`);
  }

  const findings = parseSemgrepJson(result.stdout, context.workspaceFolder);
  return { findings };
}
