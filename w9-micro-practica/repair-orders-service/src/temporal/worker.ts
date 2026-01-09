import { Worker, NativeConnection } from '@temporalio/worker';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { RepairOrdersService } from '../repair-orders/repair-orders.service';
import { CreateRepairOrderDto } from '../repair-orders/dto/create-repair-order.dto';

interface EquipmentCheckResult {
  success: boolean;
  available: boolean;
  equipment?: any;
  error?: string;
}

@Injectable()
export class TemporalWorker implements OnModuleInit {
  private readonly logger = new Logger(TemporalWorker.name);

  constructor(
    @Inject('EQUIPMENTS_SERVICE') private equipClient: ClientProxy,
    private repairService: RepairOrdersService,
  ) {}

  async onModuleInit() {
    try {
      const connection = await NativeConnection.connect({
        address: 'localhost:7233',
      });

      const worker = await Worker.create({
        connection,
        namespace: 'default',
        taskQueue: 'repair-orders',
        workflowsPath: require.resolve('./workflow'),
        activities: {
          checkEquipment: async (equipmentId: string): Promise<void> => {
            this.logger.log('🔍 PASO 1/3: Verificando disponibilidad del equipo...');
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos de delay
            
            const result = await firstValueFrom(
              this.equipClient.send<EquipmentCheckResult>('equipment.check.availability', { equipmentId }),
            );
            if (!result.available) {
              this.logger.warn('❌ Equipo NO disponible');
              throw new Error('Equipment not available');
            }
            this.logger.log('✅ PASO 1/3 COMPLETADO: Equipo disponible');
          },

          reserveEquipment: async (equipmentId: string): Promise<void> => {
            this.logger.log('🔒 PASO 2/3: Reservando equipo...');
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos de delay
            
            this.equipClient.emit('equipment.order.requested', { equipmentId });
            await new Promise(resolve => setTimeout(resolve, 100));
            this.logger.log('✅ PASO 2/3 COMPLETADO: Equipo reservado (IN_REPAIR)');
          },

          createOrder: async (input: CreateRepairOrderDto) => {
            this.logger.log('💾 PASO 3/3: Creando orden en base de datos...');
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos de delay
            
            const order = await this.repairService.create(input, 'IN_REVIEW');
            this.logger.log(`✅ PASO 3/3 COMPLETADO: Orden ${order.id} creada`);
            return order;
          },

          releaseEquipment: async (equipmentId: string): Promise<void> => {
            this.logger.warn('🔄 COMPENSACIÓN: Liberando equipo...');
            this.equipClient.emit('equipment.order.finished', { equipmentId });
            await new Promise(resolve => setTimeout(resolve, 100));
            this.logger.log('✅ COMPENSACIÓN: Equipo liberado (AVAILABLE)');
          },

          cancelOrder: async (orderId: string): Promise<void> => {
            this.logger.warn('🔄 COMPENSACIÓN: Cancelando orden...');
            await this.repairService.updateStatus(orderId, 'FAILED', 'Saga rollback');
            this.logger.log('✅ COMPENSACIÓN: Orden marcada como FAILED');
          },
        },
      });

      void worker.run();
      this.logger.log('✅ Temporal Worker started');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`⚠️ Temporal not available: ${message}`);
    }
  }
}
