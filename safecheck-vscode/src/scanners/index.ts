import * as path from 'path';
import * as vscode from 'vscode';
import which from 'which';
import { getDefaultConfiguration, SafeCheckConfiguration } from '../config/defaultConfig';
import { loadIgnoreConfig, IgnoreConfig, isIgnored } from '../utils/ignore';
import { runSemgrep } from './semgrep';
import { runBandit } from './bandit';
import { runOsvScanner } from './osv';
import { runGitleaks } from './gitleaks';
import { runTrivy } from './trivy';

export type SupportedTool = 'semgrep' | 'bandit' | 'osv' | 'gitleaks' | 'trivy';

export type FindingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Finding {
  tool: SupportedTool;
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  file: string;
  line: number;
  endLine?: number;
  column?: number;
  cwe?: string;
}

export interface ScannerRunOptions {
  workspaceFolder: string;
  config?: SafeCheckConfiguration;
}

export interface ScanResult {
  findings: Finding[];
  warnings: string[];
  missingTools: SupportedTool[];
}

export interface ScannerContext {
  workspaceFolder: string;
  executable: string;
  config: SafeCheckConfiguration;
  ignore: IgnoreConfig;
}

interface ToolExecutionResult {
  findings: Finding[];
  warning?: string;
}

export async function runAllScans(options: ScannerRunOptions): Promise<ScanResult> {
  const config = options.config ?? getDefaultConfiguration();
  const ignore = loadIgnoreConfig(options.workspaceFolder);
  const contexts: Array<Promise<PartialResult>> = [];

  if (config.tools.semgrep.enabled) {
    contexts.push(runWithAvailability('semgrep', config.paths.semgrep, (executable) =>
      runSemgrep({ workspaceFolder: options.workspaceFolder, executable, config, ignore })
    ));
  }
  if (config.tools.bandit.enabled) {
    contexts.push(runWithAvailability('bandit', config.paths.bandit, (executable) =>
      runBandit({ workspaceFolder: options.workspaceFolder, executable, config, ignore })
    ));
  }
  if (config.tools.osv.enabled) {
    contexts.push(runWithAvailability('osv', config.paths.osv, (executable) =>
      runOsvScanner({ workspaceFolder: options.workspaceFolder, executable, config, ignore })
    ));
  }
  if (config.tools.gitleaks.enabled) {
    contexts.push(runWithAvailability('gitleaks', config.paths.gitleaks, (executable) =>
      runGitleaks({ workspaceFolder: options.workspaceFolder, executable, config, ignore })
    ));
  }
  if (config.tools.trivy.enabled) {
    contexts.push(runWithAvailability('trivy', config.paths.trivy, (executable) =>
      runTrivy({ workspaceFolder: options.workspaceFolder, executable, config, ignore })
    ));
  }

  const results = await Promise.all(contexts);

  const findings: Finding[] = [];
  const warnings: string[] = [];
  const missingTools: SupportedTool[] = [];

  for (const result of results) {
    if (result.missing) {
      missingTools.push(result.tool);
      continue;
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
    if (!result.findings) {
      continue;
    }
    for (const finding of result.findings) {
      if (!shouldIncludeFinding(finding, options.workspaceFolder, ignore)) {
        continue;
      }
      findings.push(finding);
    }
  }

  return { findings, warnings, missingTools };
}

interface PartialResult {
  tool: SupportedTool;
  missing?: boolean;
  warning?: string;
  findings?: Finding[];
}

async function runWithAvailability(
  tool: SupportedTool,
  overridePath: string | undefined,
  executor: (executable: string) => Promise<ToolExecutionResult>
): Promise<PartialResult> {
  const executable = await resolveExecutable(tool, overridePath);
  if (!executable) {
    return { tool, missing: true };
  }
  try {
    const result = await executor(executable);
    return { tool, findings: result.findings, warning: result.warning };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SafeCheck] ${tool} execution failed: ${message}`);
    return { tool, findings: [], warning: message };
  }
}

async function resolveExecutable(tool: SupportedTool, override?: string): Promise<string | undefined> {
  if (override) {
    return override;
  }
  try {
    const resolved = await which(tool === 'osv' ? 'osv-scanner' : tool);
    return resolved;
  } catch {
    return undefined;
  }
}

function shouldIncludeFinding(finding: Finding, workspaceFolder: string, ignore: IgnoreConfig): boolean {
  const absolute = path.isAbsolute(finding.file)
    ? finding.file
    : path.join(workspaceFolder, finding.file);
  if (isIgnored(ignore, workspaceFolder, absolute, finding.ruleId)) {
    return false;
  }
  return true;
}

export function showMissingToolMessage(tools: SupportedTool[]): void {
  if (tools.length === 0) {
    return;
  }
  const instructionsLink = vscode.Uri.parse('https://github.com/safecheck/safecheck-vscode#external-scanners');
  void vscode.window.showInformationMessage(
    `SafeCheck could not find ${tools.join(', ')}. Install them and ensure they are on your PATH.`,
    'Open setup guide'
  ).then((selection) => {
    if (selection === 'Open setup guide') {
      void vscode.env.openExternal(instructionsLink);
    }
  });
}
