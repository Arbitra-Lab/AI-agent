/**
 * Prompt Template Types
 *
 * Defines the structure for version-controlled, typed prompt templates.
 * Each prompt is versioned and logged with LLM calls for traceability.
 */

/**
 * Prompt metadata for traceability and versioning
 */
export interface PromptMetadata {
    /** Unique version identifier for this prompt */
    version: string;
    /** Human-readable description of the prompt */
    description: string;
    /** ISO timestamp of creation/last update */
    timestamp: string;
}

/**
 * Structured escrow state for injection into prompts
 * Clearly delimited from user input to prevent prompt injection
 */
export interface EscrowStateContext {
    escrowId: string;
    status: 'active' | 'released' | 'disputed';
    sender: string;
    receiver: string;
    amount: string;
    assetCode: string;
    assetIssuer: string;
    releaseHistory: Array<{
        amount: string;
        timestamp: string;
    }>;
    disputeReason?: string;
}

/**
 * Agreement state for injection into prompts
 */
export interface AgreementStateContext {
    agreementId: string;
    type: string;
    parties: string[];
    terms: Record<string, any>;
}

/**
 * Dispute context for injection into prompts
 */
export interface DisputeStateContext {
    disputeId: string;
    status: string;
    claimant: string;
    respondent: string;
    evidence: Array<{
        submittedBy: string;
        content: string;
        timestamp: string;
    }>;
}

/**
 * User-supplied content that may be untrusted
 * Marked as such to prevent prompt injection attacks
 */
export interface UntrustedUserContent {
    /** The raw user input/message */
    content: string;
    /** Source of the content (e.g., 'user_message', 'dispute_evidence', 'file_upload') */
    source: string;
}

/**
 * Complete prompt context with all injected data
 */
export interface PromptContext {
    metadata: PromptMetadata;
    systemInstructions: string;
    escrowState?: EscrowStateContext;
    agreementState?: AgreementStateContext;
    disputeState?: DisputeStateContext;
    userContent?: UntrustedUserContent;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Result of rendering a prompt template
 */
export interface RenderedPrompt {
    /** The prompt version identifier */
    versionId: string;
    /** The complete rendered system prompt */
    systemPrompt: string;
    /** Any additional context to include */
    context: Record<string, any>;
}
