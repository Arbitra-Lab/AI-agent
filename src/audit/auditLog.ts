import { ToolContext } from '../types/context';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  toolName: string;
  caller: string;
  inputs: any;
  mutating: boolean;
  status: 'success' | 'failure' | 'pending_confirmation';
  error?: string;
  metadata?: any;
}

export class AuditLogger {
  private static logs: AuditLogEntry[] = [];

  /**
   * Log a tool invocation.
   */
  public static log(
    toolName: string,
    context: ToolContext,
    inputs: any,
    mutating: boolean,
    status: 'success' | 'failure' | 'pending_confirmation',
    error?: string,
    metadata?: any,
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date(),
      toolName,
      caller: context.caller,
      inputs: JSON.parse(JSON.stringify(inputs)), // Deep clone to prevent mutating log history
      mutating,
      status,
      error,
      metadata,
    };
    this.logs.push(entry);
    return entry;
  }

  /**
   * Retrieve all audit logs.
   */
  public static getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear audit logs (primarily for testing).
   */
  public static clear(): void {
    this.logs = [];
  }
}
