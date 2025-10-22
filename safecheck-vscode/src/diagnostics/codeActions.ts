import * as vscode from 'vscode';

export class SafeCheckCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diagnostic of context.diagnostics) {
      const line = document.lineAt(diagnostic.range.start.line).text;
      actions.push(...this.createYamlFix(document, diagnostic, line));
      actions.push(...this.createSubprocessFix(document, diagnostic, line));
      actions.push(...this.createHelmetFix(document, diagnostic));
      actions.push(...this.createCryptoFix(document, diagnostic, line));
    }
    return actions;
  }

  private createYamlFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, line: string): vscode.CodeAction[] {
    if (!/yaml\.load\s*\(/.test(line)) {
      return [];
    }
    const action = new vscode.CodeAction('Use yaml.safe_load', vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];
    action.edit = new vscode.WorkspaceEdit();
    const match = /yaml\.load/.exec(line);
    if (!match) {
      return [];
    }
    const start = new vscode.Position(diagnostic.range.start.line, match.index);
    const end = start.translate(0, match[0].length);
    action.edit.replace(document.uri, new vscode.Range(start, end), 'yaml.safe_load');
    return [action];
  }

  private createSubprocessFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, line: string): vscode.CodeAction[] {
    if (!/subprocess\.run\(/.test(line) || !/shell\s*=\s*True/.test(line)) {
      return [];
    }
    const action = new vscode.CodeAction('Disable shell=True and enforce check=True', vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];
    const range = document.lineAt(diagnostic.range.start.line).range;
    let updated = line.replace(/shell\s*=\s*True/, 'shell=False');
    if (!/check\s*=/.test(updated)) {
      updated = updated.replace(/\)\s*$/, ', check=True)');
    }
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(document.uri, range, updated);
    return [action];
  }

  private createHelmetFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
    if (!['javascript', 'javascriptreact', 'typescript', 'typescriptreact'].includes(document.languageId)) {
      return [];
    }
    const text = document.getText();
    if (!/express\s*\(/.test(text) || /helmet\s*\(\)/.test(text)) {
      return [];
    }
    const action = new vscode.CodeAction('Add helmet() middleware', vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];
    action.edit = new vscode.WorkspaceEdit();
    const insertPosition = this.findMiddlewareInsertionPoint(document);
    const snippet = "\nconst helmet = require('helmet');\napp.use(helmet());\n";
    action.edit.insert(document.uri, insertPosition, snippet);
    return [action];
  }

  private createCryptoFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, line: string): vscode.CodeAction[] {
    if (!/md5/i.test(line)) {
      return [];
    }
    const action = new vscode.CodeAction('Use sha256 instead of md5', vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];
    action.edit = new vscode.WorkspaceEdit();
    const match = /md5/gi.exec(line);
    if (!match) {
      return [];
    }
    const start = new vscode.Position(diagnostic.range.start.line, match.index);
    const end = start.translate(0, match[0].length);
    action.edit.replace(document.uri, new vscode.Range(start, end), 'sha256');
    return [action];
  }

  private findMiddlewareInsertionPoint(document: vscode.TextDocument): vscode.Position {
    for (let i = 0; i < document.lineCount; i += 1) {
      if (/app\.use\(/.test(document.lineAt(i).text)) {
        return new vscode.Position(i, 0);
      }
    }
    return new vscode.Position(document.lineCount, 0);
  }
}

export function registerCodeActions(context: vscode.ExtensionContext): void {
  const provider = new SafeCheckCodeActionProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { pattern: '**/*' },
      provider,
      { providedCodeActionKinds: SafeCheckCodeActionProvider.providedCodeActionKinds }
    )
  );
}
