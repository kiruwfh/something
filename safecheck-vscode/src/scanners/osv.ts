import * as fs from 'fs';
import * as path from 'path';
import { runCmd } from '../utils/exec';
import type { Finding, ScannerContext } from './index';
import { parseOsvJson } from './parsers/osvParser';

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

export async function runOsvScan(context: ScannerContext): Promise<{ findings: Finding[]; warning?: string }> {
  const lockfiles = LOCKFILES.filter((file) => fs.existsSync(path.join(context.workspaceFolder, file)));

  if (lockfiles.length === 0) {
    return { findings: [], warning: 'OSV-Scanner: no supported lockfiles found' };
  }

  const findings: Finding[] = [];
  for (const lockfile of lockfiles) {
    const args = ['--format', 'json', '--lockfile', lockfile];
    const result = await runCmd(context.executable, args, {
      cwd: context.workspaceFolder,
      timeout: context.config.timeout
    });

    if (result.timedOut) {
      return { findings, warning: 'OSV-Scanner timed out' };
    }

    if (result.code !== 0 && !result.stdout) {
      throw new Error(`OSV-Scanner exited with code ${result.code}: ${result.stderr}`);
    }

    findings.push(...parseOsvJson(result.stdout, context.workspaceFolder, lockfile));
  }

  return { findings };
}
