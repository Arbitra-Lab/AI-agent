/**
 * Arbitra AI Agent - Prompts Module
 *
 * Version-controlled, testable prompt templates with typed context injection
 * and comprehensive LLM call tracing for reproducibility and audit trails.
 *
 * Features:
 * - Base system prompt with safety boundaries and role definition
 * - Typed template functions with interpolated variables
 * - Context injection: escrow state, agreement terms, dispute evidence
 * - Clear separation of system state from untrusted user input
 * - Prompt version tracking for traceability to LLM calls
 * - Snapshot tests to make prompt edits visible in code review
 */

// Types
export {
    PromptMetadata,
    EscrowStateContext,
    AgreementStateContext,
    DisputeStateContext,
    UntrustedUserContent,
    PromptContext,
    RenderedPrompt,
} from './types';

// System prompt template and functions
export {
    renderSystemPrompt,
    getSystemPromptMetadata,
    SYSTEM_PROMPT_VERSION_ID,
} from './systemPrompt';

// Prompt manager for version tracking and LLM call logging
export { PromptManager } from './promptManager';
