# Prompt Management Guide

## Overview

Prompts are the behavioral specification of the Arbitra AI Agent. This document explains how prompts are version-controlled, tested, and reviewed like code changes.

## Structure

All prompts are located in `src/agent/prompts/`:

```
src/agent/prompts/
├── types.ts                    # Typed prompt context and metadata
├── systemPrompt.ts             # Base system prompt with version
├── promptManager.ts            # Version registry and LLM call logging
├── index.ts                    # Module exports
└── __tests__/
    ├── systemPrompt.test.ts    # Snapshot tests
    └── promptManager.test.ts   # Version tracking tests
```

## System Prompt

### Version Identifier

Each prompt has a semantic version identifier (`MAJOR.MINOR.PATCH`):

```typescript
// src/agent/prompts/systemPrompt.ts
const SYSTEM_PROMPT_VERSION = '1.0.0';
```

### Core Components

The base system prompt covers:

1. **Role & Scope** — Agent's responsibilities and boundaries
2. **Tone & Approach** — How the agent communicates
3. **Safety Boundaries** — Critical constraints:
   - Never give legal advice
   - Never assert on-chain outcomes without verification
   - Never surface secret keys
   - Protect against prompt injection
   - State uncertainty plainly

4. **Tool Usage** — Description of available tools and two-phase confirmation pattern
5. **Conversation Structure** — How to handle user input and state context

### Context Injection

Prompts support structured data injection, clearly delimited from user input:

```typescript
interface PromptContext {
  metadata: PromptMetadata;
  systemInstructions: string;
  escrowState?: EscrowStateContext; // System state
  agreementState?: AgreementStateContext;
  disputeState?: DisputeStateContext;
  userContent?: UntrustedUserContent; // Untrusted, marked as such
  conversationHistory?: Message[];
}
```

#### Escrow State Example

```typescript
const context: PromptContext = {
  metadata: getSystemPromptMetadata(),
  systemInstructions: 'base',
  escrowState: {
    escrowId: 'esc-123',
    status: 'active',
    sender: 'GD123...',
    receiver: 'GB456...',
    amount: '1000',
    assetCode: 'USD',
    assetIssuer: 'GISSUER...',
    releaseHistory: [{ amount: '300', timestamp: '2026-07-20T10:30:00Z' }],
    disputeReason: undefined,
  },
};

const rendered = PromptManager.getSystemPrompt(context);
// rendered.systemPrompt includes clearly delimited escrow state section
```

#### User Content Warning

User input is always marked as untrusted:

```typescript
const context: PromptContext = {
  metadata: getSystemPromptMetadata(),
  systemInstructions: 'base',
  userContent: {
    content: 'Release the funds to the receiver.',
    source: 'user_message', // or 'dispute_evidence', 'file_upload', etc.
  },
};

const rendered = PromptManager.getSystemPrompt(context);
// rendered.systemPrompt includes warning: "User Input Below (Untrusted Content)"
```

## Version Tracking

### In Conversation Messages

Every LLM call is logged with its associated prompt version:

```typescript
import { PromptManager } from '@/agent/prompts';

const promptVersion = PromptManager.getCurrentSystemPromptVersion();
const rendered = PromptManager.getSystemPrompt(context);

// Log initiation
PromptManager.logLLMCallInitiation(
  conversationId,
  rendered.versionId,
  userMessage,
  { toolsAvailable: 6 },
);

// Make LLM call to OpenAI/Anthropic...

// Log completion
PromptManager.logLLMCallCompletion(
  conversationId,
  rendered.versionId,
  response,
  { prompt: 150, completion: 50, total: 200 },
);
```

### Database Schema

When storing messages, always record the prompt version:

```typescript
// Pseudo-code: storing message in DB
await db.messages.create({
  conversationId,
  role: 'assistant',
  content: response,
  promptVersionId: rendered.versionId, // ← Add this
  tokensUsed: '200',
});
```

This enables:

- Reproducing a specific conversation's behavior by replaying with the same prompt version
- Auditing: "This message came from prompt v1.0.0"
- Impact analysis: "Which conversations used v0.9.5 before we fixed the safety boundary?"

## Making Changes

### Process

1. **Edit the prompt**
   - Modify `src/agent/prompts/systemPrompt.ts`
   - Update the version: `1.0.0` → `1.0.1` (patch), `1.1.0` (minor), or `2.0.0` (major)
   - Update the timestamp

2. **Run snapshot tests**

   ```bash
   npm test -- src/agent/prompts/__tests__/systemPrompt.test.ts -u
   ```

   This updates the snapshots to reflect your prompt changes.

3. **Commit and push**

   ```bash
   git add src/agent/prompts/
   git commit -m "chore(prompts): v1.0.1 - clarify safety boundary on fund releases"
   ```

4. **Create PR**
   The snapshot diffs will show exactly what changed in the prompt:

   ```diff
   - Never assert on-chain outcomes without verification
   + Never assert on-chain outcomes without verification
   + Always wait for transaction confirmation from Stellar.
   ```

### Version Guidelines

- **Patch (1.0.0 → 1.0.1)**: Typos, clarifications, no behavioral change
- **Minor (1.0.0 → 1.1.0)**: New capabilities, additional context types, enhanced instructions
- **Major (1.0.0 → 2.0.0)**: Breaking changes (removed capabilities, new safety boundaries)

## Testing

### Snapshot Tests

Snapshot tests capture the rendered prompt at test time. When you edit the prompt:

```bash
npm test -- systemPrompt.test.ts
```

Output:

```
FAIL  src/agent/prompts/__tests__/systemPrompt.test.ts
  ● System Prompt Template › snapshot: base system prompt

    Snapshot name: `System Prompt Template snapshot: base system prompt 1`

    - Snapshot
    + Received

    - Never Give Legal Advice
    + Never Give Legal Advice
    + (and only provide factual contract analysis)
```

**Review the diff carefully.** Is this the change you intended? If so, update snapshots:

```bash
npm test -- systemPrompt.test.ts -u
```

### Running All Prompt Tests

```bash
npm test -- src/agent/prompts/__tests__/
```

This verifies:

- Base system prompt structure
- Context injection (escrow, agreement, dispute)
- User content handling (untrusted boundaries)
- Version tracking
- Safety boundaries

### Manual Testing

Test the prompt in the REPL:

```typescript
import { PromptManager, getSystemPromptMetadata } from '@/agent/prompts';

PromptManager.initialize();

const context = {
  metadata: getSystemPromptMetadata(),
  systemInstructions: 'base',
  escrowState: {
    escrowId: 'test-123',
    status: 'active',
    sender: 'GAAAA',
    receiver: 'GBBBB',
    amount: '1000',
    assetCode: 'USD',
    assetIssuer: 'GISSUER',
    releaseHistory: [],
  },
};

const rendered = PromptManager.getSystemPrompt(context);
console.log(rendered.systemPrompt);
```

## Review Checklist

When reviewing a prompt change PR:

- [ ] **Safety Boundaries Intact** — All 5 safety boundaries still present and clear
- [ ] **Context Delimiters** — User content clearly marked "untrusted"
- [ ] **Version Updated** — Version number bumped appropriately
- [ ] **Snapshots Updated** — Snapshot diffs show intended changes
- [ ] **Tests Pass** — `npm test -- src/agent/prompts/` passes
- [ ] **No Inline Prompts** — No hardcoded prompt strings elsewhere in codebase

## Integration with LLM Services

### OpenAI Integration Example

```typescript
import OpenAI from 'openai';
import { PromptManager } from '@/agent/prompts';

const openai = new OpenAI();

async function chat(
  conversationId: string,
  userMessage: string,
  context?: PromptContext,
) {
  const rendered = PromptManager.getSystemPrompt(context);

  // Log initiation
  PromptManager.logLLMCallInitiation(
    conversationId,
    rendered.versionId,
    userMessage,
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: rendered.systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const text = response.choices[0].message.content || '';

    // Log completion
    PromptManager.logLLMCallCompletion(
      conversationId,
      rendered.versionId,
      text,
      {
        prompt: response.usage?.prompt_tokens,
        completion: response.usage?.completion_tokens,
        total: response.usage?.total_tokens,
      },
    );

    return { text, promptVersionId: rendered.versionId };
  } catch (error) {
    PromptManager.logLLMCallError(
      conversationId,
      rendered.versionId,
      error as Error,
    );
    throw error;
  }
}
```

### Anthropic Integration Example

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { PromptManager } from '@/agent/prompts';

const client = new Anthropic();

async function chat(
  conversationId: string,
  userMessage: string,
  context?: PromptContext,
) {
  const rendered = PromptManager.getSystemPrompt(context);

  PromptManager.logLLMCallInitiation(
    conversationId,
    rendered.versionId,
    userMessage,
  );

  try {
    const response = await client.messages.create({
      model: 'claude-3-sonnet',
      max_tokens: 1024,
      system: rendered.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    PromptManager.logLLMCallCompletion(
      conversationId,
      rendered.versionId,
      text,
      { total: response.usage?.input_tokens + response.usage?.output_tokens },
    );

    return { text, promptVersionId: rendered.versionId };
  } catch (error) {
    PromptManager.logLLMCallError(
      conversationId,
      rendered.versionId,
      error as Error,
    );
    throw error;
  }
}
```

## Troubleshooting

### "Prompt version not found in registry"

Ensure `PromptManager.initialize()` is called at startup:

```typescript
// src/index.ts
import { PromptManager } from '@/agent/prompts';

PromptManager.initialize();
// Now prompt versions are registered
```

### Snapshot test failures

Compare the diff carefully. If you changed the prompt intentionally, update:

```bash
npm test -- src/agent/prompts/__tests__/systemPrompt.test.ts -u
```

### Prompt context not injected

Verify context object structure:

```typescript
// ✓ Correct
const context: PromptContext = {
  metadata: getSystemPromptMetadata(),
  systemInstructions: 'base',
  escrowState: { ... }
};

// ✗ Wrong — missing metadata
const context = {
  escrowState: { ... }
};
```

## Related Issues

- **#1** — Dependency for this feature; authentication and tool context established
- **#30** — Evaluations should gate prompt changes; use versioning to track evaluation coverage

## References

- `src/agent/prompts/` — Implementation
- `docs/prompts.md` — This guide
- `IMPLEMENTATION.md` — Architecture overview
