import * as path from 'path';
import type { Finding, SafeSeverity } from '../index';

interface BanditIssue {
  test_id?: string;
  issue_text?: string;
  issue_severity?: string;
  filename: string;
  line_number: number;
}

interface BanditOutput {
  results?: BanditIssue[];
}

export function parseBanditJson(stdout: string, workspaceFolder: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }

  let parsed: BanditOutput;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    console.error('[SafeCheck] Failed to parse Bandit output', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const issue of parsed.results ?? []) {
    const filePath = path.relative(workspaceFolder, path.resolve(workspaceFolder, issue.filename));
    findings.push({
      id: `bandit-${issue.test_id}-${filePath}-${issue.line_number}`,
      ruleId: issue.test_id ?? 'bandit',
      message: issue.issue_text ?? 'Bandit issue',
      severity: normalizeSeverity(issue.issue_severity),
      filePath,
      startLine: issue.line_number,
      tool: 'Bandit'
    });
  }
  return findings;
}

function normalizeSeverity(value?: string): SafeSeverity {
  switch ((value ?? '').toLowerCase()) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'info';
  }
}
