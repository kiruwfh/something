import type { Finding } from '../index';

export function buildSarif(findings: Finding[], workspaceFolder: string): unknown {
  const results = findings.map((finding) => ({
    ruleId: finding.ruleId,
    message: { text: finding.message },
    level: toSarifLevel(finding.severity),
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: finding.file.replace(/\\/g, '/'),
            uriBaseId: '%SRCROOT%'
          },
          region: {
            startLine: Math.max(1, finding.line),
            endLine: finding.endLine ?? finding.line
          }
        }
      }
    ],
    properties: {
      tool: finding.tool,
      cwe: finding.cwe
    }
  }));

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'SafeCheck',
            informationUri: 'https://github.com/safecheck/safecheck-vscode',
            rules: aggregateRules(findings)
          }
        },
        artifacts: [
          {
            location: {
              uri: '.',
              uriBaseId: '%SRCROOT%'
            },
            sourceLanguage: 'multi'
          }
        ],
        results,
        originalUriBaseIds: {
          '%SRCROOT%': {
            uri: workspaceFolder.replace(/\\/g, '/'),
            description: { text: 'Workspace root' }
          }
        }
      }
    ]
  };
}

function aggregateRules(findings: Finding[]): Array<{ id: string; name: string; helpUri?: string }> {
  const seen = new Map<string, { id: string; name: string; helpUri?: string }>();
  for (const finding of findings) {
    if (!seen.has(finding.ruleId)) {
      seen.set(finding.ruleId, {
        id: finding.ruleId,
        name: finding.message.slice(0, 160),
        helpUri: undefined
      });
    }
  }
  return Array.from(seen.values());
}

function toSarifLevel(severity: Finding['severity']): string {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'error';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
    default:
      return 'note';
  }
}
