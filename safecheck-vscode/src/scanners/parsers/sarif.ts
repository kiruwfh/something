import type { Finding } from '../index';

export function buildSarifReport(findings: Finding[], toolName = 'SafeCheck', version = '0.1.0'): any {
  const results = findings.map((finding) => ({
    ruleId: finding.ruleId,
    message: { text: finding.message },
    level: toSarifLevel(finding.severity),
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: finding.filePath.replace(/\\/g, '/'),
            uriBaseId: '%SRCROOT%'
          },
          region: {
            startLine: Math.max(1, finding.startLine),
            endLine: finding.endLine ?? finding.startLine
          }
        }
      }
    ],
    properties: {
      tool: finding.tool,
      recommendation: finding.recommendation,
      url: finding.url
    }
  }));

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            version,
            informationUri: 'https://github.com/safecheck/safecheck-vscode',
            rules: aggregateRules(findings)
          }
        },
        results
      }
    ]
  };
}

function aggregateRules(findings: Finding[]) {
  const seen = new Map<string, { id: string; name: string; helpUri?: string }>();
  for (const finding of findings) {
    if (!seen.has(finding.ruleId)) {
      seen.set(finding.ruleId, {
        id: finding.ruleId,
        name: finding.message.slice(0, 120),
        helpUri: finding.url
      });
    }
  }
  return Array.from(seen.values());
}

function toSarifLevel(severity: Finding['severity']): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'note';
    default:
      return 'note';
  }
}
