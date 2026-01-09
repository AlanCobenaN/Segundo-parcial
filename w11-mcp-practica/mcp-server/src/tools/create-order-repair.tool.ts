import { BackendClient } from '../services/backend-client';
import { McpTool } from '../types/jsonrpc.types';

export const createRepairOrderTool: McpTool = {
  name: 'create_repair_order',
  description: 'Creates a repair order for a specified equipment. Updates the equipment status to "IN_REPAIR".',
  inputSchema: {
    type: 'object',
    properties: {
      equipmentId: {
        type: 'string',
        description: 'ID of the equipment to repair',
      },
      problemDescription: {
        type: 'string',
        description: 'Description of the problem or necessary repair',
      },
      technicianId: {
        type: 'string',
        description: 'ID of the technician who will perform the repair',
      },
    },
    required: ['equipmentId', 'problemDescription', 'technicianId'],
  },
};

export async function createRepairOrderHandler(
  params: {
    equipmentId: string;
    problemDescription: string;
    technicianId: string;
  },
  backendClient: BackendClient,
) {
  console.log(`📝 Creando orden de reparación para equipo: ${params.equipmentId}`);

  try {
    // Paso 1: Verificar que el equipo existe
    const equipment = await backendClient.getEquipmentById(params.equipmentId);
    
    if (!equipment) {
      return {
        success: false,
        message: 'Equipo no encontrado',
      };
    }

    // Paso 2: Crear la orden de reparación
    const repairOrder = await backendClient.createRepairOrder({
      equipmentId: params.equipmentId,
      problemDescription: params.problemDescription,
      technicianId: params.technicianId,
    });

    // Paso 3: Actualizar el estado del equipo a IN_REPAIR
    await backendClient.updateEquipmentStatus(params.equipmentId, 'IN_REPAIR');

    return {
      success: true,
      message: `✅ Orden de reparación creada exitosamente para ${equipment.name}`,
      repairOrder: {
        id: repairOrder.id,
        equipmentId: repairOrder.equipmentId,
        problemDescription: repairOrder.problemDescription,
        status: repairOrder.status,
        createdAt: repairOrder.createdAt,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Error al crear la orden de reparación',
      error: error.message,
    };
  }
}