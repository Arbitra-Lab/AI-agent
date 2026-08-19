import { AnthropicProvider } from '../anthropic';
import { OpenAIProvider } from '../openai';

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => {
    return {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Anthropic mock response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      },
    };
  });
});

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: { content: 'OpenAI mock response' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        },
      },
    };
  });
});

describe('LLM Providers', () => {
  describe('AnthropicProvider', () => {
    it('should initialize and return a valid chat response', async () => {
      const provider = new AnthropicProvider('mock-key');
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.message.content).toBe('Anthropic mock response');
      expect(response.usage.input_tokens).toBe(10);
    });
  });

  describe('OpenAIProvider', () => {
    it('should initialize and return a valid chat response', async () => {
      const provider = new OpenAIProvider('mock-key');
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.message.content).toBe('OpenAI mock response');
      expect(response.usage.input_tokens).toBe(10);
    });
  });
});
