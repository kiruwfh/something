import { workspace } from 'vscode';
import type { LlmContext, LlmProvider } from './provider';

interface OpenRouterRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class OpenRouterProvider implements LlmProvider {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    const config = workspace.getConfiguration('safecheck');
    this.apiKey = process.env.OPENROUTER_API_KEY || process.env.SAFE_OPENROUTER_API_KEY || config.get<string>('llm.apiKey');
    this.baseUrl = process.env.OPENROUTER_BASE_URL || config.get<string>('llm.baseUrl', 'https://openrouter.ai/api/v1');
    this.model = process.env.OPENROUTER_MODEL || config.get<string>('llm.model', 'openrouter/auto');
  }

  async generateFix(context: LlmContext): Promise<string | undefined> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is not configured');
    }

    const body: OpenRouterRequest = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a security assistant that returns unified diff patches for code fixes.'
        },
        {
          role: 'user',
          content: `Rule: ${context.ruleId}\nMessage: ${context.message}\nLanguage: ${context.languageId}\nProvide a minimal unified diff to remediate the issue in the snippet:\n\n${context.snippet}`
        }
      ]
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/safecheck/safecheck-vscode'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;
    return content?.trim();
  }
}

export function createLlmProvider(enabled: boolean): LlmProvider {
  if (!enabled) {
    return { generateFix: async () => undefined };
  }
  return new OpenRouterProvider();
}
