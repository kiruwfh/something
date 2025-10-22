import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getDefaultConfiguration } from './config/defaultConfig';
import { DiagnosticManager } from './diagnostics/diagnosticManager';
import { runAllScans, Finding, showMissingToolMessage } from './scanners';
import { loadBaseline, saveBaseline, filterBaseline } from './utils/baseline';
import { ensureDir, readFileSafe, writeJsonFile } from './utils/fs';
import { SafeCheckPanel } from './ui/panel';
import { SettingsPanel } from './ui/settings';
import { createLlmProvider } from './llm/openrouterProvider';
import type { LLMProvider } from './llm/provider';
import { validateUnifiedDiff, applyUnifiedDiff } from './utils/diff';
import { buildSarif } from './scanners/parsers/sarif';

let diagnostics: DiagnosticManager;
let panel: SafeCheckPanel | undefined;
let llmProvider: LLMProvider | undefined;
let currentFindings: Finding[] = [];
let rawFindings: Finding[] = [];
let scanToken = 0;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  diagnostics = new DiagnosticManager();
  context.subscriptions.push(diagnostics);

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.scanWorkspace', async () => {
      await runScan(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.openPanel', () => {
      panel = SafeCheckPanel.createOrShow(context);
      const config = getDefaultConfiguration();
      panel.update(currentFindings, config.llm.enabled);
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
      saveBaseline(config.baseline.path, rawFindings);
      void vscode.window.showInformationMessage('SafeCheck baseline snapshot updated.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.openSettings', async () => {
      const hasKey = Boolean(await context.secrets.get('safecheck.openrouterApiKey'));
      SettingsPanel.createOrShow(context, hasKey);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.openLocation', async (file: string, line: number) => {
      const workspaceFolder = getWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }
      const absolute = path.isAbsolute(file) ? file : path.join(workspaceFolder, file);
      const doc = await vscode.workspace.openTextDocument(absolute);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });
      const position = new vscode.Position(Math.max(0, line - 1), 0);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      editor.selection = new vscode.Selection(position, position);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safecheck.requestAiFix', async (file: string, ruleId: string) => {
      await requestAiFix(context, file, ruleId);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('safecheck.llm')) {
        llmProvider = undefined;
        if (panel) {
          const config = getDefaultConfiguration();
          panel.update(currentFindings, config.llm.enabled);
        }
      }
    })
  );

  if (getWorkspaceFolder()) {
    await runScan(context);
  }
}

export function deactivate(): void {
  diagnostics?.dispose();
  SafeCheckPanel.dispose();
}

async function runScan(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage('SafeCheck requires an open workspace folder.');
    return;
  }

  const config = getDefaultConfiguration();
  const status = vscode.window.setStatusBarMessage('SafeCheck: scanning workspace…');
  const token = ++scanToken;

  try {
    const result = await runAllScans({ workspaceFolder, config });
    if (token !== scanToken) {
      return;
    }
    rawFindings = result.findings;
    const baseline = config.baseline.enabled ? loadBaseline(config.baseline.path) : undefined;
    currentFindings = filterBaseline(result.findings, baseline);
    diagnostics.update(currentFindings, workspaceFolder);

    if (panel) {
      panel.update(currentFindings, config.llm.enabled);
    }

    if (result.missingTools.length > 0) {
      showMissingToolMessage(result.missingTools);
    }
    if (result.warnings.length > 0) {
      void vscode.window.showWarningMessage(`SafeCheck warnings: ${result.warnings.join('; ')}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`SafeCheck scan failed: ${message}`);
  } finally {
    status.dispose();
  }
}

async function exportReports(): Promise<void> {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage('SafeCheck requires an open workspace to export reports.');
    return;
  }
  const config = getDefaultConfiguration();
  const reportDir = path.join(workspaceFolder, config.reports.outputDir);
  ensureDir(reportDir);

  const sarif = buildSarif(currentFindings, workspaceFolder);
  writeJsonFile(path.join(reportDir, 'latest.sarif'), sarif);

  const html = buildHtmlReport(currentFindings);
  fs.writeFileSync(path.join(reportDir, 'latest.html'), html, 'utf8');

  void vscode.window.showInformationMessage(`SafeCheck reports exported to ${config.reports.outputDir}`);
}

function buildHtmlReport(findings: Finding[]): string {
  const rows = findings
    .map(
      (finding) => `
        <tr>
          <td>${finding.tool}</td>
          <td>${finding.severity}</td>
          <td>${finding.ruleId}</td>
          <td>${escapeHtml(finding.message)}</td>
          <td>${escapeHtml(`${finding.file}:${finding.line}`)}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>SafeCheck Report</title>
    <style>
      body { font-family: sans-serif; padding: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background: #f0f0f0; }
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

async function requestAiFix(context: vscode.ExtensionContext, file: string, ruleId: string): Promise<void> {
  const config = getDefaultConfiguration();
  if (!config.llm.enabled) {
    void vscode.window.showWarningMessage('Enable AI suggestions in SafeCheck settings first.');
    return;
  }
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage('Open a workspace to request AI fixes.');
    return;
  }

  if (!(await ensureAiDisclosure(context))) {
    return;
  }

  const finding = currentFindings.find((item) => normalizePath(item.file) === normalizePath(file) && item.ruleId === ruleId);
  if (!finding) {
    void vscode.window.showErrorMessage('Could not find the selected issue.');
    return;
  }

  const absolute = path.isAbsolute(file) ? file : path.join(workspaceFolder, file);
  const content = readFileSafe(absolute);
  if (!content) {
    void vscode.window.showErrorMessage(`Cannot read ${file}.`);
    return;
  }

  const stat = fs.statSync(absolute);
  const language = guessLanguage(absolute);
  const snippet = extractSnippet(content, finding.line);
  const redactedSnippet = redactSecrets(snippet);
  const fileVersion = hashContent(content);

  const provider = getLlmProvider(context);

  try {
    const { diff } = await provider.suggestFix({
      language,
      ruleId: finding.ruleId,
      message: finding.message,
      snippet: redactedSnippet,
      filePath: path.relative(workspaceFolder, absolute),
      fileVersion
    });

    const validation = validateUnifiedDiff(diff, path.relative(workspaceFolder, absolute));
    if (!validation.valid) {
      throw new Error(validation.reason ?? 'Model returned an invalid diff.');
    }

    const preview = await vscode.workspace.openTextDocument({ language: 'diff', content: diff });
    await vscode.window.showTextDocument(preview, { preview: true, viewColumn: vscode.ViewColumn.Beside });

    const selection = await vscode.window.showInformationMessage(
      'Review the AI generated patch. Apply the diff?',
      { modal: true },
      'Apply',
      'Copy diff',
      'Cancel'
    );

    if (selection === 'Copy diff') {
      await vscode.env.clipboard.writeText(diff);
      return;
    }
    if (selection !== 'Apply') {
      return;
    }

    const currentStat = fs.statSync(absolute);
    if (currentStat.mtimeMs !== stat.mtimeMs) {
      void vscode.window.showWarningMessage('File changed since the suggestion was generated. Review manually.');
      return;
    }

    const patched = applyUnifiedDiff(content, diff);
    if (!patched) {
      throw new Error('Failed to apply diff. It may be out of date.');
    }

    fs.writeFileSync(absolute, patched, 'utf8');
    void vscode.window.showInformationMessage('Patch applied. Re-running SafeCheck…');
    await runScan(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`AI suggestion failed: ${message}`);
  }
}

function getLlmProvider(context: vscode.ExtensionContext): LLMProvider {
  if (!llmProvider) {
    llmProvider = createLlmProvider(context);
  }
  return llmProvider;
}

function extractSnippet(content: string, line: number): string {
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, line - 31);
  const end = Math.min(lines.length, line + 30);
  let snippetLines = lines.slice(start, end);
  let snippet = snippetLines.join('\n');
  const maxBytes = 3 * 1024;
  while (Buffer.byteLength(snippet, 'utf8') > maxBytes && snippetLines.length > 1) {
    if (snippetLines.length % 2 === 0) {
      snippetLines = snippetLines.slice(0, -1);
    } else {
      snippetLines = snippetLines.slice(1);
    }
    snippet = snippetLines.join('\n');
  }
  return snippet;
}

function redactSecrets(snippet: string): string {
  let redacted = snippet.replace(/(api[_-]?key\s*=\s*)(['"]?)[^'"\n]+/gi, '$1$2REDACTED');
  redacted = redacted.replace(/(['"](?:token|secret)['"])\s*:\s*['"][^'"]+['"]/gi, (match) => {
    const parts = match.split(':');
    return `${parts[0]}: "REDACTED"`;
  });
  return redacted;
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function guessLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx':
      return 'TypeScript';
    case '.js':
    case '.jsx':
      return 'JavaScript';
    case '.py':
      return 'Python';
    case '.java':
      return 'Java';
    case '.c':
    case '.h':
      return 'C';
    case '.cpp':
    case '.hpp':
      return 'C++';
    case '.go':
      return 'Go';
    case '.rb':
      return 'Ruby';
    case '.php':
      return 'PHP';
    case '.rs':
      return 'Rust';
    default:
      return ext.replace('.', '') || 'text';
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
}

function getWorkspaceFolder(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

async function ensureAiDisclosure(context: vscode.ExtensionContext): Promise<boolean> {
  const accepted = awaitAiDisclosure(context);
  if (accepted) {
    return true;
  }
  const choice = await vscode.window.showWarningMessage(
    'SafeCheck will send a limited code snippet to the configured OpenRouter model. Do you want to continue?',
    { modal: true },
    'Continue',
    'Cancel'
  );
  if (choice === 'Continue') {
    await context.globalState.update('safecheck.aiDisclosureAccepted', true);
    return true;
  }
  return false;
}

function awaitAiDisclosure(context: vscode.ExtensionContext): boolean {
  return context.globalState.get<boolean>('safecheck.aiDisclosureAccepted', false);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}
