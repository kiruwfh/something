import * as vscode from 'vscode';
import type { Finding } from '../scanners';

interface PanelMessage {
  type: 'open' | 'ignore' | 'baseline' | 'export' | 'ai';
  payload?: unknown;
}

export class SafeCheckPanel {
  private static instance: SafeCheckPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  static createOrShow(context: vscode.ExtensionContext): SafeCheckPanel {
    if (SafeCheckPanel.instance) {
      SafeCheckPanel.instance.panel.reveal();
      return SafeCheckPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel('safecheckResults', 'SafeCheck Findings', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    SafeCheckPanel.instance = new SafeCheckPanel(panel, context);
    return SafeCheckPanel.instance;
  }

  static dispose(): void {
    SafeCheckPanel.instance?.panel.dispose();
    SafeCheckPanel.instance = undefined;
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.panel.onDidDispose(() => {
      if (SafeCheckPanel.instance === this) {
        SafeCheckPanel.instance = undefined;
      }
    });

    this.panel.webview.html = this.render([]);
    this.panel.webview.onDidReceiveMessage(async (message: PanelMessage) => {
      switch (message.type) {
        case 'open':
          if (typeof message.payload === 'string') {
            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.payload));
          }
          break;
        case 'ignore':
          await vscode.commands.executeCommand('safecheck.ignoreFinding', message.payload);
          break;
        case 'baseline':
          await vscode.commands.executeCommand('safecheck.toggleBaseline');
          break;
        case 'export':
          await vscode.commands.executeCommand('safecheck.exportSarif');
          break;
        case 'ai':
          await vscode.commands.executeCommand('safecheck.aiSuggest', message.payload);
          break;
        default:
          break;
      }
    });

    context.subscriptions.push(panel);
  }

  update(findings: Finding[], llmEnabled: boolean): void {
    this.panel.webview.html = this.render(findings, llmEnabled);
  }

  private render(findings: Finding[], llmEnabled = false): string {
    const rows = findings
      .map((finding) => `
        <tr>
          <td>${escapeHtml(finding.tool)}</td>
          <td>${escapeHtml(finding.severity)}</td>
          <td>${escapeHtml(finding.ruleId)}</td>
          <td>${escapeHtml(finding.message)}</td>
          <td>${escapeHtml(`${finding.filePath}:${finding.startLine}`)}</td>
          <td>
            <button data-action="open" data-path="${escapeAttribute(finding.filePath)}">Open</button>
            <button data-action="ignore" data-path="${escapeAttribute(finding.filePath)}" data-rule="${escapeAttribute(finding.ruleId)}">Ignore</button>
            <button data-action="baseline">Add to baseline</button>
            ${llmEnabled ? `<button data-action=\"ai\" data-path=\"${escapeAttribute(finding.filePath)}\" data-rule=\"${escapeAttribute(finding.ruleId)}\">Suggest AI Fix</button>` : ''}
          </td>
        </tr>
      `)
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: var(--vscode-font-family); padding: 0 1rem; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid var(--vscode-editorWidget-border); padding: 0.4rem; text-align: left; }
          button { margin-right: 0.4rem; }
          thead { position: sticky; top: 0; background: var(--vscode-editor-background); }
        </style>
      </head>
      <body>
        <h2>SafeCheck Findings (${findings.length})</h2>
        <div>
          <button data-action="export">Export SARIF/HTML</button>
          <button data-action="baseline">Toggle Baseline</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Severity</th>
              <th>Rule</th>
              <th>Message</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6">No findings</td></tr>'}
          </tbody>
        </table>
        <script>
          const vscode = acquireVsCodeApi();
          document.body.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
              return;
            }
            const action = target.getAttribute('data-action');
            if (!action) {
              return;
            }
            if (action === 'baseline') {
              vscode.postMessage({ type: 'baseline' });
              return;
            }
            const payload = {
              filePath: target.getAttribute('data-path'),
              ruleId: target.getAttribute('data-rule')
            };
            if (action === 'open') {
              vscode.postMessage({ type: action, payload: payload.filePath });
            } else {
              vscode.postMessage({ type: action, payload });
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (char) => {
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

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
