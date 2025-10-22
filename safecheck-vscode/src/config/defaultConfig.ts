import * as path from 'path';
import { workspace } from 'vscode';

export interface SafeCheckConfiguration {
  tools: {
    semgrep: { enabled: boolean };
    bandit: { enabled: boolean };
    osv: { enabled: boolean };
    gitleaks: { enabled: boolean };
    trivy: { enabled: boolean };
  };
  paths: {
    semgrep?: string;
    bandit?: string;
    osv?: string;
    gitleaks?: string;
    trivy?: string;
  };
  scanExclude: string[];
  reports: {
    outputDir: string;
  };
  baseline: {
    enabled: boolean;
    path: string;
  };
  llm: {
    enabled: boolean;
    baseUrl: string;
    model: string;
  };
  timeout: number;
}

export function getDefaultConfiguration(): SafeCheckConfiguration {
  const config = workspace.getConfiguration('safecheck');
  return {
    tools: {
      semgrep: { enabled: config.get<boolean>('tools.semgrep.enabled', true) },
      bandit: { enabled: config.get<boolean>('tools.bandit.enabled', true) },
      osv: { enabled: config.get<boolean>('tools.osv.enabled', true) },
      gitleaks: { enabled: config.get<boolean>('tools.gitleaks.enabled', true) },
      trivy: { enabled: config.get<boolean>('tools.trivy.enabled', false) }
    },
    paths: {
      semgrep: resolveWorkspacePath(config.get<string>('paths.semgrep')),
      bandit: resolveWorkspacePath(config.get<string>('paths.bandit')),
      osv: resolveWorkspacePath(config.get<string>('paths.osv')),
      gitleaks: resolveWorkspacePath(config.get<string>('paths.gitleaks')),
      trivy: resolveWorkspacePath(config.get<string>('paths.trivy'))
    },
    scanExclude: config.get<string[]>('scan.exclude', []),
    reports: {
      outputDir: config.get<string>('reports.outputDir', '.safecheck/reports')
    },
    baseline: {
      enabled: config.get<boolean>('baseline.enabled', true),
      path: config.get<string>('baseline.path', '.safecheck/baseline.json')
    },
    llm: {
      enabled: config.get<boolean>('llm.enabled', false),
      baseUrl: config.get<string>('llm.baseUrl', 'https://openrouter.ai/api/v1'),
      model: config.get<string>('llm.model', 'deepseek/deepseek-chat-v3.1:free')
    },
    timeout: config.get<number>('timeout', 180000)
  };
}

function resolveWorkspacePath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (path.isAbsolute(value)) {
    return value;
  }
  const folders = workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return value;
  }
  return path.join(folders[0].uri.fsPath, value);
}
