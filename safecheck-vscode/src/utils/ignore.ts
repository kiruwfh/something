import * as fs from 'fs';
import * as path from 'path';
import { Minimatch } from 'minimatch';

export interface IgnoreConfig {
  filePatterns: Minimatch[];
  ruleIds: Set<string>;
}

export function loadIgnoreConfig(workspaceRoot: string): IgnoreConfig {
  const filePath = path.join(workspaceRoot, '.safecheckignore');
  if (!fs.existsSync(filePath)) {
    return { filePatterns: [], ruleIds: new Set() };
  }
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const patterns: Minimatch[] = [];
  const ruleIds = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    if (trimmed.startsWith('rule:')) {
      ruleIds.add(trimmed.substring(5).trim());
      continue;
    }
    patterns.push(new Minimatch(trimmed, { dot: true }));
  }

  return { filePatterns: patterns, ruleIds };
}

export function isIgnored(config: IgnoreConfig, workspaceRoot: string, filePath: string, ruleId?: string): boolean {
  const relative = path.relative(workspaceRoot, filePath);
  if (ruleId && config.ruleIds.has(ruleId)) {
    return true;
  }
  return config.filePatterns.some((pattern) => pattern.match(relative));
}
