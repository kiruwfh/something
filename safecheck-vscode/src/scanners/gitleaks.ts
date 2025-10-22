import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseGitleaksJson } from './parsers/gitleaksParser';

export async function runGitleaksScan(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const args = ['detect', '--no-banner', '--report-format', 'json', '--source', '.'];
  const result = await runCmd(context.executable, args, {
    cwd: context.workspaceFolder,
    timeout: context.config.timeout
  });

  if (result.timedOut) {
    return { findings: [], warning: 'Gitleaks timed out' };
  }

  if (result.code !== 0 && !result.stdout) {
    throw new Error(`Gitleaks exited with code ${result.code}: ${result.stderr}`);
  }

  const findings = parseGitleaksJson(result.stdout, context.workspaceFolder);
  return { findings };
}
