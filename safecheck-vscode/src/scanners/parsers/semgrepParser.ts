import * as path from 'path';
import type { Finding } from '../index';

interface SemgrepOutput {
  results?: Array<{
    check_id?: string;
    path: string;
    start?: { line?: number; col?: number };
    end?: { line?: number };
    extra?: {
      message?: string;
      severity?: string;
      metadata?: {
        cwe?: string | string[];
      };
    };
  }>;
}

export function parseSemgrep(stdout: string, workspaceFolder: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }
  let parsed: SemgrepOutput;
  try {
    parsed = JSON.parse(stdout) as SemgrepOutput;
  } catch (error) {
    console.error('[SafeCheck] Failed to parse Semgrep output:', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const result of parsed.results ?? []) {
    const filePath = path.relative(workspaceFolder, path.resolve(workspaceFolder, result.path));
    const severity = normalizeSeverity(result.extra?.severity);
    const ruleId = result.check_id ?? 'semgrep';
    const cwe = Array.isArray(result.extra?.metadata?.cwe)
      ? result.extra?.metadata?.cwe[0]
      : result.extra?.metadata?.cwe;
    findings.push({
      tool: 'semgrep',
      ruleId,
      severity,
      message: result.extra?.message ?? 'Semgrep issue',
      file: filePath,
      line: result.start?.line ?? 1,
      endLine: result.end?.line ?? result.start?.line ?? 1,
      column: result.start?.col,
      cwe: cwe || undefined
    });
  }
  return findings;
}

function normalizeSeverity(value: string | undefined): Finding['severity'] {
  switch ((value ?? '').toUpperCase()) {
    case 'CRITICAL':
    case 'ERROR':
      return 'CRITICAL';
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
