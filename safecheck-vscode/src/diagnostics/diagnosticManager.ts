import * as path from 'path';
import * as vscode from 'vscode';
import type { Finding } from '../scanners';
import { toDiagnosticSeverity } from '../utils/severity';
import type { SafeCheckConfiguration } from '../config/defaultConfig';

export class DiagnosticManager {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('safecheck');
  }

  dispose(): void {
    this.collection.dispose();
  }

  clear(): void {
    this.collection.clear();
  }

  setFindings(findings: Finding[], config: SafeCheckConfiguration): void {
    this.clear();
    const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

    for (const finding of findings) {
      const filePath = this.resolvePath(finding.filePath);
      const range = new vscode.Range(
        new vscode.Position(Math.max(0, finding.startLine - 1), 0),
        new vscode.Position(Math.max(0, (finding.endLine ?? finding.startLine) - 1), 0)
      );
      const diagnostic = new vscode.Diagnostic(range, finding.message, toDiagnosticSeverity(finding.severity, config));
      diagnostic.code = finding.ruleId;
      diagnostic.source = finding.tool;

      const diagnostics = diagnosticsByFile.get(filePath) ?? [];
      diagnostics.push(diagnostic);
      diagnosticsByFile.set(filePath, diagnostics);
    }

    diagnosticsByFile.forEach((diagnostics, filePath) => {
      this.collection.set(vscode.Uri.file(filePath), diagnostics);
    });
  }

  private resolvePath(target: string): string {
    if (path.isAbsolute(target)) {
      return target;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return target;
    }
    return path.join(folders[0].uri.fsPath, target);
  }
}
