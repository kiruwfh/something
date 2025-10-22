import * as path from 'path';
import type { Finding } from '../index';

interface GitleaksIssue {
  ruleID?: string;
  description?: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  commit?: string;
}

export function parseGitleaksJson(stdout: string, workspaceFolder: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }

  let parsed: GitleaksIssue[];
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    console.error('[SafeCheck] Failed to parse Gitleaks output', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const issue of parsed) {
    const filePath = path.relative(workspaceFolder, path.resolve(workspaceFolder, issue.file ?? ''));
    findings.push({
      id: `gitleaks-${issue.ruleID}-${filePath}-${issue.startLine ?? 0}`,
      ruleId: issue.ruleID ?? 'gitleaks',
      message: issue.description ?? 'Secret detected',
      severity: 'high',
      filePath,
      startLine: issue.startLine ?? 0,
      endLine: issue.endLine,
      tool: 'Gitleaks',
      url: issue.commit ? `https://github.com/search?q=${issue.commit}` : undefined
    });
  }
  return findings;
}
