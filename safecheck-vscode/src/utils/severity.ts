import { DiagnosticSeverity } from 'vscode';
import type { FindingSeverity } from '../scanners';

export function toDiagnosticSeverity(level: FindingSeverity): DiagnosticSeverity {
  switch (level) {
    case 'CRITICAL':
    case 'HIGH':
      return DiagnosticSeverity.Error;
    case 'MEDIUM':
      return DiagnosticSeverity.Warning;
    case 'LOW':
    default:
      return DiagnosticSeverity.Information;
  }
}
