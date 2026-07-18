/**
 * ToolContext represents the context under which a tool is executed.
 * It contains the caller's authenticated identity (Stellar public key)
 * and must not be supplied or overridden by model arguments.
 */
export interface ToolContext {
  caller: string; // The authenticated public key of the caller
}
