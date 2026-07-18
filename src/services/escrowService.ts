import { parseBigIntAmount } from '../utils/amountParser';

export interface ReleaseHistoryEntry {
  amount: string; // Saved as string representation of bigint
  timestamp: string;
  confirmedBy: string;
}

export interface Escrow {
  id: string;
  sender: string;
  receiver: string;
  amount: string; // Saved as string representation of bigint
  assetCode: string;
  assetIssuer: string;
  status: 'active' | 'released' | 'disputed';
  disputeReason?: string;
  releaseHistory: ReleaseHistoryEntry[];
}

export interface UnsignedProposal {
  type: 'create_escrow' | 'approve_release' | 'initiate_dispute';
  sequence: string;
  operations: any[];
  parties: string[];
  network: string;
  unsignedTxXdr: string; // Unsigned mock transaction payload
}

export interface ConfirmationToken {
  token: string;
  action: 'create_escrow' | 'approve_release' | 'initiate_dispute';
  caller: string;
  args: any;
  expiresAt: Date;
  used: boolean;
}

export class EscrowService {
  private static escrows = new Map<string, Escrow>();
  private static tokens = new Map<string, ConfirmationToken>();
  
  // Expiration duration (5 minutes)
  private static TOKEN_LIFETIME_MS = 5 * 60 * 1000;

  /**
   * Helper to generate a random cryptographically simulated hex token.
   */
  private static generateTokenString(): string {
    const chars = '0123456789abcdef';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  }

  /**
   * Clear database and tokens (useful for testing).
   */
  public static clear(): void {
    this.escrows.clear();
    this.tokens.clear();
  }

  /**
   * Generates a pending create escrow proposal and confirmation token.
   */
  public static prepareCreateEscrow(
    caller: string,
    sender: string,
    receiver: string,
    amountStr: string,
    assetCode: string,
    assetIssuer: string
  ): { status: 'pending_confirmation'; proposal: UnsignedProposal; confirmationToken: string } {
    // 1. Caller authorization checked against agreement parties
    if (caller !== sender && caller !== receiver) {
      throw new Error(`Unauthorized: Caller '${caller}' must be one of the escrow parties (sender or receiver).`);
    }

    // 2. Asset code and issuer required explicitly
    if (!assetCode || assetCode.trim() === '') {
      throw new Error('Asset code is required explicitly.');
    }
    if (!assetIssuer || assetIssuer.trim() === '') {
      throw new Error('Asset issuer is required explicitly.');
    }

    // 3. Amounts parsed strictly as bigint
    const parsedAmount = parseBigIntAmount(amountStr);

    const proposalId = 'pending_create_' + this.generateTokenString().substring(0, 8);
    const proposal: UnsignedProposal = {
      type: 'create_escrow',
      sequence: Math.floor(Math.random() * 1000000).toString(),
      operations: [
        {
          type: 'create_escrow',
          args: {
            sender,
            receiver,
            amount: parsedAmount.toString(),
            assetCode,
            assetIssuer,
          },
        },
      ],
      parties: [sender, receiver],
      network: 'testnet',
      unsignedTxXdr: `AAAAAgAAAAD...mock_unsigned_create_escrow_xdr_for_${proposalId}`,
    };

    const tokenStr = this.generateTokenString();
    const token: ConfirmationToken = {
      token: tokenStr,
      action: 'create_escrow',
      caller,
      args: { sender, receiver, amount: parsedAmount.toString(), assetCode, assetIssuer },
      expiresAt: new Date(Date.now() + this.TOKEN_LIFETIME_MS),
      used: false,
    };

    this.tokens.set(tokenStr, token);

    return {
      status: 'pending_confirmation',
      proposal,
      confirmationToken: tokenStr,
    };
  }

  /**
   * Finalizes pending create escrow after validating confirmation token.
   */
  public static confirmCreateEscrow(caller: string, tokenStr: string): Escrow {
    const token = this.validateToken(tokenStr, 'create_escrow', caller);
    token.used = true;

    const escrowId = 'esc_' + this.generateTokenString().substring(0, 12);
    const newEscrow: Escrow = {
      id: escrowId,
      sender: token.args.sender,
      receiver: token.args.receiver,
      amount: token.args.amount,
      assetCode: token.args.assetCode,
      assetIssuer: token.args.assetIssuer,
      status: 'active',
      releaseHistory: [],
    };

    this.escrows.set(escrowId, newEscrow);
    return newEscrow;
  }

  /**
   * Generates a pending approve release proposal and confirmation token.
   */
  public static prepareApproveRelease(
    caller: string,
    escrowId: string,
    amountStr: string
  ): { status: 'pending_confirmation'; proposal: UnsignedProposal; confirmationToken: string } {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error(`Escrow with ID '${escrowId}' not found.`);
    }

    // 1. Caller authorization checked against agreement parties
    if (caller !== escrow.sender && caller !== escrow.receiver) {
      throw new Error(`Unauthorized: Caller '${caller}' must be a party to this escrow.`);
    }

    if (escrow.status !== 'active') {
      throw new Error(`Cannot approve release: Escrow status is '${escrow.status}'.`);
    }

    // 2. Amounts parsed strictly as bigint
    const releaseAmount = parseBigIntAmount(amountStr);
    
    // Check remaining balance
    const totalAmount = BigInt(escrow.amount);
    const releasedAmount = escrow.releaseHistory.reduce(
      (sum, entry) => sum + BigInt(entry.amount),
      0n
    );
    const remaining = totalAmount - releasedAmount;

    if (releaseAmount > remaining) {
      throw new Error(`Cannot approve release: Requested amount ${releaseAmount.toString()} exceeds remaining balance of ${remaining.toString()}.`);
    }

    const proposal: UnsignedProposal = {
      type: 'approve_release',
      sequence: Math.floor(Math.random() * 1000000).toString(),
      operations: [
        {
          type: 'approve_release',
          args: {
            escrowId,
            amount: releaseAmount.toString(),
          },
        },
      ],
      parties: [escrow.sender, escrow.receiver],
      network: 'testnet',
      unsignedTxXdr: `AAAAAgAAAAD...mock_unsigned_release_xdr_for_${escrowId}`,
    };

    const tokenStr = this.generateTokenString();
    const token: ConfirmationToken = {
      token: tokenStr,
      action: 'approve_release',
      caller,
      args: { escrowId, amount: releaseAmount.toString() },
      expiresAt: new Date(Date.now() + this.TOKEN_LIFETIME_MS),
      used: false,
    };

    this.tokens.set(tokenStr, token);

    return {
      status: 'pending_confirmation',
      proposal,
      confirmationToken: tokenStr,
    };
  }

  /**
   * Finalizes pending approve release after validating confirmation token.
   */
  public static confirmApproveRelease(caller: string, tokenStr: string): Escrow {
    const token = this.validateToken(tokenStr, 'approve_release', caller);
    token.used = true;

    const escrowId = token.args.escrowId;
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error(`Escrow with ID '${escrowId}' not found.`);
    }

    const releaseAmount = BigInt(token.args.amount);
    
    // Add to release history
    escrow.releaseHistory.push({
      amount: releaseAmount.toString(),
      timestamp: new Date().toISOString(),
      confirmedBy: caller,
    });

    // Check if fully released
    const totalAmount = BigInt(escrow.amount);
    const releasedAmount = escrow.releaseHistory.reduce(
      (sum, entry) => sum + BigInt(entry.amount),
      0n
    );

    if (releasedAmount >= totalAmount) {
      escrow.status = 'released';
    }

    this.escrows.set(escrowId, escrow);
    return escrow;
  }

  /**
   * Generates a pending initiate dispute proposal and confirmation token.
   */
  public static prepareInitiateDispute(
    caller: string,
    escrowId: string,
    reason: string
  ): { status: 'pending_confirmation'; proposal: UnsignedProposal; confirmationToken: string } {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error(`Escrow with ID '${escrowId}' not found.`);
    }

    // 1. Caller authorization checked against agreement parties
    if (caller !== escrow.sender && caller !== escrow.receiver) {
      throw new Error(`Unauthorized: Caller '${caller}' must be a party to this escrow.`);
    }

    if (escrow.status !== 'active') {
      throw new Error(`Cannot initiate dispute: Escrow status is '${escrow.status}'.`);
    }

    if (!reason || reason.trim() === '') {
      throw new Error('Dispute reason is required.');
    }

    const proposal: UnsignedProposal = {
      type: 'initiate_dispute',
      sequence: Math.floor(Math.random() * 1000000).toString(),
      operations: [
        {
          type: 'initiate_dispute',
          args: {
            escrowId,
            reason,
          },
        },
      ],
      parties: [escrow.sender, escrow.receiver],
      network: 'testnet',
      unsignedTxXdr: `AAAAAgAAAAD...mock_unsigned_dispute_xdr_for_${escrowId}`,
    };

    const tokenStr = this.generateTokenString();
    const token: ConfirmationToken = {
      token: tokenStr,
      action: 'initiate_dispute',
      caller,
      args: { escrowId, reason },
      expiresAt: new Date(Date.now() + this.TOKEN_LIFETIME_MS),
      used: false,
    };

    this.tokens.set(tokenStr, token);

    return {
      status: 'pending_confirmation',
      proposal,
      confirmationToken: tokenStr,
    };
  }

  /**
   * Finalizes pending initiate dispute after validating confirmation token.
   */
  public static confirmInitiateDispute(caller: string, tokenStr: string): Escrow {
    const token = this.validateToken(tokenStr, 'initiate_dispute', caller);
    token.used = true;

    const escrowId = token.args.escrowId;
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error(`Escrow with ID '${escrowId}' not found.`);
    }

    escrow.status = 'disputed';
    escrow.disputeReason = token.args.reason;

    this.escrows.set(escrowId, escrow);
    return escrow;
  }

  /**
   * Get the status of a specific escrow. Checks caller authorization.
   */
  public static getEscrowStatus(caller: string, escrowId: string): Escrow {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error(`Escrow with ID '${escrowId}' not found.`);
    }

    // Caller authorization checked against agreement parties
    if (caller !== escrow.sender && caller !== escrow.receiver) {
      throw new Error(`Unauthorized: Caller '${caller}' must be a party to this escrow.`);
    }

    return escrow;
  }

  /**
   * List all escrows where the caller is a party.
   */
  public static listMyEscrows(caller: string): Escrow[] {
    const myEscrows: Escrow[] = [];
    for (const escrow of this.escrows.values()) {
      if (escrow.sender === caller || escrow.receiver === caller) {
        myEscrows.push(escrow);
      }
    }
    return myEscrows;
  }

  /**
   * Get release history of an escrow. Checks caller authorization.
   */
  public static getReleaseHistory(caller: string, escrowId: string): ReleaseHistoryEntry[] {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error(`Escrow with ID '${escrowId}' not found.`);
    }

    // Caller authorization checked against agreement parties
    if (caller !== escrow.sender && caller !== escrow.receiver) {
      throw new Error(`Unauthorized: Caller '${caller}' must be a party to this escrow.`);
    }

    return escrow.releaseHistory;
  }

  /**
   * Validate a confirmation token for usage.
   */
  private static validateToken(
    tokenStr: string,
    expectedAction: string,
    caller: string
  ): ConfirmationToken {
    if (!tokenStr || tokenStr.trim() === '') {
      throw new Error('Missing confirmation token.');
    }

    const token = this.tokens.get(tokenStr);
    if (!token) {
      throw new Error('Invalid confirmation token.');
    }

    if (token.used) {
      throw new Error('Replayed token: Confirmation token has already been used.');
    }

    if (token.expiresAt.getTime() < Date.now()) {
      throw new Error('Confirmation token has expired.');
    }

    if (token.action !== expectedAction) {
      throw new Error(`Invalid confirmation token: Token was generated for action '${token.action}', not '${expectedAction}'.`);
    }

    if (token.caller !== caller) {
      throw new Error('Unauthorized: Caller does not match the requester of this confirmation token.');
    }

    return token;
  }

  /**
   * Force manually expire a token (for testing).
   */
  public static forceExpireToken(tokenStr: string): void {
    const token = this.tokens.get(tokenStr);
    if (token) {
      token.expiresAt = new Date(Date.now() - 1000);
    }
  }
}
