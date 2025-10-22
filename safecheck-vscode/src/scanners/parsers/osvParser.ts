import * as path from 'path';
import type { Finding, SafeSeverity } from '../index';

interface OsvFinding {
  summary?: string;
  database_specific?: { severity?: string; url?: string };
}

interface OsvPackage {
  package?: { name?: string };
  vulnerabilities?: OsvFinding[];
}

interface OsvReport {
  results?: Array<{
    packages?: OsvPackage[];
  }>;
}

export function parseOsvJson(stdout: string, workspaceFolder: string, lockfile: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }

  let parsed: OsvReport;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    console.error('[SafeCheck] Failed to parse OSV output', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const result of parsed.results ?? []) {
    for (const pkg of result.packages ?? []) {
      for (const vuln of pkg.vulnerabilities ?? []) {
        const packageName = pkg.package?.name ?? 'dependency';
        const ruleId = `osv-${packageName}`;
        const message = vuln.summary ?? `Vulnerability found in ${packageName}`;
        const severity = normalizeSeverity(vuln.database_specific?.severity);
        const filePath = path.relative(workspaceFolder, path.resolve(workspaceFolder, lockfile));
        findings.push({
          id: `${ruleId}-${filePath}`,
          ruleId,
          message,
          severity,
          filePath,
          startLine: 1,
          tool: 'OSV-Scanner',
          url: vuln.database_specific?.url
        });
      }
    }
  }
  return findings;
}

function normalizeSeverity(value?: string): SafeSeverity {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
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
