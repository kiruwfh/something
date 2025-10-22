import * as vscode from 'vscode';
import type { LLMProvider, SuggestFixInput, SuggestFixResult } from './provider';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: Record<string, unknown>;
}

export class OpenRouterProvider implements LLMProvider {
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async suggestFix(input: SuggestFixInput): Promise<SuggestFixResult> {
    const config = vscode.workspace.getConfiguration('safecheck');
    const baseUrl = config.get<string>('llm.baseUrl', 'https://openrouter.ai/api/v1');
    const model = config.get<string>('llm.model', 'deepseek/deepseek-chat-v3.1:free');
    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured. Set it via "SafeCheck: Open Settings".');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/safecheck/safecheck-vscode'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(input) }
          ],
          temperature: 0
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter responded with ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as OpenRouterResponse;
      const diff = payload.choices?.[0]?.message?.content?.trim();
      if (!diff) {
        throw new Error('Model returned an empty response.');
      }
      return { diff, usage: payload.usage };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveApiKey(): Promise<string | undefined> {
    const stored = await this.context.secrets.get('safecheck.openrouterApiKey');
    if (stored) {
      return stored;
    }
    return process.env.OPENROUTER_API_KEY ?? process.env.SAFECHECK_OPENROUTER_API_KEY;
  }
}

export function createLlmProvider(context: vscode.ExtensionContext): LLMProvider {
  return new OpenRouterProvider(context);
}
