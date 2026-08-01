import Anthropic from '@anthropic-ai/sdk';
import type { CallLLM, StreamResult } from './types';
import { isPlaceholderKey } from './types';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function createAnthropicCallLLM(apiKey: string, model?: string): CallLLM {
  return async function callLLM(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    onChunk?: (chunk: string, totalSoFar: number) => void
  ): Promise<StreamResult> {
    if (isPlaceholderKey(apiKey)) {
      throw new Error(
        'Claude (Anthropic) API key not configured. Go to Settings and enter your Anthropic API key.'
      );
    }

    const client = new Anthropic({ apiKey });
    const resolvedModel = model || DEFAULT_MODEL;

    // Use prompt caching via the beta messages endpoint (SDK ≥ 0.27).
    // System prompt is marked ephemeral — cached for 5 min, ~90% cost on cache reads.
    const stream = await client.messages.create(
      {
        model: resolvedModel,
        max_tokens: maxTokens,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as any,
        messages: [{ role: 'user', content: userPrompt }],
        stream: true,
      },
      // Pass the beta header via request options so TypeScript doesn't reject the array system
      { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } }
    );

    let full = '';
    let promptTokens = 0;
    let completionTokens = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        full += event.delta.text;
        onChunk?.(event.delta.text, full.length);
      }
      if (event.type === 'message_start') {
        promptTokens = event.message.usage.input_tokens;
      }
      if (event.type === 'message_delta') {
        completionTokens = event.usage.output_tokens;
      }
    }

    return {
      text: full,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  };
}

export { DEFAULT_MODEL as ANTHROPIC_MODEL };
