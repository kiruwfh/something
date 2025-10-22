import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseBandit } from './parsers/banditParser';

export async function runBandit(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const args = ['-f', 'json', '-q', '.'];
  const result = await runCmd(context.executable, args, {
    cwd: context.workspaceFolder,
    timeout: context.config.timeout
  });

  if (result.timedOut) {
    return { findings: [], warning: 'Bandit timed out' };
  }
  if (result.code !== 0 && !result.stdout) {
    return { findings: [], warning: result.stderr || 'Bandit exited with an error.' };
  }

  const findings = parseBandit(result.stdout, context.workspaceFolder);
  return { findings };
}
