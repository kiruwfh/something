import * as vscode from 'vscode';

interface SettingsPayload {
  enableAi: boolean;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

interface TestPayload extends SettingsPayload {}

type Message =
  | { type: 'save'; payload: SettingsPayload }
  | { type: 'test'; payload: TestPayload };

export class SettingsPanel implements vscode.Disposable {
  private static instance: SettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;
  private readonly hasApiKey: boolean;

  static createOrShow(context: vscode.ExtensionContext, hasApiKey: boolean): SettingsPanel {
    if (SettingsPanel.instance) {
      SettingsPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return SettingsPanel.instance;
    }
    const panel = vscode.window.createWebviewPanel('safecheck.settings', 'SafeCheck Settings', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    SettingsPanel.instance = new SettingsPanel(panel, context, hasApiKey);
    return SettingsPanel.instance;
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, hasApiKey: boolean) {
    this.panel = panel;
    this.context = context;
    this.hasApiKey = hasApiKey;

    this.panel.onDidDispose(() => {
      if (SettingsPanel.instance === this) {
        SettingsPanel.instance = undefined;
      }
    });

    this.panel.webview.onDidReceiveMessage(async (message: Message) => {
      const config = vscode.workspace.getConfiguration('safecheck');
      switch (message.type) {
        case 'save': {
          await config.update('llm.enabled', message.payload.enableAi, vscode.ConfigurationTarget.Global);
          await config.update('llm.baseUrl', message.payload.baseUrl, vscode.ConfigurationTarget.Global);
          await config.update('llm.model', message.payload.model, vscode.ConfigurationTarget.Global);
          if (typeof message.payload.apiKey === 'string') {
            if (message.payload.apiKey.trim()) {
              await this.context.secrets.store('safecheck.openrouterApiKey', message.payload.apiKey.trim());
            } else {
              await this.context.secrets.delete('safecheck.openrouterApiKey');
            }
          }
          void vscode.window.showInformationMessage('SafeCheck settings updated.');
          break;
        }
        case 'test': {
          try {
            const endpoint = message.payload.baseUrl.replace(/\/$/, '') + '/models';
            const response = await fetch(endpoint, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${message.payload.apiKey?.trim() || (await this.context.secrets.get('safecheck.openrouterApiKey')) || ''}`
              }
            });
            if (!response.ok) {
              throw new Error(`${response.status} ${response.statusText}`);
            }
            void vscode.window.showInformationMessage('Connection successful.');
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(`Connection failed: ${message}`);
          }
          break;
        }
        default:
          break;
      }
    });

    this.render();
  }

  private render(): void {
    const config = vscode.workspace.getConfiguration('safecheck');
    const enableAi = config.get<boolean>('llm.enabled', false);
    const baseUrl = config.get<string>('llm.baseUrl', 'https://openrouter.ai/api/v1');
    const model = config.get<string>('llm.model', 'deepseek/deepseek-chat-v3.1:free');
    const placeholder = this.hasApiKey ? 'API key stored in SecretStorage' : '';
    const nonce = String(Date.now());

    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 1.5rem; }
    form { display: flex; flex-direction: column; gap: 1rem; max-width: 520px; }
    label { display: flex; flex-direction: column; gap: 0.35rem; }
    input[type="text"], input[type="password"] { padding: 0.4rem; }
    .actions { display: flex; gap: 0.75rem; }
    .warning { background: var(--vscode-editorWarning-foreground, rgba(255, 196, 0, 0.15)); padding: 0.75rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>SafeCheck Settings</h1>
  <p class="warning">When AI suggestions are enabled, SafeCheck will send a limited code snippet (±30 lines), the rule ID, and a short description to OpenRouter. No other files or project context are transmitted.</p>
  <form id="settings-form">
    <label>
      <span><input type="checkbox" id="enable-ai" ${enableAi ? 'checked' : ''}/> Enable AI suggestions</span>
    </label>
    <label>
      <span>Base URL</span>
      <input type="text" id="base-url" value="${escapeAttribute(baseUrl)}" />
    </label>
    <label>
      <span>Model</span>
      <input type="text" id="model" value="${escapeAttribute(model)}" list="model-suggestions" />
      <datalist id="model-suggestions">
        <option value="deepseek/deepseek-chat-v3.1:free"></option>
        <option value="openrouter/auto"></option>
      </datalist>
    </label>
    <label>
      <span>OpenRouter API Key</span>
      <input type="password" id="api-key" placeholder="${escapeAttribute(placeholder)}" autocomplete="off" />
    </label>
    <div class="actions">
      <button type="submit">Save</button>
      <button type="button" id="test">Test Connection</button>
    </div>
  </form>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const form = document.getElementById('settings-form');
    const testButton = document.getElementById('test');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const payload = {
        enableAi: document.getElementById('enable-ai').checked,
        baseUrl: document.getElementById('base-url').value,
        model: document.getElementById('model').value,
        apiKey: document.getElementById('api-key').value
      };
      vscode.postMessage({ type: 'save', payload });
    });

    testButton.addEventListener('click', () => {
      const payload = {
        enableAi: document.getElementById('enable-ai').checked,
        baseUrl: document.getElementById('base-url').value,
        model: document.getElementById('model').value,
        apiKey: document.getElementById('api-key').value
      };
      vscode.postMessage({ type: 'test', payload });
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this.panel.dispose();
  }
}

function escapeAttribute(value: string): string {
  return value.replace(/[&"<>']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      default:
        return char;
    }
  });
}
