import * as path from 'path';
import type { Finding } from '../index';

interface OsvVulnerability {
  summary?: string;
  database_specific?: {
    severity?: string;
    cwe_ids?: string[];
    url?: string;
  };
}

interface OsvPackage {
  package?: { name?: string };
  vulnerabilities?: OsvVulnerability[];
}

interface OsvResult {
  results?: Array<{
    packages?: OsvPackage[];
  }>;
}

export function parseOsv(stdout: string, workspaceFolder: string, lockfile: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }
  let parsed: OsvResult;
  try {
    parsed = JSON.parse(stdout) as OsvResult;
  } catch (error) {
    console.error('[SafeCheck] Failed to parse OSV output:', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const result of parsed.results ?? []) {
    for (const pkg of result.packages ?? []) {
      for (const vuln of pkg.vulnerabilities ?? []) {
        const name = pkg.package?.name ?? 'dependency';
        const message = vuln.summary ?? `Vulnerability found in ${name}`;
        const severity = normalizeSeverity(vuln.database_specific?.severity);
        findings.push({
          tool: 'osv',
          ruleId: `OSV-${name}`,
          message,
          severity,
          file: path.relative(workspaceFolder, path.resolve(workspaceFolder, lockfile)),
          line: 1,
          endLine: 1,
          cwe: vuln.database_specific?.cwe_ids?.[0]
        });
      }
    }
  }
  return findings;
}

function normalizeSeverity(value?: string): Finding['severity'] {
  switch ((value ?? '').toUpperCase()) {
    case 'CRITICAL':
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
