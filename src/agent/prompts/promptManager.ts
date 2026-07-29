/**
 * Prompt Manager
 *
 * Central registry for prompt templates with version tracking.
 * Ensures all LLM calls are traced to a specific prompt version.
 */

import { renderSystemPrompt, getSystemPromptMetadata, SYSTEM_PROMPT_VERSION_ID } from './systemPrompt';
import { PromptMetadata, PromptContext, RenderedPrompt } from './types';
import { logger } from '../../lib/logger';

/**
 * Registry of prompt versions for audit trails
 */
interface PromptVersionEntry {
    versionId: string;
    metadata: PromptMetadata;
    timestamp: Date;
}

export class PromptManager {
    private static versionRegistry: Map<string, PromptVersionEntry> = new Map();
    private static currentSystemPromptVersion = SYSTEM_PROMPT_VERSION_ID;

    /**
     * Initialize the prompt manager and register the system prompt
     */
    public static initialize(): void {
        const metadata = getSystemPromptMetadata();
        this.registerPromptVersion(metadata.version, metadata);
        logger.info(`PromptManager initialized with system prompt v${metadata.version}`);
    }

    /**
     * Register a prompt version for tracking
     */
    private static registerPromptVersion(versionId: string, metadata: PromptMetadata): void {
        this.versionRegistry.set(versionId, {
            versionId,
            metadata,
            timestamp: new Date(),
        });
    }

    /**
     * Get system prompt with optional context injection
     *
     * @param context - Optional context with state and user content
     * @returns Rendered prompt with version tracking
     */
    public static getSystemPrompt(context?: PromptContext): RenderedPrompt {
        const rendered = renderSystemPrompt(context);

        const contextTypes = [
            context?.escrowState ? 'escrow' : null,
            context?.agreementState ? 'agreement' : null,
            context?.disputeState ? 'dispute' : null,
            context?.userContent ? 'userContent' : null,
        ]
            .filter((t) => t !== null)
            .join(', ');

        if (contextTypes) {
            logger.info(`System prompt v${rendered.versionId} rendered with context: ${contextTypes}`);
        }

        return rendered;
    }

    /**
     * Get the current system prompt version ID
     * Used for logging with LLM calls
     */
    public static getCurrentSystemPromptVersion(): string {
        return this.currentSystemPromptVersion;
    }

    /**
     * Get all registered prompt versions (for audit purposes)
     */
    public static getRegisteredVersions(): PromptVersionEntry[] {
        return Array.from(this.versionRegistry.values());
    }

    /**
     * Get metadata for a specific prompt version
     */
    public static getVersionMetadata(versionId: string): PromptMetadata | undefined {
        return this.versionRegistry.get(versionId)?.metadata;
    }

    /**
     * Log an LLM call with associated prompt version
     * Call this before sending to LLM for complete audit trail
     */
    public static logLLMCallInitiation(
        conversationId: string,
        promptVersionId: string,
        userMessage: string,
        metadata?: Record<string, any>
    ): void {
        const versionEntry = this.versionRegistry.get(promptVersionId);
        if (!versionEntry) {
            logger.warn(`LLM call references unknown prompt version: ${promptVersionId}`);
        }

        const msg = `LLM call initiated: conv=${conversationId}, prompt=${promptVersionId}, msg_len=${userMessage.length}`;
        logger.info(msg);
    }

    /**
     * Log an LLM call completion
     * Call this after receiving response from LLM
     */
    public static logLLMCallCompletion(
        conversationId: string,
        promptVersionId: string,
        response: string,
        tokensUsed?: { prompt: number; completion: number; total: number },
        metadata?: Record<string, any>
    ): void {
        const tokenStr = tokensUsed ? `, tokens=${tokensUsed.total}` : '';
        const msg = `LLM call completed: conv=${conversationId}, prompt=${promptVersionId}, resp_len=${response.length}${tokenStr}`;
        logger.info(msg);
    }

    /**
     * Log an LLM call error
     */
    public static logLLMCallError(
        conversationId: string,
        promptVersionId: string,
        error: Error,
        metadata?: Record<string, any>
    ): void {
        logger.error(
            `LLM call failed: conv=${conversationId}, prompt=${promptVersionId}, error=${error.message}`
        );
    }

    /**
     * Reset registry (for testing)
     */
    public static reset(): void {
        this.versionRegistry.clear();
        this.currentSystemPromptVersion = SYSTEM_PROMPT_VERSION_ID;
    }
}
