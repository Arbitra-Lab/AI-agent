import { ToolRegistry } from '../src/registry/toolRegistry';
import { EscrowService } from '../src/services/escrowService';
import { registerEscrowTools } from '../src/tools/escrowTools';
import { AuditLogger } from '../src/audit/auditLog';
import { ToolContext } from '../src/types/context';

describe('Escrow Tools Registration & Execution Tests', () => {
  const SENDER = 'GD5T6...SENDER_PUBLIC_KEY';
  const RECEIVER = 'GB7T4...RECEIVER_PUBLIC_KEY';
  const UNAUTHORIZED = 'GA3T9...STRANGER_PUBLIC_KEY';
  
  const nativeAssetCode = 'USD';
  const nativeAssetIssuer = 'GBXXXX...ISSUER_PUBLIC_KEY';

  beforeAll(() => {
    // Register all tools
    registerEscrowTools();
  });

  beforeEach(() => {
    // Clear in-memory database, tokens, and audit logs
    EscrowService.clear();
    AuditLogger.clear();
  });

  // --- HAPPY PATH TESTS ---
  test('Happy Path: Complete escrow lifecycle', async () => {
    const senderContext: ToolContext = { caller: SENDER };

    // 1. Prepare escrow creation (Phase 1)
    const prepareCreateResult = await ToolRegistry.executeTool(
      'create_escrow',
      {
        sender: SENDER,
        receiver: RECEIVER,
        amount: '1000',
        assetCode: nativeAssetCode,
        assetIssuer: nativeAssetIssuer,
      },
      senderContext
    );

    expect(prepareCreateResult.status).toBe('pending_confirmation');
    expect(prepareCreateResult.confirmationToken).toBeDefined();
    expect(prepareCreateResult.proposal).toBeDefined();
    expect(prepareCreateResult.proposal.parties).toContain(SENDER);
    expect(prepareCreateResult.proposal.parties).toContain(RECEIVER);

    // Assert audit logging recorded the pending tool invocation
    let logs = AuditLogger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].toolName).toBe('create_escrow');
    expect(logs[0].status).toBe('pending_confirmation');
    expect(logs[0].caller).toBe(SENDER);

    const token = prepareCreateResult.confirmationToken;

    // 2. Finalize escrow creation (Phase 2)
    const finalizeCreateResult = await ToolRegistry.executeTool(
      'create_escrow',
      {
        confirmationToken: token,
      },
      senderContext
    );

    expect(finalizeCreateResult.status).toBe('confirmed');
    expect(finalizeCreateResult.escrow).toBeDefined();
    const escrowId = finalizeCreateResult.escrow.id;
    expect(escrowId).toBeDefined();
    expect(finalizeCreateResult.escrow.status).toBe('active');
    expect(finalizeCreateResult.escrow.amount).toBe('1000');

    // Assert audit logging recorded success
    logs = AuditLogger.getLogs();
    expect(logs.length).toBe(2);
    expect(logs[1].status).toBe('success');

    // 3. Get escrow status (Read-only)
    const statusResult = await ToolRegistry.executeTool(
      'get_escrow_status',
      { escrowId },
      senderContext
    );
    expect(statusResult.id).toBe(escrowId);
    expect(statusResult.status).toBe('active');

    // 4. List my escrows
    const listResult = await ToolRegistry.executeTool(
      'list_my_escrows',
      {},
      senderContext
    );
    expect(listResult.length).toBe(1);
    expect(listResult[0].id).toBe(escrowId);

    // 5. Prepare Release (Phase 1)
    const prepareReleaseResult = await ToolRegistry.executeTool(
      'approve_release',
      {
        escrowId,
        amount: '400',
      },
      senderContext
    );
    expect(prepareReleaseResult.status).toBe('pending_confirmation');
    expect(prepareReleaseResult.confirmationToken).toBeDefined();

    // 6. Confirm Release (Phase 2)
    const finalizeReleaseResult = await ToolRegistry.executeTool(
      'approve_release',
      {
        confirmationToken: prepareReleaseResult.confirmationToken,
      },
      senderContext
    );
    expect(finalizeReleaseResult.status).toBe('confirmed');
    expect(finalizeReleaseResult.escrow.releaseHistory.length).toBe(1);
    expect(finalizeReleaseResult.escrow.releaseHistory[0].amount).toBe('400');
    expect(finalizeReleaseResult.escrow.status).toBe('active'); // Still active since only partial release

    // 7. Get release history
    const historyResult = await ToolRegistry.executeTool(
      'get_release_history',
      { escrowId },
      senderContext
    );
    expect(historyResult.length).toBe(1);
    expect(historyResult[0].amount).toBe('400');

    // 8. Prepare Dispute (Phase 1)
    const prepareDisputeResult = await ToolRegistry.executeTool(
      'initiate_dispute',
      {
        escrowId,
        reason: 'Services were not rendered according to the specifications.',
      },
      senderContext
    );
    expect(prepareDisputeResult.status).toBe('pending_confirmation');

    // 9. Confirm Dispute (Phase 2)
    const finalizeDisputeResult = await ToolRegistry.executeTool(
      'initiate_dispute',
      {
        confirmationToken: prepareDisputeResult.confirmationToken,
      },
      senderContext
    );
    expect(finalizeDisputeResult.status).toBe('confirmed');
    expect(finalizeDisputeResult.escrow.status).toBe('disputed');
    expect(finalizeDisputeResult.escrow.disputeReason).toBe('Services were not rendered according to the specifications.');
  });

  // --- UNAUTHORIZED CALLER TESTS ---
  test('Security: Unauthorized caller rejection', async () => {
    const strangerContext: ToolContext = { caller: UNAUTHORIZED };
    const senderContext: ToolContext = { caller: SENDER };

    // 1. Unauthorized create escrow (caller must be sender or receiver)
    await expect(
      ToolRegistry.executeTool(
        'create_escrow',
        {
          sender: SENDER,
          receiver: RECEIVER,
          amount: '500',
          assetCode: nativeAssetCode,
          assetIssuer: nativeAssetIssuer,
        },
        strangerContext
      )
    ).rejects.toThrow(/Unauthorized/);

    let logs = AuditLogger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('failure');
    expect(logs[0].error).toContain('Unauthorized');

    // Create a valid escrow to test subsequent authorization
    const createRes = await ToolRegistry.executeTool(
      'create_escrow',
      {
        sender: SENDER,
        receiver: RECEIVER,
        amount: '1000',
        assetCode: nativeAssetCode,
        assetIssuer: nativeAssetIssuer,
      },
      senderContext
    );
    const confirmedRes = await ToolRegistry.executeTool(
      'create_escrow',
      { confirmationToken: createRes.confirmationToken },
      senderContext
    );
    const escrowId = confirmedRes.escrow.id;

    // 2. Unauthorized get status
    await expect(
      ToolRegistry.executeTool('get_escrow_status', { escrowId }, strangerContext)
    ).rejects.toThrow(/Unauthorized/);

    // 3. Unauthorized get release history
    await expect(
      ToolRegistry.executeTool('get_release_history', { escrowId }, strangerContext)
    ).rejects.toThrow(/Unauthorized/);

    // 4. Unauthorized approve release
    await expect(
      ToolRegistry.executeTool('approve_release', { escrowId, amount: '100' }, strangerContext)
    ).rejects.toThrow(/Unauthorized/);

    // 5. Unauthorized initiate dispute
    await expect(
      ToolRegistry.executeTool('initiate_dispute', { escrowId, reason: 'unauthorized' }, strangerContext)
    ).rejects.toThrow(/Unauthorized/);
  });

  // --- MISSING CONFIRMATION TESTS ---
  test('Security: Missing confirmation token validation', async () => {
    const senderContext: ToolContext = { caller: SENDER };

    // Call phase 2 (confirmation) with empty token
    await expect(
      ToolRegistry.executeTool('create_escrow', { confirmationToken: '' }, senderContext)
    ).rejects.toThrow(/Missing confirmation token/);

    // Call phase 2 with invalid token
    await expect(
      ToolRegistry.executeTool('create_escrow', { confirmationToken: 'invalid_token' }, senderContext)
    ).rejects.toThrow(/Invalid confirmation token/);

    // Verify it is logged as a failure
    const logs = AuditLogger.getLogs();
    expect(logs[logs.length - 1].status).toBe('failure');
  });

  // --- REPLAYED TOKEN TESTS ---
  test('Security: Replayed confirmation token prevention', async () => {
    const senderContext: ToolContext = { caller: SENDER };

    const prepareRes = await ToolRegistry.executeTool(
      'create_escrow',
      {
        sender: SENDER,
        receiver: RECEIVER,
        amount: '1000',
        assetCode: nativeAssetCode,
        assetIssuer: nativeAssetIssuer,
      },
      senderContext
    );

    const token = prepareRes.confirmationToken;

    // First use: Should succeed
    const firstUseRes = await ToolRegistry.executeTool(
      'create_escrow',
      { confirmationToken: token },
      senderContext
    );
    expect(firstUseRes.status).toBe('confirmed');

    // Second use (replay): Should fail
    await expect(
      ToolRegistry.executeTool(
        'create_escrow',
        { confirmationToken: token },
        senderContext
      )
    ).rejects.toThrow(/Replayed token/);

    const logs = AuditLogger.getLogs();
    expect(logs[logs.length - 1].status).toBe('failure');
    expect(logs[logs.length - 1].error).toContain('Replayed token');
  });

  // --- MALFORMED AMOUNT TESTS ---
  test('Security: Malformed amount rejection', async () => {
    const senderContext: ToolContext = { caller: SENDER };

    const invalidAmounts = ['abc', '100.5', '-100', '', '  ', '100a', '0', '1e3'];

    for (const amount of invalidAmounts) {
      await expect(
        ToolRegistry.executeTool(
          'create_escrow',
          {
            sender: SENDER,
            receiver: RECEIVER,
            amount: amount,
            assetCode: nativeAssetCode,
            assetIssuer: nativeAssetIssuer,
          },
          senderContext
        )
      ).rejects.toThrow(/Invalid or ambiguous amount/);
    }
  });

  // --- EXPIRED TOKEN TESTS ---
  test('Security: Expired token rejection', async () => {
    const senderContext: ToolContext = { caller: SENDER };

    const prepareRes = await ToolRegistry.executeTool(
      'create_escrow',
      {
        sender: SENDER,
        receiver: RECEIVER,
        amount: '1000',
        assetCode: nativeAssetCode,
        assetIssuer: nativeAssetIssuer,
      },
      senderContext
    );

    const token = prepareRes.confirmationToken;

    // Simulate token expiration
    EscrowService.forceExpireToken(token);

    // Call with expired token
    await expect(
      ToolRegistry.executeTool(
        'create_escrow',
        { confirmationToken: token },
        senderContext
      )
    ).rejects.toThrow(/expired/);

    const logs = AuditLogger.getLogs();
    expect(logs[logs.length - 1].status).toBe('failure');
    expect(logs[logs.length - 1].error).toContain('expired');
  });
});
