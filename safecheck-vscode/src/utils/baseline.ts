import * as path from 'path';
import type { Finding } from '../scanners';
import { readJsonFile, writeJsonFile } from './fs';

export interface BaselineEntry {
  ruleId: string;
  file: string;
  line: number;
}

export interface BaselineData {
  findings: BaselineEntry[];
}

export function loadBaseline(relativePath: string): BaselineData | undefined {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    return undefined;
  }
  const filePath = path.join(workspaceFolder, relativePath);
  return readJsonFile<BaselineData>(filePath);
}

export function saveBaseline(relativePath: string, findings: Finding[]): void {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    return;
  }
  const filePath = path.join(workspaceFolder, relativePath);
  const entries = findings.map((finding) => ({
    ruleId: finding.ruleId,
    file: finding.file,
    line: finding.line
  }));
  writeJsonFile(filePath, { findings: entries });
}

export function filterBaseline(findings: Finding[], baseline: BaselineData | undefined): Finding[] {
  if (!baseline) {
    return findings;
  }
  return findings.filter((finding) => {
    return !baseline.findings.some((entry) =>
      entry.ruleId === finding.ruleId &&
      normalize(entry.file) === normalize(finding.file) &&
      entry.line === finding.line
    );
  });
}

function normalize(value: string): string {
  return value.replace(/\\/g, '/');
}

function getWorkspaceFolder(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode: typeof import('vscode') = require('vscode');
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
  } catch {
    // vscode module is not available in tests
  }
  return process.env.SAFECHECK_TEST_WORKSPACE;
}
