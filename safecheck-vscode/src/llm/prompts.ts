export const SYSTEM_PROMPT = `You are a senior secure coding assistant. You must return a minimal unified diff to fix the specific vulnerability. Do not include explanations before or after the diff. The patch must compile and preserve behavior except for the security fix. Never include unrelated files. If the issue is a false positive or cannot be safely auto-fixed, return a unified diff with no changes and a single comment explaining "NOOP: reason".`;

interface PromptInput {
  language: string;
  ruleId: string;
  message: string;
  snippet: string;
  filePath: string;
  fileVersion?: string;
}

export function buildUserPrompt(input: PromptInput): string {
  const parts = [
    `Language: ${input.language}`,
    `Rule ID: ${input.ruleId}`,
    `Issue: ${input.message}`,
    `File: ${input.filePath}`,
    input.fileVersion ? `File Version: ${input.fileVersion}` : undefined,
    '',
    'Snippet (±30 lines around the issue):',
    input.snippet,
    '',
    'Requirements:',
    '- Return ONLY a unified diff in the format starting with --- a/... and +++ b/... and @@ ... @@ hunks.',
    '- Modify only the provided file and only the relevant fragment.',
    '- Avoid unsafe changes such as enabling shell execution, disabling certificate validation, or using outdated cryptography.',
    '- If no safe fix exists or the finding is a false positive, return a unified diff with no changes and a single line comment beginning with NOOP explaining why.'
  ].filter(Boolean);
  return parts.join('\n');
}
