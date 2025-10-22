import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseTrivyJson } from './parsers/trivyParser';

export async function runTrivyScan(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const args = ['fs', '--quiet', '--format', 'json', '.'];
  const result = await runCmd(context.executable, args, {
    cwd: context.workspaceFolder,
    timeout: context.config.timeout
  });

  if (result.timedOut) {
    return { findings: [], warning: 'Trivy timed out' };
  }

  if (result.code !== 0 && !result.stdout) {
    throw new Error(`Trivy exited with code ${result.code}: ${result.stderr}`);
  }

  const findings = parseTrivyJson(result.stdout, context.workspaceFolder);
  return { findings };
}
