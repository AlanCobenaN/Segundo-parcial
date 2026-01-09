import { BackendClient } from '../services/backend-client';
import { McpTool } from '../types/jsonrpc.types';

export const validateAvailabilityTool: McpTool = {
  name: 'validate_availability',
  description: 'Validates if a piece of equipment is available for creating a repair order. Checks the current status of the equipment.',
  inputSchema: {
    type: 'object',
    properties: {
      equipmentId: {
        type: 'string',
        description: 'ID of the equipment to validate availability for repair order creation.',
      },
    },
    required: ['equipmentId'],
  },
};

export async function validateAvailabilityHandler(
  params: { equipmentId: string },
  backendClient: BackendClient,
) {
  console.log(`✅ Validando disponibilidad del equipo: ${params.equipmentId}`);

  try {
    const equipment = await backendClient.getEquipmentById(params.equipmentId);

    if (!equipment) {
      return {
        success: false,
        available: false,
        message: `Equipment with ID "${params.equipmentId}" not found. Please verify the ID.`,
        equipmentId: params.equipmentId,
      };
    }

    // Validar según el estado
    const statusRules: Record<string, { available: boolean; message: string }> = {
      AVAILABLE: {
        available: true,
        message: 'Equipment available for repair order creation.',
      },
      IN_REPAIR: {
        available: false,
        message: 'The equipment is already under repair. A new order cannot be created.',
      },
      RETIRED: {
        available: false,
        message: 'The equipment is retired. Repair orders cannot be created.',
      },
    };

    const validation = statusRules[equipment.status] || {
      available: false,
      message: `Equipment status not recognized: ${equipment.status}`,
    };

    return {
      success: true,
      available: validation.available,
      message: validation.message,
      equipment: {
        id: equipment.id,
        name: equipment.name,
        status: equipment.status,
        model: equipment.model,
        brand: equipment.brand,
      },
    };
  } catch (error: any) {
    console.error(`❌ Error validating availability:`, error.message);
    return {
      success: false,
      available: false,
      message: 'Error validating equipment availability',
      error: error.message,
    };
  }
}