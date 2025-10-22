import * as path from 'path';
import { workspace } from 'vscode';

export interface ToolPathsConfig {
  semgrep?: string;
  bandit?: string;
  osv?: string;
  gitleaks?: string;
  trivy?: string;
}

export interface SafeCheckConfiguration {
  enableSemgrep: boolean;
  enableBandit: boolean;
  enableOsv: boolean;
  enableGitleaks: boolean;
  enableTrivy: boolean;
  timeout: number;
  baseline: {
    enabled: boolean;
    path: string;
  };
  ignoreFile: string;
  report: {
    output: string;
  };
  severity: {
    levels: Record<string, string>;
  };
  llm: {
    enabled: boolean;
    provider: string;
    model: string;
    baseUrl: string;
  };
  paths: ToolPathsConfig;
}

export function getDefaultConfiguration(): SafeCheckConfiguration {
  const config = workspace.getConfiguration('safecheck');
  return {
    enableSemgrep: config.get<boolean>('enableSemgrep', true),
    enableBandit: config.get<boolean>('enableBandit', true),
    enableOsv: config.get<boolean>('enableOsv', true),
    enableGitleaks: config.get<boolean>('enableGitleaks', true),
    enableTrivy: config.get<boolean>('enableTrivy', false),
    timeout: config.get<number>('timeout', 180000),
    baseline: {
      enabled: config.get<boolean>('baseline.enabled', true),
      path: config.get<string>('baseline.path', '.safecheck/baseline.json')
    },
    ignoreFile: config.get<string>('ignoreFile', '.safecheckignore'),
    report: {
      output: config.get<string>('report.output', '.safecheck/reports')
    },
    severity: {
      levels: config.get<Record<string, string>>('severity.levels', {
        critical: 'Error',
        high: 'Error',
        medium: 'Warning',
        low: 'Information',
        info: 'Information'
      })
    },
    llm: {
      enabled: config.get<boolean>('llm.enabled', false),
      provider: config.get<string>('llm.provider', 'openrouter'),
      model: config.get<string>('llm.model', 'openrouter/auto'),
      baseUrl: config.get<string>('llm.baseUrl', 'https://openrouter.ai/api/v1')
    },
    paths: {
      semgrep: resolveWorkspacePath(config.get<string>('paths.semgrep', '')),
      bandit: resolveWorkspacePath(config.get<string>('paths.bandit', '')),
      osv: resolveWorkspacePath(config.get<string>('paths.osv', '')),
      gitleaks: resolveWorkspacePath(config.get<string>('paths.gitleaks', '')),
      trivy: resolveWorkspacePath(config.get<string>('paths.trivy', ''))
    }
  };
}

function resolveWorkspacePath(value?: string): string | undefined {
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
