export interface LlmContext {
  snippet: string;
  ruleId: string;
  message: string;
  languageId: string;
}

export interface LlmProvider {
  generateFix(context: LlmContext): Promise<string | undefined>;
}

export class NoopLlmProvider implements LlmProvider {
  async generateFix(): Promise<string | undefined> {
    return undefined;
  }
}
