import { ToolDefinition, ToolRegistry } from '../registry/toolRegistry';
import { EscrowService } from '../services/escrowService';
import { ToolContext } from '../types/context';

/**
 * 1. get_escrow_status (Read-only, mutating: false)
 */
export const getEscrowStatusTool: ToolDefinition = {
  name: 'get_escrow_status',
  description:
    'Get the status and details of a specific escrow agreement. Note: The agent cannot unilaterally move funds, as all operations require cryptographic signatures from the transaction parties.',
  mutating: false,
  requiresConfirmation: false,
  execute: (args: any, context: ToolContext) => {
    if (!args || typeof args.escrowId !== 'string') {
      throw new Error(
        "Missing or invalid argument: 'escrowId' must be a string.",
      );
    }
    return Promise.resolve(
      EscrowService.getEscrowStatus(context.caller, args.escrowId),
    );
  },
};

/**
 * 2. list_my_escrows (Read-only, mutating: false)
 */
export const listMyEscrowsTool: ToolDefinition = {
  name: 'list_my_escrows',
  description:
    'List all active, released, or disputed escrows where the caller is either the sender or receiver. Note: The agent cannot unilaterally move funds.',
  mutating: false,
  requiresConfirmation: false,
  execute: (args: any, context: ToolContext) => {
    return Promise.resolve(EscrowService.listMyEscrows(context.caller));
  },
};

/**
 * 3. get_release_history (Read-only, mutating: false)
 */
export const getReleaseHistoryTool: ToolDefinition = {
  name: 'get_release_history',
  description:
    'Get the release history for an escrow agreement. Note: The agent cannot unilaterally move funds, as all operations require cryptographic signatures from the transaction parties.',
  mutating: false,
  requiresConfirmation: false,
  execute: (args: any, context: ToolContext) => {
    if (!args || typeof args.escrowId !== 'string') {
      throw new Error(
        "Missing or invalid argument: 'escrowId' must be a string.",
      );
    }
    return Promise.resolve(
      EscrowService.getReleaseHistory(context.caller, args.escrowId),
    );
  },
};

/**
 * 4. create_escrow (Mutating, mutating: true, requiresConfirmation: true)
 */
export const createEscrowTool: ToolDefinition = {
  name: 'create_escrow',
  description:
    "Create a new escrow agreement. This tool prepares a structured unsigned proposal that must be signed by the parties' user keys. Note: The agent cannot unilaterally move funds, and user keys are never sent to the service.",
  mutating: true,
  requiresConfirmation: true,
  execute: (args: any, context: ToolContext) => {
    if (!args) {
      throw new Error('Arguments are required.');
    }

    const {
      sender,
      receiver,
      amount,
      assetCode,
      assetIssuer,
      confirmationToken,
    } = args;

    // Phase 2: Confirmation token is supplied
    if (confirmationToken !== undefined) {
      if (typeof confirmationToken !== 'string') {
        throw new Error('Confirmation token must be a string.');
      }
      const escrow = EscrowService.confirmCreateEscrow(
        context.caller,
        confirmationToken,
      );
      return Promise.resolve({
        status: 'confirmed',
        escrow,
      });
    }

    // Phase 1: Prepare proposal & token
    if (
      typeof sender !== 'string' ||
      typeof receiver !== 'string' ||
      typeof amount !== 'string'
    ) {
      throw new Error(
        "Invalid arguments: 'sender', 'receiver', and 'amount' must be strings.",
      );
    }

    return Promise.resolve(
      EscrowService.prepareCreateEscrow(
        context.caller,
        sender,
        receiver,
        amount,
        assetCode,
        assetIssuer,
      ),
    );
  },
};

/**
 * 5. approve_release (Mutating, mutating: true, requiresConfirmation: true)
 */
export const approveReleaseTool: ToolDefinition = {
  name: 'approve_release',
  description:
    "Approve the release of funds from an escrow. This tool prepares a structured unsigned proposal that must be signed by the parties' user keys. Note: The agent cannot unilaterally move funds, and user keys are never sent to the service.",
  mutating: true,
  requiresConfirmation: true,
  execute: (args: any, context: ToolContext) => {
    if (!args) {
      throw new Error('Arguments are required.');
    }

    const { escrowId, amount, confirmationToken } = args;

    // Phase 2: Confirmation token is supplied
    if (confirmationToken !== undefined) {
      if (typeof confirmationToken !== 'string') {
        throw new Error('Confirmation token must be a string.');
      }
      const escrow = EscrowService.confirmApproveRelease(
        context.caller,
        confirmationToken,
      );
      return Promise.resolve({
        status: 'confirmed',
        escrow,
      });
    }

    // Phase 1: Prepare proposal & token
    if (typeof escrowId !== 'string' || typeof amount !== 'string') {
      throw new Error(
        "Invalid arguments: 'escrowId' and 'amount' must be strings.",
      );
    }

    return Promise.resolve(
      EscrowService.prepareApproveRelease(context.caller, escrowId, amount),
    );
  },
};

/**
 * 6. initiate_dispute (Mutating, mutating: true, requiresConfirmation: true)
 */
export const initiateDisputeTool: ToolDefinition = {
  name: 'initiate_dispute',
  description:
    "Initiate a dispute on an active escrow. This tool prepares a structured unsigned proposal that must be signed by the parties' user keys. Note: The agent cannot unilaterally move funds, and user keys are never sent to the service.",
  mutating: true,
  requiresConfirmation: true,
  execute: (args: any, context: ToolContext) => {
    if (!args) {
      throw new Error('Arguments are required.');
    }

    const { escrowId, reason, confirmationToken } = args;

    // Phase 2: Confirmation token is supplied
    if (confirmationToken !== undefined) {
      if (typeof confirmationToken !== 'string') {
        throw new Error('Confirmation token must be a string.');
      }
      const escrow = EscrowService.confirmInitiateDispute(
        context.caller,
        confirmationToken,
      );
      return Promise.resolve({
        status: 'confirmed',
        escrow,
      });
    }

    // Phase 1: Prepare proposal & token
    if (typeof escrowId !== 'string' || typeof reason !== 'string') {
      throw new Error(
        "Invalid arguments: 'escrowId' and 'reason' must be strings.",
      );
    }

    return Promise.resolve(
      EscrowService.prepareInitiateDispute(context.caller, escrowId, reason),
    );
  },
};

/**
 * Register all escrow tools into the ToolRegistry.
 */
export function registerEscrowTools(): void {
  ToolRegistry.register(getEscrowStatusTool);
  ToolRegistry.register(listMyEscrowsTool);
  ToolRegistry.register(getReleaseHistoryTool);
  ToolRegistry.register(createEscrowTool);
  ToolRegistry.register(approveReleaseTool);
  ToolRegistry.register(initiateDisputeTool);
}
