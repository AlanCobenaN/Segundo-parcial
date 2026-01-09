import { Injectable } from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';
import { CreateRepairOrderDto } from '../repair-orders/dto/create-repair-order.dto';

interface SagaResult {
  success: boolean;
  orderId: string;
}

@Injectable()
export class TemporalClient {
  private client: Client | undefined;

  async init(): Promise<Client> {
    if (!this.client) {
      const connection = await Connection.connect({ address: 'localhost:7233' });
      this.client = new Client({ connection });
    }
    return this.client;
  }

  async startSaga(input: CreateRepairOrderDto): Promise<SagaResult> {
    const client = await this.init();
    const handle = await client.workflow.start('createRepairOrderSaga', {
      taskQueue: 'repair-orders',
      args: [input],
      workflowId: `order-${Date.now()}`,
    });
    
    try {
      return (await handle.result()) as SagaResult;
    } catch (error) {
      // Extraer mensaje de error de Temporal
      const errorMessage = error instanceof Error ? error.message : 'Unknown saga error';
      
      // Si es un error de disponibilidad, ser más específico
      if (errorMessage.includes('Equipment not available')) {
        throw new Error('El equipo no está disponible para crear una orden (puede estar en reparación)');
      }
      
      throw new Error(`Error en saga: ${errorMessage}`);
    }
  }
}
