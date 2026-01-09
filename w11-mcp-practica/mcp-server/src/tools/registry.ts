import { McpTool } from '../types/jsonrpc.types';
import { BackendClient } from '../services/backend-client';
import { searchEquipmentTool, searchEquipmentHandler } from './search-equipment.tool';
import { validateAvailabilityTool, validateAvailabilityHandler } from './validate-availability.tool';
import { createRepairOrderTool, createRepairOrderHandler } from './create-order-repair.tool';

export class ToolRegistry {
  private tools: Map<string, McpTool> = new Map();
  private handlers: Map<string, Function> = new Map();
  private backendClient: BackendClient;

  constructor() {
    this.backendClient = new BackendClient();
    this.registerAllTools();
  }

  private registerAllTools() {
    this.registerTool(searchEquipmentTool, searchEquipmentHandler);
    this.registerTool(validateAvailabilityTool, validateAvailabilityHandler);
    this.registerTool(createRepairOrderTool, createRepairOrderHandler);

    console.log(`✅ ${this.tools.size} tools registrados`);
  }

  private registerTool(tool: McpTool, handler: Function) {
    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
  }

  /**
   * Obtener todos los tools (para method: tools/list)
   */
  getAllTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Ejecutar un tool por nombre (para method: tools/call)
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    const handler = this.handlers.get(toolName);
    
    if (!handler) {
      throw new Error(`Tool "${toolName}" no encontrado`);
    }

    return await handler(params, this.backendClient);
  }

  /**
   * Verificar si existe un tool
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}