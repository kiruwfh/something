import * as path from 'path';
import which from 'which';
import { window } from 'vscode';
import type { SafeCheckConfiguration } from '../config/defaultConfig';
import { loadIgnoreFile, isIgnored, IgnoreConfig } from '../utils/ignore';
import { runSemgrepScan } from './semgrep';
import { runBanditScan } from './bandit';
import { runOsvScan } from './osv';
import { runGitleaksScan } from './gitleaks';
import { runTrivyScan } from './trivy';

export type SafeSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  id: string;
  ruleId: string;
  message: string;
  severity: SafeSeverity;
  filePath: string;
  startLine: number;
  endLine?: number;
  tool: string;
  recommendation?: string;
  url?: string;
}

export interface ScannerRunOptions {
  workspaceFolder: string;
  config: SafeCheckConfiguration;
}

export interface ScanResult {
  findings: Finding[];
  missingTools: string[];
  warnings: string[];
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
  const { workspaceFolder, config } = options;
  const ignore = loadIgnoreFile(workspaceFolder, config.ignoreFile);
  const baseContext = { workspaceFolder, config, ignore } as const;

  const jobs: Array<Promise<PartialScanResult>> = [];

  if (config.enableSemgrep) {
    jobs.push(runWithAvailability('semgrep', config.paths.semgrep, (executable) => runSemgrepScan({ ...baseContext, executable })));
  }
  if (config.enableBandit) {
    jobs.push(runWithAvailability('bandit', config.paths.bandit, (executable) => runBanditScan({ ...baseContext, executable })));
  }
  if (config.enableOsv) {
    jobs.push(runWithAvailability('osv-scanner', config.paths.osv, (executable) => runOsvScan({ ...baseContext, executable })));
  }
  if (config.enableGitleaks) {
    jobs.push(runWithAvailability('gitleaks', config.paths.gitleaks, (executable) => runGitleaksScan({ ...baseContext, executable })));
  }
  if (config.enableTrivy) {
    jobs.push(runWithAvailability('trivy', config.paths.trivy, (executable) => runTrivyScan({ ...baseContext, executable })));
  }

  const results = await Promise.all(jobs);

  const findings: Finding[] = [];
  const missingTools: string[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    if (result.missing) {
      missingTools.push(result.tool);
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
    if (result.findings) {
      findings.push(...result.findings.filter((finding) => shouldIncludeFinding(finding, workspaceFolder, ignore)));
    }
  }

  if (missingTools.length > 0) {
    void window.showWarningMessage(`SafeCheck could not find: ${missingTools.join(', ')}. Check your PATH or SafeCheck settings for guidance.`);
  }

  return { findings, missingTools, warnings };
}

interface PartialScanResult {
  tool: string;
  missing?: boolean;
  warning?: string;
  findings?: Finding[];
}

async function runWithAvailability(tool: string, overridePath: string | undefined, run: (executable: string) => Promise<ToolExecutionResult>): Promise<PartialScanResult> {
  const executable = await resolveExecutable(tool, overridePath);
  if (!executable) {
    return { tool, missing: true };
  }
  try {
    const result = await run(executable);
    return { tool, findings: result.findings, warning: result.warning };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SafeCheck] ${tool} scan failed:`, message);
    return { tool, warning: message, findings: [] };
  }
}

async function resolveExecutable(tool: string, overridePath?: string): Promise<string | undefined> {
  if (overridePath) {
    return overridePath;
  }
  try {
    return await which(tool);
  } catch {
    return undefined;
  }
}

function shouldIncludeFinding(finding: Finding, workspaceFolder: string, ignore: IgnoreConfig): boolean {
  const absolutePath = path.isAbsolute(finding.filePath)
    ? finding.filePath
    : path.join(workspaceFolder, finding.filePath);
  return !isIgnored(ignore, workspaceFolder, absolutePath, finding.ruleId);
}
