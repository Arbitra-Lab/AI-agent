import { LLMProvider } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { env } from '../../config/env';

export * from './types';
export * from './errors';

export function createLLMProvider(): LLMProvider {
  if (env.LLM_PROVIDER === 'openai') {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    return new OpenAIProvider(env.OPENAI_API_KEY);
  } else {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    return new AnthropicProvider(env.ANTHROPIC_API_KEY);
  }
}
