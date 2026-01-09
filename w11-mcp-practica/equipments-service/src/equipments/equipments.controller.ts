import { Controller, Logger } from '@nestjs/common';
import { EquipmentsService } from './equipments.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { RmqContext } from '@nestjs/microservices/ctx-host/rmq.context';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { EquipmentStatus } from './entities/equipment.entity';

@Controller('equipments')
export class EquipmentsController {
  private readonly logger = new Logger(EquipmentsController.name);
  constructor(private readonly equipmentsService: EquipmentsService) {}

  private acknowledgeMessage(context: RmqContext): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    channel.ack(originalMsg);
  }

  @MessagePattern('equipment.create')
  async create(
    @Payload() data: CreateEquipmentDto,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(`[equipment.create] Creando equipo: ${data.name}`);

    try {
      const equipment = await this.equipmentsService.create(data);
      this.acknowledgeMessage(context);
      return { success: true, data: equipment };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  @MessagePattern('equipment.find.all')
  async findAll(@Ctx() context: RmqContext) {
    this.logger.log('[equipment.find.all] Solicitud recibida');
    try {
      const equipments = await this.equipmentsService.findAll();
      this.acknowledgeMessage(context);
      return { success: true, data: equipments };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
  
  @MessagePattern('equipment.find.available')
  async findAvailable(@Ctx() context: RmqContext) {
    this.logger.log('[equipment.find.available] Solicitud recibida');
    try {
      const equipments = await this.equipmentsService.findAvailable();
      this.acknowledgeMessage(context);
      return { success: true, data: equipments };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  @MessagePattern('equipment.find.one')
  async findOne(@Payload() data: { id: string }, @Ctx() context: RmqContext) {
    this.logger.log(`[equipment.find.one] Buscando equipo: ${data.id}`);

    try {
      const equipment = await this.equipmentsService.findOne(data.id);
      this.acknowledgeMessage(context);

      if (!equipment) {
        this.logger.warn(`📨 [equipment.find.one] Equipo no encontradooo: ${data.id}`);
        return { success: false, error: 'Equipment not found' };
      }
      return { success: true, data: equipment };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  @MessagePattern('equipment.search')
  async search(@Payload() data: { query: string }, @Ctx() context: RmqContext) {
    this.logger.log(`[equipment.search] Buscando equipos con: "${data.query}"`);

    try {
      const equipments = await this.equipmentsService.search(data.query);
      this.acknowledgeMessage(context);

      if (equipments.length === 0) {
        this.logger.warn(`📨 [equipment.search] No se encontraron equipos con: "${data.query}"`);
        return { success: false, error: 'No equipment found' };
      }
      
      return { success: true, data: equipments };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  @MessagePattern('equipment.update.status')
  async updateStatus(
    @Payload() data: { id: string; status: EquipmentStatus },
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[equipment.update.status] Actualizando estado del equipo: ${data.id} a ${data.status}`,
    );
    try {
      const equipment = await this.equipmentsService.updateStatus(
        data.id,
        data.status,
      );
      this.acknowledgeMessage(context);
      if (!equipment) {
        this.logger.warn(`⚠️ [equipment.update.status] Equipo no encontrado: ${data.id}`);
        return { success: false, error: 'Equipment not found' };
      }
      return { success: true, data: equipment };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  @MessagePattern('equipment.check.availability')
  async checkAvailability(
    @Payload() data: { equipmentId: string },
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(
      `[equipment.check.availability] Verificando: ${data.equipmentId}`,
    );

    try {
      const equipment = await this.equipmentsService.findOne(data.equipmentId);
      this.acknowledgeMessage(context);

      if (!equipment) {
        return {
          success: false,
          available: false,
          error: 'Equipment not found',
        };
      }

      return {
        success: true,
        available: equipment.status === 'AVAILABLE',
        equipment,
      };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, available: false, error: message };
    }
  }

  @EventPattern('equipment.order.requested')
  async handleRepairRequested(
    @Payload() data: { equipmentId: string; orderId?: string },
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(`[equipment.order.requested] Equipo: ${data.equipmentId}`);

    try {
      const equipment = await this.equipmentsService.markAsInRepair(data.equipmentId);
      this.acknowledgeMessage(context);
      if (equipment) {
        this.logger.log(`✅ [equipment.order.requested] Equipo ${data.equipmentId} marcado como en reparación`);
      } else {
        this.logger.warn(`⚠️ [equipment.order.requested] Equipo ${data.equipmentId} no encontrado`);
      }
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error: ${message}`);
    }
  }

  @EventPattern('equipment.order.finished')
  async handleRepairFinished(
    @Payload() data: { equipmentId: string; orderId?: string },
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(`[equipment.order.finished] Equipo: ${data.equipmentId}`);
    
    try {
      const equipment = await this.equipmentsService.markAsAvailable(data.equipmentId);
      this.acknowledgeMessage(context);
      if (equipment) {
        this.logger.log(`✅ [equipment.order.finished] Equipo ${data.equipmentId} marcado como disponible`);
      } else {
        this.logger.warn(`⚠️ [equipment.order.finished] Equipo ${data.equipmentId} no encontrado`);
      }
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error: ${message}`);
    }
  }
}
