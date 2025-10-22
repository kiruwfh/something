import * as path from 'path';
import type { Finding } from '../index';

interface GitleaksIssue {
  ruleID?: string;
  description?: string;
  file?: string;
  startLine?: number;
  endLine?: number;
}

export function parseGitleaks(stdout: string, workspaceFolder: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }
  let parsed: GitleaksIssue[];
  try {
    parsed = JSON.parse(stdout) as GitleaksIssue[];
  } catch (error) {
    console.error('[SafeCheck] Failed to parse Gitleaks output:', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const issue of parsed) {
    const file = path.relative(workspaceFolder, path.resolve(workspaceFolder, issue.file ?? ''));
    findings.push({
      tool: 'gitleaks',
      ruleId: issue.ruleID ?? 'gitleaks',
      message: issue.description ?? 'Secret detected',
      severity: 'HIGH',
      file,
      line: issue.startLine ?? 1,
      endLine: issue.endLine ?? issue.startLine ?? 1
    });
  }
  return findings;
}
