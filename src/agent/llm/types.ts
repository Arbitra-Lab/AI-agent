export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface Message {
  role: 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | {
            type: 'tool_use';
            id: string;
            name: string;
            input: Record<string, any>;
          }
        | {
            type: 'tool_result';
            tool_use_id: string;
            content: string;
            is_error?: boolean;
          }
      >;
}

export interface ChatRequest {
  system?: string;
  messages: Message[];
  tools?: ToolDefinition[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface ChatResponse {
  message: Message;
  stop_reason:
    'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | (string & {});
  usage: Usage;
}

export interface ChatChunk {
  type: 'text' | 'tool_use' | 'stop';
  text?: string;
  tool_call?: ToolCall;
  stop_reason?: string;
  usage?: Usage;
}

export interface LLMProvider {
  name: string;
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest): AsyncIterable<ChatChunk>;
}
