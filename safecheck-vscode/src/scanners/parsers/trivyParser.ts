import * as path from 'path';
import type { Finding, SafeSeverity } from '../index';

interface TrivyVulnerability {
  id?: string;
  title?: string;
  severity?: string;
  primaryURL?: string;
  references?: string[];
  pkgName?: string;
}

interface TrivyResult {
  Target?: string;
  Vulnerabilities?: TrivyVulnerability[];
}

interface TrivyOutput {
  Results?: TrivyResult[];
}

export function parseTrivyJson(stdout: string, workspaceFolder: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }

  let parsed: TrivyOutput;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    console.error('[SafeCheck] Failed to parse Trivy output', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const result of parsed.Results ?? []) {
    const targetPath = result.Target ? path.relative(workspaceFolder, path.resolve(workspaceFolder, result.Target)) : '.';
    for (const vuln of result.Vulnerabilities ?? []) {
      const ruleId = vuln.id ?? `trivy-${vuln.pkgName ?? 'issue'}`;
      const message = vuln.title ?? `Trivy issue in ${vuln.pkgName ?? 'target'}`;
      findings.push({
        id: `${ruleId}-${targetPath}`,
        ruleId,
        message,
        severity: normalizeSeverity(vuln.severity),
        filePath: targetPath,
        startLine: 1,
        tool: 'Trivy',
        url: vuln.primaryURL ?? vuln.references?.[0]
      });
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
