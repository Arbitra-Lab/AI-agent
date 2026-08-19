/**
 * Prompt Manager Tests
 *
 * Tests version tracking, context logging, and LLM call tracing
 */

import { PromptManager } from '../promptManager';
import { getSystemPromptMetadata } from '../systemPrompt';
import { PromptContext } from '../types';

describe('PromptManager', () => {
  beforeEach(() => {
    PromptManager.reset();
  });

  describe('Initialization', () => {
    test('initializes with system prompt registered', () => {
      PromptManager.initialize();

      const versions = PromptManager.getRegisteredVersions();
      expect(versions.length).toBeGreaterThan(0);

      const systemVersion = versions[0];
      expect(systemVersion.versionId).toBeDefined();
      expect(systemVersion.metadata).toBeDefined();
      expect(systemVersion.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('retrieves current system prompt version', () => {
      PromptManager.initialize();

      const version = PromptManager.getCurrentSystemPromptVersion();
      expect(version).toBeDefined();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('System Prompt Retrieval', () => {
    beforeEach(() => {
      PromptManager.initialize();
    });

    test('returns rendered system prompt', () => {
      const rendered = PromptManager.getSystemPrompt();

      expect(rendered.versionId).toBeDefined();
      expect(rendered.systemPrompt).toBeDefined();
      expect(rendered.systemPrompt.length).toBeGreaterThan(100);
      expect(rendered.context.metadata).toBeDefined();
    });

    test('injects context when provided', () => {
      const context: PromptContext = {
        metadata: getSystemPromptMetadata(),
        systemInstructions: 'test',
        escrowState: {
          escrowId: 'test-123',
          status: 'active',
          sender: 'GAAAA',
          receiver: 'GBBBB',
          amount: '100',
          assetCode: 'USD',
          assetIssuer: 'GISSUER',
          releaseHistory: [],
        },
      };

      const rendered = PromptManager.getSystemPrompt(context);

      expect(rendered.systemPrompt).toContain('test-123');
      expect(rendered.context.escrowState).toBeDefined();
      expect(rendered.context.escrowState?.escrowId).toBe('test-123');
    });
  });

  describe('Version Tracking', () => {
    beforeEach(() => {
      PromptManager.initialize();
    });

    test('tracks all registered prompt versions', () => {
      const versions = PromptManager.getRegisteredVersions();

      expect(versions).toBeInstanceOf(Array);
      versions.forEach((entry) => {
        expect(entry.versionId).toBeDefined();
        expect(entry.metadata).toBeDefined();
        expect(entry.timestamp).toBeInstanceOf(Date);
      });
    });

    test('retrieves metadata for specific version', () => {
      const versions = PromptManager.getRegisteredVersions();
      const versionId = versions[0].versionId;

      const metadata = PromptManager.getVersionMetadata(versionId);

      expect(metadata).toBeDefined();
      expect(metadata?.version).toBe(versionId);
      expect(metadata?.description).toBeDefined();
    });

    test('returns undefined for unknown version', () => {
      const metadata = PromptManager.getVersionMetadata('99.99.99');

      expect(metadata).toBeUndefined();
    });
  });

  describe('LLM Call Logging', () => {
    beforeEach(() => {
      PromptManager.initialize();
    });

    test('logs LLM call initiation with version tracking', () => {
      const conversationId = 'conv-123';
      const promptVersionId = PromptManager.getCurrentSystemPromptVersion();
      const userMessage = 'What is the status of my escrow?';

      // Should not throw
      expect(() => {
        PromptManager.logLLMCallInitiation(
          conversationId,
          promptVersionId,
          userMessage,
          {
            toolsAvailable: 3,
          },
        );
      }).not.toThrow();
    });

    test('logs LLM call completion with token usage', () => {
      const conversationId = 'conv-123';
      const promptVersionId = PromptManager.getCurrentSystemPromptVersion();
      const response = 'Your escrow status is active with $500 released.';
      const tokensUsed = { prompt: 150, completion: 50, total: 200 };

      // Should not throw
      expect(() => {
        PromptManager.logLLMCallCompletion(
          conversationId,
          promptVersionId,
          response,
          tokensUsed,
          {
            toolsCalled: ['get_escrow_status'],
          },
        );
      }).not.toThrow();
    });

    test('logs LLM call errors with context', () => {
      const conversationId = 'conv-123';
      const promptVersionId = PromptManager.getCurrentSystemPromptVersion();
      const error = new Error('API rate limit exceeded');

      // Should not throw
      expect(() => {
        PromptManager.logLLMCallError(conversationId, promptVersionId, error, {
          retryCount: 3,
        });
      }).not.toThrow();
    });

    test('warns when logging with unknown version', () => {
      const conversationId = 'conv-123';

      // Should not throw, but may log warning
      expect(() => {
        PromptManager.logLLMCallInitiation(
          conversationId,
          'unknown-version',
          'test message',
        );
      }).not.toThrow();
    });
  });

  describe('Version Traceability', () => {
    beforeEach(() => {
      PromptManager.initialize();
    });

    test('prompt version appears in rendered output', () => {
      const rendered = PromptManager.getSystemPrompt();
      const versionId = rendered.versionId;

      expect(versionId).toBeDefined();
      expect(PromptManager.getVersionMetadata(versionId)).toBeDefined();
    });

    test('enables tracing LLM call to specific prompt version', () => {
      const conversationId = 'conv-trace';
      const rendered = PromptManager.getSystemPrompt();
      const promptVersionId = rendered.versionId;

      // Simulate LLM call with version tracking
      PromptManager.logLLMCallInitiation(
        conversationId,
        promptVersionId,
        'user query',
      );

      const metadata = PromptManager.getVersionMetadata(promptVersionId);
      expect(metadata).toBeDefined();

      // In production: store promptVersionId with conversation message for audit trail
      expect(promptVersionId).toBe(
        PromptManager.getCurrentSystemPromptVersion(),
      );
    });
  });

  describe('Reset for Testing', () => {
    test('clears registry on reset', () => {
      PromptManager.initialize();
      let versions = PromptManager.getRegisteredVersions();
      expect(versions.length).toBeGreaterThan(0);

      PromptManager.reset();
      versions = PromptManager.getRegisteredVersions();
      expect(versions.length).toBe(0);
    });

    test('resets to initial version', () => {
      PromptManager.initialize();
      const initialVersion = PromptManager.getCurrentSystemPromptVersion();

      PromptManager.reset();
      const resetVersion = PromptManager.getCurrentSystemPromptVersion();

      expect(resetVersion).toBe(initialVersion);
    });
  });
});
