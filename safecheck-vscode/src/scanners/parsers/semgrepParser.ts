import * as path from 'path';
import type { Finding, SafeSeverity } from '../index';

interface SemgrepResult {
  results?: Array<{
    check_id?: string;
    path: string;
    start: { line: number };
    end?: { line: number };
    extra?: {
      message?: string;
      severity?: string;
      metadata?: {
        shortlink?: string;
        references?: string[];
      };
    };
  }>;
}

export function parseSemgrepJson(stdout: string, workspaceFolder: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }

  let parsed: SemgrepResult;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    console.error('[SafeCheck] Failed to parse Semgrep output', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const result of parsed.results ?? []) {
    const filePath = path.relative(workspaceFolder, path.resolve(workspaceFolder, result.path));
    const ruleId = result.check_id ?? 'semgrep';
    const message = result.extra?.message ?? 'Semgrep issue';
    const severity = normalizeSeverity(result.extra?.severity);
    findings.push({
      id: `semgrep-${ruleId}-${filePath}-${result.start?.line ?? 0}`,
      ruleId,
      message,
      severity,
      filePath,
      startLine: result.start?.line ?? 0,
      endLine: result.end?.line,
      tool: 'Semgrep',
      url: result.extra?.metadata?.shortlink ?? result.extra?.metadata?.references?.[0]
    });
  }
  return findings;
}

function normalizeSeverity(value?: string): SafeSeverity {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
    case 'error':
      return 'critical';
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
