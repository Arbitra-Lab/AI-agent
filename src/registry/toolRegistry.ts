import { ToolContext } from '../types/context';
import { AuditLogger } from '../audit/auditLog';

export interface ToolDefinition {
  name: string;
  description: string;
  mutating: boolean;
  requiresConfirmation: boolean;
  execute: (args: any, context: ToolContext) => Promise<any>;
}

export class ToolRegistry {
  private static registry = new Map<string, ToolDefinition>();

  /**
   * Register a tool with the registry.
   */
  public static register(tool: ToolDefinition): void {
    this.registry.set(tool.name, tool);
  }

  /**
   * Get a registered tool by its name.
   */
  public static getTool(name: string): ToolDefinition | undefined {
    return this.registry.get(name);
  }

  /**
   * List all registered tools.
   */
  public static listTools(): ToolDefinition[] {
    return Array.from(this.registry.values());
  }

  /**
   * Execute a registered tool under the given ToolContext.
   * Automatically logs execution to the audit log.
   */
  public static async executeTool(
    name: string,
    args: any,
    context: ToolContext
  ): Promise<any> {
    const tool = this.registry.get(name);
    if (!tool) {
      const errorMsg = `Tool '${name}' is not registered.`;
      // Log the failed lookup as a system failure
      AuditLogger.log(
        name,
        context,
        args,
        false,
        'failure',
        errorMsg
      );
      throw new Error(errorMsg);
    }

    try {
      const result = await tool.execute(args, context);
      
      // Determine the status from the result
      let status: 'success' | 'pending_confirmation' = 'success';
      if (tool.mutating && result && result.status === 'pending_confirmation') {
        status = 'pending_confirmation';
      }

      AuditLogger.log(
        tool.name,
        context,
        args,
        tool.mutating,
        status,
        undefined,
        result
      );

      return result;
    } catch (error: any) {
      const errMsg = error.message || String(error);
      AuditLogger.log(
        tool.name,
        context,
        args,
        tool.mutating,
        'failure',
        errMsg
      );
      throw error;
    }
  }

  /**
   * Reset the registry.
   */
  public static clear(): void {
    this.registry.clear();
  }
}
