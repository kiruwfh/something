import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getDefaultConfiguration } from './config/defaultConfig';
import { DiagnosticManager } from './diagnostics/diagnosticManager';
import { registerCodeActions } from './diagnostics/codeActions';
import { runAllScans, Finding } from './scanners';
import { filterBaseline, loadBaseline, saveBaseline } from './utils/baseline';
import { ensureDir, writeJsonFile, readFileSafe } from './utils/fs';
import { SafeCheckPanel } from './ui/panel';
import { buildSarifReport } from './scanners/parsers/sarif';
import { createLlmProvider } from './llm/openrouterProvider';
import type { LlmProvider } from './llm/provider';

let diagnosticManager: DiagnosticManager;
let currentFindings: Finding[] = [];
let rawFindings: Finding[] = [];
let llmProvider: LlmProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  diagnosticManager = new DiagnosticManager();
  context.subscriptions.push(diagnosticManager);
  registerCodeActions(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.scanWorkspace', async () => {
      await scanWorkspace(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.exportSarif', async () => {
      await exportReports();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.toggleBaseline', async () => {
      const config = getDefaultConfiguration();
      const workspaceFolder = getWorkspaceFolder();
      if (!workspaceFolder) {
        void vscode.window.showErrorMessage('SafeCheck requires an open workspace.');
        return;
      }
      saveBaseline(config.baseline.path, rawFindings);
      void vscode.window.showInformationMessage('SafeCheck baseline updated.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.openPanel', () => {
      SafeCheckPanel.createOrShow(context).update(currentFindings, isLlmEnabled());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.ignoreFinding', async (payload: { filePath?: string; ruleId?: string }) => {
      const workspaceFolder = getWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }
      const config = getDefaultConfiguration();
      const ignorePath = path.join(workspaceFolder, config.ignoreFile);
      ensureDir(path.dirname(ignorePath));
      if (!fs.existsSync(ignorePath)) {
        fs.writeFileSync(ignorePath, '# SafeCheck ignore file\n', 'utf8');
      }
      const entry = payload?.ruleId ? `rule:${payload.ruleId}` : payload?.filePath ?? '';
      if (!entry) {
        return;
      }
      fs.appendFileSync(ignorePath, `\n${entry}`);
      void vscode.window.showInformationMessage(`Added ${entry} to ${config.ignoreFile}.`);
      await scanWorkspace(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.aiSuggest', async (payload: { filePath?: string; ruleId?: string }) => {
      if (!isLlmEnabled()) {
        void vscode.window.showWarningMessage('SafeCheck AI assistant is disabled. Enable it in settings.');
        return;
      }
      const provider = getLlmProvider();
      if (!provider) {
        void vscode.window.showErrorMessage('No LLM provider configured.');
        return;
      }
      const filePath = payload?.filePath;
      const ruleId = payload?.ruleId ?? 'safecheck';
      if (!filePath) {
        return;
      }
      const workspaceFolder = getWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }
      const absolute = path.isAbsolute(filePath) ? filePath : path.join(workspaceFolder, filePath);
      const content = readFileSafe(absolute);
      if (!content) {
        void vscode.window.showErrorMessage(`Cannot read ${filePath}`);
        return;
      }
      const finding = currentFindings.find((item) => item.ruleId === ruleId && normalizePath(item.filePath) === normalizePath(filePath));
      const lines = content.split(/\r?\n/);
      const center = finding?.startLine ?? 1;
      const start = Math.max(0, center - 31);
      const end = Math.min(lines.length, center + 30);
      const snippet = lines.slice(start, end).join('\n');
      try {
        const diff = await provider.generateFix({
          snippet,
          ruleId,
          message: finding?.message ?? 'Security issue',
          languageId: path.extname(filePath).replace('.', '') || 'text'
        });
        if (!diff) {
          void vscode.window.showInformationMessage('No AI suggestion returned.');
          return;
        }
        const action = await vscode.window.showInformationMessage('SafeCheck AI generated a diff. Open preview?', 'Open diff', 'Dismiss');
        if (action === 'Open diff') {
          const doc = await vscode.workspace.openTextDocument({ language: 'diff', content: diff });
          await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`AI suggestion failed: ${message}`);
      }
    })
  );

  if (getWorkspaceFolder()) {
    await scanWorkspace(context);
  }
}

export function deactivate(): void {
  diagnosticManager?.dispose();
  SafeCheckPanel.dispose();
}

async function scanWorkspace(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage('SafeCheck requires an open workspace.');
    return;
  }

  const config = getDefaultConfiguration();
  const panel = SafeCheckPanel.createOrShow(context);

  try {
    const scanResult = await runAllScans({ workspaceFolder, config });
    rawFindings = scanResult.findings;
    const baseline = config.baseline.enabled ? loadBaseline(config.baseline.path) : undefined;
    currentFindings = filterBaseline(scanResult.findings, baseline);
    diagnosticManager.setFindings(currentFindings, config);
    panel.update(currentFindings, isLlmEnabled());
    if (scanResult.warnings.length > 0) {
      void vscode.window.showWarningMessage(`SafeCheck warnings: ${scanResult.warnings.join('; ')}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`SafeCheck scan failed: ${message}`);
  }
}

async function exportReports(): Promise<void> {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    return;
  }
  const config = getDefaultConfiguration();
  const reportDir = path.join(workspaceFolder, config.report.output);
  ensureDir(reportDir);

  const sarif = buildSarifReport(currentFindings);
  const sarifPath = path.join(reportDir, 'latest.sarif');
  writeJsonFile(sarifPath, sarif);

  const htmlPath = path.join(reportDir, 'latest.html');
  const html = buildHtmlReport(currentFindings);
  fs.writeFileSync(htmlPath, html, 'utf8');

  void vscode.window.showInformationMessage(`SafeCheck reports exported to ${reportDir}`);
}

function buildHtmlReport(findings: Finding[]): string {
  const rows = findings
    .map(
      (finding) => `
        <tr>
          <td>${finding.tool}</td>
          <td>${finding.severity}</td>
          <td>${finding.ruleId}</td>
          <td>${finding.message}</td>
          <td>${finding.filePath}:${finding.startLine}</td>
        </tr>
      `
    )
    .join('');

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>SafeCheck Report</title>
    <style>
      body { font-family: sans-serif; padding: 1rem; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
    </style>
  </head>
  <body>
    <h1>SafeCheck Report</h1>
    <p>Total findings: ${findings.length}</p>
    <table>
      <thead>
        <tr>
          <th>Tool</th>
          <th>Severity</th>
          <th>Rule</th>
          <th>Message</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5">No findings</td></tr>'}
      </tbody>
    </table>
  </body>
  </html>`;
}

function getWorkspaceFolder(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}

function isLlmEnabled(): boolean {
  const config = getDefaultConfiguration();
  return config.llm.enabled;
}

function getLlmProvider(): LlmProvider | undefined {
  if (!llmProvider) {
    try {
      llmProvider = createLlmProvider(isLlmEnabled());
    } catch (error) {
      console.error('Failed to create LLM provider', error);
    }
  }
  return llmProvider;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}
