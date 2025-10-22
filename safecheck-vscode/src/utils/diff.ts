import { applyPatch, parsePatch } from 'diff';

export function validateUnifiedDiff(diff: string, targetFile: string): { valid: boolean; reason?: string } {
  const patches = parsePatch(diff);
  if (patches.length === 0) {
    return { valid: false, reason: 'No diff hunks found.' };
  }
  if (patches.length > 1) {
    return { valid: false, reason: 'Diff modifies multiple files.' };
  }
  const patch = patches[0];
  const normalizedTarget = normalizeTarget(targetFile);
  const files = [patch.oldFileName ?? '', patch.newFileName ?? ''].map(normalizeTarget);
  if (!files.includes(normalizedTarget)) {
    return { valid: false, reason: 'Diff targets a different file.' };
  }
  return { valid: true };
}

export function applyUnifiedDiff(original: string, diff: string): string | undefined {
  try {
    const patched = applyPatch(original, diff);
    return typeof patched === 'string' ? patched : undefined;
  } catch (error) {
    console.error('[SafeCheck] Failed to apply diff', error);
    return undefined;
  }
}

function normalizeTarget(value: string): string {
  return value.replace(/^([ab]\/)*/, '').replace(/\\/g, '/');
}
