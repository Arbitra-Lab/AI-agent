import OpenAI from 'openai';
import {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ToolDefinition,
} from './types';
import { LLMProviderError, LLMProviderErrorCode } from './errors';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      maxRetries: 3,
    });
  }

  private mapError(error: any): LLMProviderError {
    if (error instanceof OpenAI.APIError) {
      let code = LLMProviderErrorCode.SERVER_ERROR;
      let isRetryable = false;

      if (error.status === 429) {
        code = LLMProviderErrorCode.RATE_LIMIT;
        isRetryable = true;
      } else if (error.status === 401 || error.status === 403) {
        code = LLMProviderErrorCode.AUTHENTICATION;
      } else if (error.status === 400) {
        code = LLMProviderErrorCode.INVALID_REQUEST;
      } else if (error.status && error.status >= 500) {
        code = LLMProviderErrorCode.SERVER_ERROR;
        isRetryable = true;
      }

      if (error instanceof OpenAI.APIConnectionTimeoutError) {
        code = LLMProviderErrorCode.TIMEOUT;
        isRetryable = true;
      }

      return new LLMProviderError(
        error.message,
        code,
        this.name,
        isRetryable,
        error,
      );
    }
    return new LLMProviderError(
      error?.message || 'Unknown error',
      LLMProviderErrorCode.UNKNOWN,
      this.name,
      false,
      error,
    );
  }

  private translateMessages(
    req: ChatRequest,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [];

    if (req.system) {
      openaiMessages.push({ role: 'system', content: req.system });
    }

    for (const msg of req.messages) {
      if (typeof msg.content === 'string') {
        openaiMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      } else {
        if (msg.role === 'user') {
          // Flatten user message tools
          const toolResults = msg.content.filter(
            (c) => c.type === 'tool_result',
          );
          const texts = msg.content.filter((c) => c.type === 'text');

          if (toolResults.length > 0) {
            for (const res of toolResults as any[]) {
              openaiMessages.push({
                role: 'tool',
                tool_call_id: res.tool_use_id,
                content: res.content,
              });
            }
          }
          if (texts.length > 0) {
            openaiMessages.push({
              role: 'user',
              content: texts.map((t: any) => t.text).join('\n'),
            });
          }
        } else if (msg.role === 'assistant') {
          const toolUses = msg.content.filter((c) => c.type === 'tool_use');
          const texts = msg.content.filter((c) => c.type === 'text');

          const tool_calls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] =
            toolUses.map((c: any) => ({
              id: c.id,
              type: 'function',
              function: { name: c.name, arguments: JSON.stringify(c.input) },
            }));

          openaiMessages.push({
            role: 'assistant',
            content:
              texts.length > 0
                ? texts.map((t: any) => t.text).join('\n')
                : null,
            tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
          });
        }
      }
    }

    return openaiMessages;
  }

  private translateTools(
    tools?: ToolDefinition[],
  ): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined {
    if (!tools) return undefined;
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model: req.model || 'gpt-4o',
        messages: this.translateMessages(req),
        tools: this.translateTools(req.tools),
        temperature: req.temperature,
        max_tokens: req.max_tokens,
      });

      const choice = response.choices[0];
      const messageContent: any[] = [];

      if (choice.message.content) {
        messageContent.push({ type: 'text', text: choice.message.content });
      }

      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          if (tc.type === 'function') {
            messageContent.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments),
            });
          }
        }
      }

      console.log(`[OpenAI] latency: ${Date.now() - startTime}ms`);

      return {
        message: {
          role: 'assistant',
          content:
            messageContent.length === 1 && messageContent[0].type === 'text'
              ? messageContent[0].text
              : messageContent,
        },
        stop_reason:
          choice.finish_reason === 'tool_calls'
            ? 'tool_use'
            : choice.finish_reason,
        usage: {
          input_tokens: response.usage?.prompt_tokens || 0,
          output_tokens: response.usage?.completion_tokens || 0,
        },
      };
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const startTime = Date.now();
    try {
      const stream = await this.client.chat.completions.create({
        model: req.model || 'gpt-4o',
        messages: this.translateMessages(req),
        tools: this.translateTools(req.tools),
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        if (choice.delta.content) {
          yield { type: 'text', text: choice.delta.content };
        }
        if (choice.finish_reason) {
          yield {
            type: 'stop',
            stop_reason:
              choice.finish_reason === 'tool_calls'
                ? 'tool_use'
                : choice.finish_reason,
          };
        }
      }
      console.log(`[OpenAI] stream latency: ${Date.now() - startTime}ms`);
    } catch (e) {
      throw this.mapError(e);
    }
  }
}
