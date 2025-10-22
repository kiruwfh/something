import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseSemgrep } from './parsers/semgrepParser';

export async function runSemgrep(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const args = ['--json', '--config', 'p/owasp-top-ten', '--no-git'];
  for (const pattern of context.config.scanExclude) {
    args.push('--exclude', pattern);
  }
  args.push('.');

  const result = await runCmd(context.executable, args, {
    cwd: context.workspaceFolder,
    timeout: context.config.timeout
  });

  if (result.timedOut) {
    return { findings: [], warning: 'Semgrep timed out' };
  }
  if (result.code !== 0 && !result.stdout) {
    return { findings: [], warning: result.stderr || 'Semgrep exited with an error.' };
  }

  const findings = parseSemgrep(result.stdout, context.workspaceFolder);
  return { findings };
}
