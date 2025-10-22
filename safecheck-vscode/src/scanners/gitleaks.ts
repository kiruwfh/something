import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseGitleaks } from './parsers/gitleaksParser';

export async function runGitleaks(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const args = ['detect', '--no-banner', '--report-format', 'json', '--source', '.'];
  const result = await runCmd(context.executable, args, {
    cwd: context.workspaceFolder,
    timeout: context.config.timeout
  });

  if (result.timedOut) {
    return { findings: [], warning: 'Gitleaks timed out.' };
  }
  if (result.code !== 0 && !result.stdout) {
    return { findings: [], warning: result.stderr || 'Gitleaks exited with an error.' };
  }

  const findings = parseGitleaks(result.stdout, context.workspaceFolder);
  return { findings };
}
