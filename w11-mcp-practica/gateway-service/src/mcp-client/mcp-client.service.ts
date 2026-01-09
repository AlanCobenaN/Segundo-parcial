import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, any>;
  id: number;
}

interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);
  private readonly client: AxiosInstance;
  private requestId = 1;

  constructor() {
    const mcpUrl = process.env.MCP_SERVER_URL || 'http://localhost:3004';
    
    this.client = axios.create({
      baseURL: mcpUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.logger.log(`MCP Client initialized: ${mcpUrl}`);
  }

  async listTools(): Promise<McpTool[]> {
    this.logger.log('Requesting tools list from MCP Server');

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: this.requestId++,
    };

    try {
      const response = await this.client.post<JsonRpcResponse<McpTool[]>>('/mcp', request);

      if (response.data.error) {
        throw new Error(`MCP Error: ${response.data.error.message}`);
      }

      const tools = response.data.result || [];
      this.logger.log(`Received ${tools.length} tools`);
      return tools;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing tools: ${errorMessage}`);
      throw new Error(`No se pudo obtener la lista de tools: ${errorMessage}`);
    }
  }

  /**
   * Ejecutar un tool específico
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    this.logger.log(`Calling tool: ${toolName}`);
    this.logger.debug(`Arguments: ${JSON.stringify(args)}`);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
      id: this.requestId++,
    };

    try {
      const response = await this.client.post<JsonRpcResponse>('/mcp', request);

      if (response.data.error) {
        throw new Error(`Tool Error: ${response.data.error.message}`);
      }

      this.logger.log(`Tool ${toolName} executed successfully`);
      this.logger.debug(`Result: ${JSON.stringify(response.data.result)}`);
      
      return response.data.result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error calling tool ${toolName}: ${errorMessage}`);
      throw new Error(`Error al ejecutar ${toolName}: ${errorMessage}`);
    }
  }

  async healthCheck(): Promise<any> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`MCP Server health check failed: ${errorMessage}`);
      throw new Error('MCP Server no disponible');
    }
  }
}