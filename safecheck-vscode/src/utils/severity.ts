import { DiagnosticSeverity } from 'vscode';
import { SafeCheckConfiguration } from '../config/defaultConfig';
import { SafeSeverity } from '../scanners';

export function toDiagnosticSeverity(level: SafeSeverity, config: SafeCheckConfiguration): DiagnosticSeverity {
  const mapping = config.severity.levels;
  const value = mapping[level] ?? 'Warning';
  switch (value.toLowerCase()) {
    case 'error':
      return DiagnosticSeverity.Error;
    case 'warning':
      return DiagnosticSeverity.Warning;
    case 'information':
      return DiagnosticSeverity.Information;
    case 'hint':
      return DiagnosticSeverity.Hint;
    default:
      return DiagnosticSeverity.Warning;
  }
}
