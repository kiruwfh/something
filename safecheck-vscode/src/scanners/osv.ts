import * as fs from 'fs';
import * as path from 'path';
import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseOsv } from './parsers/osvParser';

const LOCKFILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'poetry.lock',
  'Pipfile.lock',
  'requirements.txt',
  'pom.xml',
  'build.gradle',
  'go.mod'
];

export async function runOsvScanner(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const lockfiles = LOCKFILES.filter((file) => fs.existsSync(path.join(context.workspaceFolder, file)));
  if (lockfiles.length === 0) {
    return { findings: [], warning: 'OSV-Scanner: no supported lockfiles found.' };
  }

  const findings: Finding[] = [];
  for (const lockfile of lockfiles) {
    const args = ['--format', 'json', '--lockfile', lockfile];
    const result = await runCmd(context.executable, args, {
      cwd: context.workspaceFolder,
      timeout: context.config.timeout
    });
    if (result.timedOut) {
      return { findings, warning: 'OSV-Scanner timed out.' };
    }
    if (result.code !== 0 && !result.stdout) {
      return { findings, warning: result.stderr || 'OSV-Scanner exited with an error.' };
    }
    findings.push(...parseOsv(result.stdout, context.workspaceFolder, lockfile));
  }
  return { findings };
}
