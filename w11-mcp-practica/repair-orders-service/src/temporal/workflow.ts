import { proxyActivities } from '@temporalio/workflow';

interface Activities {
  checkEquipment(equipmentId: string): Promise<void>;
  reserveEquipment(equipmentId: string): Promise<void>;
  createOrder(input: any): Promise<{ id: string }>;
  releaseEquipment(equipmentId: string): Promise<void>;
  cancelOrder(orderId: string): Promise<void>;
}

const { checkEquipment, reserveEquipment, createOrder, releaseEquipment, cancelOrder } =
  proxyActivities<Activities>({
    startToCloseTimeout: '10s',
    retry: {
      maximumAttempts: 4, // Solo 2 intentos total
      initialInterval: '1s',
      maximumInterval: '6s',
      backoffCoefficient: 2,
    },
  });

export async function createRepairOrderSaga(input: {
  equipmentId: string;
  technicianId: string;
  problemDescription: string;
}): Promise<{ success: boolean; orderId: string }> {
  let equipmentReserved = false;
  let orderId: string | null = null;

  try {
    // 1. Verificar disponibilidad
    await checkEquipment(input.equipmentId);

    // 2. Reservar equipo
    await reserveEquipment(input.equipmentId);
    equipmentReserved = true;

    // 3. Crear orden
    const order = await createOrder(input);
    orderId = order.id;

    return { success: true, orderId };
  } catch (error) {
    // Compensación
    if (orderId) {
      await cancelOrder(orderId);
    }
    if (equipmentReserved) {
      await releaseEquipment(input.equipmentId);
    }
    throw error;
  }
}
