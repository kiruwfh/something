import * as path from 'path';
import * as vscode from 'vscode';
import type { Finding } from '../scanners';
import { toDiagnosticSeverity } from '../utils/severity';

export class DiagnosticManager implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('safecheck');
  }

  dispose(): void {
    this.collection.dispose();
  }

  reset(): void {
    this.collection.clear();
  }

  update(findings: Finding[], workspaceFolder: string): void {
    this.reset();
    const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

    for (const finding of findings) {
      const filePath = this.resolveFilePath(finding.file, workspaceFolder);
      const range = new vscode.Range(
        new vscode.Position(Math.max(0, finding.line - 1), Math.max(0, (finding.column ?? 1) - 1)),
        new vscode.Position(
          Math.max(0, (finding.endLine ?? finding.line) - 1),
          Math.max(0, (finding.column ?? 1) - 1)
        )
      );
      const diagnostic = new vscode.Diagnostic(range, finding.message, toDiagnosticSeverity(finding.severity));
      diagnostic.code = finding.ruleId;
      diagnostic.source = finding.tool;

      const diagnostics = diagnosticsByFile.get(filePath) ?? [];
      diagnostics.push(diagnostic);
      diagnosticsByFile.set(filePath, diagnostics);
    }

    for (const [filePath, diagnostics] of diagnosticsByFile.entries()) {
      this.collection.set(vscode.Uri.file(filePath), diagnostics);
    }
  }

  private resolveFilePath(target: string, workspaceFolder: string): string {
    if (path.isAbsolute(target)) {
      return target;
    }
    return path.join(workspaceFolder, target);
  }
}
