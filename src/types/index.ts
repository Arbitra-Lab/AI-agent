/**
 * Shared types used across modules. Domain-specific types (Escrow,
 * Dispute, Agreement, etc.) get added here as those services land.
 */
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
}
