/**
 * Conversation Engine, Context Manager, Memory Layer, and Tool Calling Layer
 * (see README "Architecture"). Implementations land in follow-up issues;
 * this module currently exposes the shape other services will depend on.
 */

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentResponse {
  reply: string;
}

export function handleMessage(message: AgentMessage): Promise<AgentResponse> {
  // TODO: wire up Conversation Engine + Context Manager + Memory Layer.
  // Kept as a Promise-returning function (not `async` yet, since there's
  // no `await` here) so the public API shape doesn't change once it does.
  return Promise.resolve({ reply: `Received: ${message.content}` });
}
