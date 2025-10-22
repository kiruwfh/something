import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseTrivy } from './parsers/trivyParser';

export async function runTrivy(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const args = ['fs', '--quiet', '--format', 'json', '.'];
  const result = await runCmd(context.executable, args, {
    cwd: context.workspaceFolder,
    timeout: context.config.timeout
  });

  if (result.timedOut) {
    return { findings: [], warning: 'Trivy timed out.' };
  }
  if (result.code !== 0 && !result.stdout) {
    return { findings: [], warning: result.stderr || 'Trivy exited with an error.' };
  }

  const findings = parseTrivy(result.stdout, context.workspaceFolder);
  return { findings };
}
