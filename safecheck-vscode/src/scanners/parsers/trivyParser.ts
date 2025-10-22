import * as path from 'path';
import type { Finding } from '../index';

interface TrivyVulnerability {
  VulnerabilityID?: string;
  Title?: string;
  Severity?: string;
  PrimaryURL?: string;
  References?: string[];
  id?: string;
  title?: string;
  severity?: string;
  primaryURL?: string;
  references?: string[];
}

interface TrivyResult {
  Target?: string;
  Vulnerabilities?: TrivyVulnerability[];
}

interface TrivyOutput {
  Results?: TrivyResult[];
}

export function parseTrivy(stdout: string, workspaceFolder: string): Finding[] {
  if (!stdout.trim()) {
    return [];
  }
  let parsed: TrivyOutput;
  try {
    parsed = JSON.parse(stdout) as TrivyOutput;
  } catch (error) {
    console.error('[SafeCheck] Failed to parse Trivy output:', error);
    return [];
  }

  const findings: Finding[] = [];
  for (const result of parsed.Results ?? []) {
    const target = result.Target ? path.relative(workspaceFolder, path.resolve(workspaceFolder, result.Target)) : '.';
    for (const vuln of result.Vulnerabilities ?? []) {
      const ruleId = vuln.VulnerabilityID ?? vuln.id ?? 'trivy';
      findings.push({
        tool: 'trivy',
        ruleId,
        message: vuln.Title ?? vuln.title ?? `Trivy issue in ${target}`,
        severity: normalizeSeverity(vuln.Severity ?? vuln.severity),
        file: target,
        line: 1,
        endLine: 1,
        cwe: undefined
      });
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
