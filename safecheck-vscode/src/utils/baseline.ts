import * as path from 'path';
import type { Finding } from '../scanners';
import { readJsonFile, writeJsonFile } from './fs';

let vscodeWorkspace: typeof import('vscode').workspace | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  vscodeWorkspace = require('vscode').workspace;
} catch {
  vscodeWorkspace = undefined;
}

export interface BaselineData {
  findings: Array<Pick<Finding, 'ruleId' | 'filePath' | 'startLine'>>;
}

export function getBaselinePath(defaultPath: string): string | undefined {
  const folder = getWorkspaceFolder();
  if (!folder) {
    return undefined;
  }
  return path.join(folder, defaultPath);
}

export function loadBaseline(defaultPath: string): BaselineData | undefined {
  const baselinePath = getBaselinePath(defaultPath);
  if (!baselinePath) {
    return undefined;
  }
  return readJsonFile<BaselineData>(baselinePath);
}

export function saveBaseline(defaultPath: string, findings: Finding[]): void {
  const baselinePath = getBaselinePath(defaultPath);
  if (!baselinePath) {
    return;
  }
  const data: BaselineData = {
    findings: findings.map((finding) => ({
      ruleId: finding.ruleId,
      filePath: finding.filePath,
      startLine: finding.startLine
    }))
  };
  writeJsonFile(baselinePath, data);
}

export function filterBaseline(findings: Finding[], baseline: BaselineData | undefined): Finding[] {
  if (!baseline) {
    return findings;
  }
  return findings.filter((finding) => {
    return !baseline.findings.some((base) =>
      base.ruleId === finding.ruleId &&
      normalizePath(base.filePath) === normalizePath(finding.filePath) &&
      base.startLine === finding.startLine
    );
  });
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function getWorkspaceFolder(): string | undefined {
  const folders = vscodeWorkspace?.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return process.env.SAFECHECK_TEST_WORKSPACE || process.cwd();
}
