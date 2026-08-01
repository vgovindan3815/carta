import type { LLMConfig, LLMProvider } from './types';
import { PROVIDER_LABELS, PROVIDER_MODELS } from './types';
import { createGroqCallLLM } from './groq';
import { createAnthropicCallLLM } from './anthropic';
import { createOpenAICallLLM } from './openai';
import { createChains } from './chains';

export type { LLMConfig, LLMProvider };
export { PROVIDER_LABELS, PROVIDER_MODELS };

export function createLLMProvider(config: LLMConfig) {
  let callLLM;
  switch (config.provider) {
    case 'anthropic': callLLM = createAnthropicCallLLM(config.apiKey, config.model); break;
    case 'openai':    callLLM = createOpenAICallLLM(config.apiKey, config.model);    break;
    default:          callLLM = createGroqCallLLM(config.apiKey, config.model);      break;
  }
  const chains = createChains(callLLM);
  const meta = PROVIDER_LABELS[config.provider];
  const modelName = config.model || meta.model;
  return { ...chains, providerName: meta.name, modelName };
}

// Re-export layout helper (provider-agnostic, kept here for co-location)
export { layoutCircular } from './layout';
