import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseBanditJson } from './parsers/banditParser';

export async function runBanditScan(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const args = ['-q', '-r', '.', '-f', 'json'];
  const result = await runCmd(context.executable, args, {
    cwd: context.workspaceFolder,
    timeout: context.config.timeout
  });

  if (result.timedOut) {
    return { findings: [], warning: 'Bandit timed out' };
  }

  if (result.code !== 0 && !result.stdout) {
    throw new Error(`Bandit exited with code ${result.code}: ${result.stderr}`);
  }

  const findings = parseBanditJson(result.stdout, context.workspaceFolder);
  return { findings };
}
