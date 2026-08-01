export type LLMProvider = 'groq' | 'openai' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

export const PROVIDER_MODELS: Record<LLMProvider, { id: string; label: string; default?: true }[]> = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 · Fastest' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 · Recommended', default: true },
    { id: 'claude-opus-5', label: 'Opus 5 · Most capable' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini · Fastest' },
    { id: 'gpt-4o', label: 'GPT-4o · Recommended', default: true },
    { id: 'o3', label: 'o3 · Most capable' },
  ],
  groq: [
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1-8B · Fastest' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3-70B · Recommended', default: true },
    { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 · Reasoning' },
  ],
};

export interface StreamResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Single call interface all providers must implement. */
export type CallLLM = (
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  onChunk?: (chunk: string, totalSoFar: number) => void
) => Promise<StreamResult>;

export const PROVIDER_LABELS: Record<LLMProvider, { name: string; model: string; color: string }> = {
  groq:      { name: 'Groq',    model: 'Llama 3.3-70B',      color: '#F97316' },
  openai:    { name: 'OpenAI',  model: 'GPT-4o',             color: '#10A37F' },
  anthropic: { name: 'Claude',  model: 'claude-sonnet-4-6',  color: '#7C3AED' },
};

export const PLACEHOLDER_KEYS: Record<LLMProvider, string> = {
  groq:      '',
  openai:    'sk-placeholder-enter-your-openai-key-here',
  anthropic: 'sk-ant-placeholder-enter-your-anthropic-key-here',
};

export function isPlaceholderKey(key: string): boolean {
  if (!key || key.trim() === '') return true;
  return key.startsWith('sk-placeholder') || key.startsWith('sk-ant-placeholder');
}
