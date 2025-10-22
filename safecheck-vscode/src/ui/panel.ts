import * as vscode from 'vscode';
import type { Finding } from '../scanners';

interface PanelState {
  findings: Finding[];
  llmEnabled: boolean;
}

type PanelCommand =
  | { type: 'open'; file: string; line: number }
  | { type: 'requestAi'; file: string; ruleId: string }
  | { type: 'export' }
  | { type: 'baseline' }
  | { type: 'copyRule'; ruleId: string }
  | { type: 'openSettings' };

export class SafeCheckPanel implements vscode.Disposable {
  private static instance: SafeCheckPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private state: PanelState;

  static createOrShow(context: vscode.ExtensionContext): SafeCheckPanel {
    if (SafeCheckPanel.instance) {
      SafeCheckPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      return SafeCheckPanel.instance;
    }
    const panel = vscode.window.createWebviewPanel('safecheck.results', 'SafeCheck Findings', vscode.ViewColumn.Beside, {
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
    this.state = { findings: [], llmEnabled: false };

    this.panel.onDidDispose(() => {
      if (SafeCheckPanel.instance === this) {
        SafeCheckPanel.instance = undefined;
      }
    });

    this.panel.webview.onDidReceiveMessage((command: PanelCommand) => {
      switch (command.type) {
        case 'open':
          void vscode.commands.executeCommand('safecheck.openLocation', command.file, command.line);
          break;
        case 'requestAi':
          void vscode.commands.executeCommand('safecheck.requestAiFix', command.file, command.ruleId);
          break;
        case 'export':
          void vscode.commands.executeCommand('safecheck.exportSarif');
          break;
        case 'baseline':
          void vscode.commands.executeCommand('safecheck.toggleBaseline');
          break;
        case 'copyRule':
          void vscode.env.clipboard.writeText(command.ruleId).then(() => {
            void vscode.window.showInformationMessage(`Rule ${command.ruleId} copied to clipboard.`);
          });
          break;
        case 'openSettings':
          void vscode.commands.executeCommand('safecheck.openSettings');
          break;
        default:
          break;
      }
    });

    this.render();
    context.subscriptions.push(this);
  }

  update(findings: Finding[], llmEnabled: boolean): void {
    this.state = { findings, llmEnabled };
    this.render();
  }

  private render(): void {
    this.panel.webview.html = this.getHtml(this.state);
  }

  private getHtml(state: PanelState): string {
    const nonce = String(Date.now());
    const toolkitOptions = Array.from(new Set(state.findings.map((finding) => finding.tool)))
      .map((tool) => `<option value="${tool}">${tool}</option>`)
      .join('');
    const severities = Array.from(new Set(state.findings.map((finding) => finding.severity)))
      .map((severity) => `<option value="${severity}">${severity}</option>`)
      .join('');

    const rows = state.findings
      .map((finding, index) => `
        <tr data-tool="${finding.tool}" data-severity="${finding.severity}">
          <td>${index + 1}</td>
          <td><span class="chip ${finding.severity.toLowerCase()}">${finding.severity}</span></td>
          <td>${escapeHtml(finding.tool)}</td>
          <td class="message">${escapeHtml(finding.message)}</td>
          <td>${escapeHtml(finding.ruleId)}</td>
          <td><code>${escapeHtml(finding.file)}:${finding.line}</code></td>
          <td class="actions">
            <button data-cmd="open" data-file="${escapeAttribute(finding.file)}" data-line="${finding.line}">Open</button>
            <button data-cmd="copyRule" data-rule="${escapeAttribute(finding.ruleId)}">Copy rule</button>
            <button data-cmd="baseline">Baseline</button>
            ${
              state.llmEnabled
                ? `<button data-cmd="ai" data-file="${escapeAttribute(finding.file)}" data-rule="${escapeAttribute(
                    finding.ruleId
                  )}">Suggest AI Fix</button>`
                : ''
            }
          </td>
        </tr>
      `)
      .join('');

    const aiBanner = state.llmEnabled
      ? `<div class="ai-banner">
          <span>AI suggestions send code snippets to OpenRouter. Ensure you trust the destination before enabling.</span>
          <button data-cmd="openSettings">Settings</button>
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; }
    header { padding: 0.75rem 1rem; border-bottom: 1px solid var(--vscode-editorWidget-border); display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    header button { padding: 0.4rem 0.8rem; }
    .filters { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; }
    thead { background: var(--vscode-editor-background); position: sticky; top: 0; }
    th, td { padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--vscode-editorWidget-border); }
    tbody tr:hover { background: var(--vscode-list-hoverBackground); }
    .chip { padding: 0.1rem 0.5rem; border-radius: 0.5rem; font-size: 0.75rem; text-transform: lowercase; }
    .chip.critical { background: #8b0000; color: #fff; }
    .chip.high { background: #b22222; color: #fff; }
    .chip.medium { background: #cd853f; color: #000; }
    .chip.low { background: #2e8b57; color: #fff; }
    .actions button { margin-right: 0.25rem; }
    .ai-banner { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; background: var(--vscode-editorInfo-foreground, rgba(0,0,0,0.1)); border-bottom: 1px solid var(--vscode-editorWidget-border); }
    .message { max-width: 28rem; }
    input[type="search"], select { padding: 0.3rem 0.4rem; }
    tbody tr.hidden { display: none; }
  </style>
</head>
<body>
  ${aiBanner}
  <header>
    <div class="filters">
      <button data-cmd="export">Export Reports</button>
      <button data-cmd="baseline">Snapshot Baseline</button>
      <label>Tool <select id="filter-tool"><option value="">All</option>${toolkitOptions}</select></label>
      <label>Severity <select id="filter-severity"><option value="">All</option>${severities}</select></label>
      <input id="search" type="search" placeholder="Search message or rule" />
    </div>
    <span>${state.findings.length} findings</span>
  </header>
  <main>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Severity</th>
          <th>Tool</th>
          <th>Message</th>
          <th>Rule</th>
          <th>Location</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7">No findings</td></tr>'}
      </tbody>
    </table>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const tableBody = document.querySelector('tbody');
    document.body.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const cmd = target.dataset.cmd;
      if (!cmd) {
        return;
      }
      event.preventDefault();
      if (cmd === 'open') {
        vscode.postMessage({ type: 'open', file: target.dataset.file, line: Number(target.dataset.line) });
      } else if (cmd === 'export') {
        vscode.postMessage({ type: 'export' });
      } else if (cmd === 'baseline') {
        vscode.postMessage({ type: 'baseline' });
      } else if (cmd === 'ai') {
        vscode.postMessage({ type: 'requestAi', file: target.dataset.file, ruleId: target.dataset.rule });
      } else if (cmd === 'copyRule') {
        vscode.postMessage({ type: 'copyRule', ruleId: target.dataset.rule });
      } else if (cmd === 'openSettings') {
        vscode.postMessage({ type: 'openSettings' });
      }
    });

    const filterTool = document.getElementById('filter-tool');
    const filterSeverity = document.getElementById('filter-severity');
    const search = document.getElementById('search');

    function applyFilters() {
      const tool = filterTool.value;
      const severity = filterSeverity.value;
      const needle = search.value.trim().toLowerCase();
      document.querySelectorAll('tbody tr').forEach((row) => {
        if (!(row instanceof HTMLElement)) {
          return;
        }
        const matchesTool = !tool || row.dataset.tool === tool;
        const matchesSeverity = !severity || row.dataset.severity === severity;
        const text = row.innerText.toLowerCase();
        const matchesSearch = !needle || text.includes(needle);
        row.classList.toggle('hidden', !(matchesTool && matchesSeverity && matchesSearch));
      });
    }

    [filterTool, filterSeverity, search].forEach((element) => {
      element?.addEventListener('input', applyFilters);
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this.panel.dispose();
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

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
