import { BackendClient } from '../services/backend-client';
import { McpTool } from '../types/jsonrpc.types';

export const searchEquipmentTool: McpTool = {
  name: 'search_equipment',
  description: 'Search for equipment by partial or full name, brand, or model in the inventory system. Case-insensitive partial matching.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term to find equipment by name, brand, or model (e.g., "Dell", "Latitude", "laptop").',
      },
    },
    required: ['query'],
  },
};

// Tool implementation - This is what gets executed
export async function searchEquipmentHandler(
  params: { query: string },
  backendClient: BackendClient,
) {
  try {
    const equipments = await backendClient.searchEquipment(params.query);

    if (equipments.length === 0) {
      return {
        success: false,
        message: `No equipment found with the term "${params.query}"`,
        equipments: [],
      };
    }

    return {
      success: true,
      message: `Found ${equipments.length} equipment(s) matching "${params.query}"`,
      equipments: equipments.map((eq: any) => ({
        id: eq.id,
        name: eq.name,
        model: eq.model,
        status: eq.status,
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Error al buscar equipos',
      error: error.message,
    };
  }
}