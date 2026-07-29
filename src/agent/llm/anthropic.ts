import Anthropic from '@anthropic-ai/sdk';
import {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  ChatChunk,
  Message,
  ToolDefinition,
} from './types';
import { LLMProviderError, LLMProviderErrorCode } from './errors';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      maxRetries: 3,
    });
  }

  private mapError(error: any): LLMProviderError {
    if (error instanceof Anthropic.APIError) {
      let code = LLMProviderErrorCode.SERVER_ERROR;
      let isRetryable = false;

      if (error.status === 429) {
        code = LLMProviderErrorCode.RATE_LIMIT;
        isRetryable = true;
      } else if (error.status === 401 || error.status === 403) {
        code = LLMProviderErrorCode.AUTHENTICATION;
      } else if (error.status === 400) {
        code = LLMProviderErrorCode.INVALID_REQUEST;
      } else if (error.status >= 500) {
        code = LLMProviderErrorCode.SERVER_ERROR;
        isRetryable = true;
      }

      if (error instanceof Anthropic.APIConnectionTimeoutError) {
        code = LLMProviderErrorCode.TIMEOUT;
        isRetryable = true;
      }

      return new LLMProviderError(error.message, code, this.name, isRetryable, error);
    }
    return new LLMProviderError(
      error?.message || 'Unknown error',
      LLMProviderErrorCode.UNKNOWN,
      this.name,
      false,
      error
    );
  }

  private translateMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map((msg) => {
      let content: string | Anthropic.ContentBlockParam[];
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else {
        content = msg.content.map((c) => {
          if (c.type === 'text') return { type: 'text', text: c.text };
          if (c.type === 'tool_use')
            return {
              type: 'tool_use',
              id: c.id,
              name: c.name,
              input: c.input,
            };
          if (c.type === 'tool_result')
            return {
              type: 'tool_result',
              tool_use_id: c.tool_use_id,
              content: c.content,
              is_error: c.is_error,
            };
          throw new Error('Unknown content type');
        });
      }
      return {
        role: msg.role,
        content: content,
      };
    });
  }

  private translateTools(tools?: ToolDefinition[]): Anthropic.Tool[] | undefined {
    if (!tools) return undefined;
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    try {
      const response = await this.client.messages.create({
        model: req.model || 'claude-3-5-sonnet-latest',
        max_tokens: req.max_tokens || 4096,
        temperature: req.temperature,
        system: req.system,
        messages: this.translateMessages(req.messages),
        tools: this.translateTools(req.tools),
      });

      const messageContent: any[] = response.content.map((c) => {
        if (c.type === 'text') return { type: 'text', text: c.text };
        if (c.type === 'tool_use')
          return { type: 'tool_use', id: c.id, name: c.name, input: c.input };
        return { type: 'text', text: JSON.stringify(c) };
      });

      console.log(`[Anthropic] latency: ${Date.now() - startTime}ms`);

      return {
        message: {
          role: 'assistant',
          content: messageContent.length === 1 && messageContent[0].type === 'text' ? messageContent[0].text : messageContent,
        },
        stop_reason: response.stop_reason || 'end_turn',
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      };
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const startTime = Date.now();
    try {
      const stream = await this.client.messages.create({
        model: req.model || 'claude-3-5-sonnet-latest',
        max_tokens: req.max_tokens || 4096,
        temperature: req.temperature,
        system: req.system,
        messages: this.translateMessages(req.messages),
        tools: this.translateTools(req.tools),
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            yield { type: 'text', text: chunk.delta.text };
          }
        } else if (chunk.type === 'message_delta') {
          if (chunk.delta.stop_reason) {
            yield { type: 'stop', stop_reason: chunk.delta.stop_reason };
          }
          if (chunk.usage) {
             // Anthropic streams emit usage delta
          }
        }
      }
      console.log(`[Anthropic] stream latency: ${Date.now() - startTime}ms`);
    } catch (e) {
      throw this.mapError(e);
    }
  }
}
