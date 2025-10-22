import * as path from 'path';
import type { Finding } from '../index';

interface BanditResult {
  results?: Array<{
    test_id?: string;
    issue_text?: string;
    issue_severity?: string;
    filename: string;
    line_number: number;
  }>;
}

export function parseBandit(stdout: string, workspaceFolder: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }
  let parsed: BanditResult;
  try {
    parsed = JSON.parse(stdout) as BanditResult;
  } catch (error) {
    console.error('[SafeCheck] Failed to parse Bandit output:', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const issue of parsed.results ?? []) {
    const file = path.relative(workspaceFolder, path.resolve(workspaceFolder, issue.filename));
    findings.push({
      tool: 'bandit',
      ruleId: issue.test_id ?? 'bandit',
      message: issue.issue_text ?? 'Bandit issue',
      severity: normalizeSeverity(issue.issue_severity),
      file,
      line: issue.line_number,
      endLine: issue.line_number
    });
  }
  return findings;
}

function normalizeSeverity(value?: string): Finding['severity'] {
  switch ((value ?? '').toUpperCase()) {
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'MEDIUM';
    case 'LOW':
      return 'LOW';
    default:
      return 'MEDIUM';
  }
}
