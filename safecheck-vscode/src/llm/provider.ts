export interface SuggestFixInput {
  language: string;
  ruleId: string;
  message: string;
  snippet: string;
  filePath: string;
  fileVersion?: string;
}

export interface SuggestFixResult {
  diff: string;
  usage?: Record<string, unknown>;
}

export interface LLMProvider {
  suggestFix(input: SuggestFixInput): Promise<SuggestFixResult>;
}
