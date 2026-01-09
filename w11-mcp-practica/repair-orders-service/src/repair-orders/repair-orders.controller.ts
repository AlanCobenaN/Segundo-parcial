import { Controller, Inject, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  ClientProxy,
} from '@nestjs/microservices';
import { RmqContext } from '@nestjs/microservices/ctx-host/rmq.context';
import { RepairOrdersService } from './repair-orders.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { TemporalClient } from '../temporal/client';
import { RepairOrder } from './entities/repair-order.entity';

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

@Controller('repair-orders')
export class RepairOrdersController {
  private readonly logger = new Logger(RepairOrdersController.name);

  constructor(
    private readonly repairOrdersService: RepairOrdersService,
    @Inject(TemporalClient) private temporal: TemporalClient,
    @Inject('EQUIPMENTS_SERVICE') private readonly equipClient: ClientProxy,
  ) {}

  private acknowledgeMessage(context: RmqContext): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    channel.ack(originalMsg);
  }

  // @MessagePattern('repair_order.create')
  // async create(
  //   @Payload() dto: CreateRepairOrderDto,
  //   @Ctx() context: RmqContext,
  // ): Promise<ServiceResponse<RepairOrder>> {
  //   this.logger.log(`[repair_order.create] Iniciando SAGA para equipo: ${dto.equipmentId}`);

  //   try {
  //     const result = await this.temporal.startSaga(dto);
  //     const order = await this.repairOrdersService.findOne(result.orderId);
  //     this.acknowledgeMessage(context);
  //     return { success: true, data: order };
  //   } catch (error) {
  //     this.acknowledgeMessage(context);
  //     const message = error instanceof Error ? error.message : 'Saga failed';
  //     this.logger.error(`[repair_order.create] Error: ${message}`);
  //     return { success: false, error: message };
  //   }
  // }

  @MessagePattern('repair_order.create')
  async create(
    @Payload() dto: CreateRepairOrderDto,
    @Ctx() context: RmqContext,
  ): Promise<ServiceResponse<RepairOrder>> {
    this.logger.log(
      `[repair_order.create] Creando orden de reparación para equipo: ${dto.equipmentId}`,
    );
    try {
      const order = await this.repairOrdersService.create(dto);
      this.acknowledgeMessage(context);
      return { success: true, data: order };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message =
        error instanceof Error ? error.message : 'Creation failed';
      return { success: false, error: message };
    }
  }

  @MessagePattern('repair_order.find.all')
  async findAll(
    @Ctx() context: RmqContext,
  ): Promise<ServiceResponse<RepairOrder[]>> {
    this.logger.log('[repair_order.find.all] Solicitud recibida');

    try {
      const orders = await this.repairOrdersService.findAll();
      this.acknowledgeMessage(context);
      return { success: true, data: orders };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  @MessagePattern('repair_order.find.active')
  async findActive(
    @Ctx() context: RmqContext,
  ): Promise<ServiceResponse<RepairOrder[]>> {
    this.logger.log('[repair_order.find.active] Solicitud recibida');

    try {
      const orders = await this.repairOrdersService.findActive();
      this.acknowledgeMessage(context);
      return { success: true, data: orders };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  @MessagePattern('repair_order.find.failed')
  async findFailed(
    @Ctx() context: RmqContext,
  ): Promise<ServiceResponse<RepairOrder[]>> {
    this.logger.log('[repair_order.find.failed] Solicitud recibida');

    try {
      const orders = await this.repairOrdersService.findFailed();
      this.acknowledgeMessage(context);
      return { success: true, data: orders };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  @MessagePattern('repair_order.find.one')
  async findOne(
    @Payload() data: { id: string },
    @Ctx() context: RmqContext,
  ): Promise<ServiceResponse<RepairOrder>> {
    this.logger.log(`[repair_order.find.one] ID: ${data.id}`);

    try {
      const order = await this.repairOrdersService.findOne(data.id);
      this.acknowledgeMessage(context);
      return { success: true, data: order };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message =
        error instanceof Error ? error.message : 'Order not found';
      return { success: false, error: message };
    }
  }

  @MessagePattern('repair_order.update')
  async update(
    @Payload() payload: { id: string; dto: UpdateRepairOrderDto },
    @Ctx() context: RmqContext,
  ): Promise<ServiceResponse<RepairOrder>> {
    this.logger.log(`[repair_order.update] ID: ${payload.id}`);

    try {
      const order = await this.repairOrdersService.update(
        payload.id,
        payload.dto,
      );
      this.acknowledgeMessage(context);
      return { success: true, data: order };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Update failed';
      return { success: false, error: message };
    }
  }

  @MessagePattern('repair_order.finish')
  async finishOrder(
    @Payload() data: { id: string },
    @Ctx() context: RmqContext,
  ): Promise<ServiceResponse<RepairOrder>> {
    this.logger.log(`[repair_order.finish] ID: ${data.id}`);

    try {
      const order = await this.repairOrdersService.confirmRepair(data.id);

      // Liberar equipo y marcarlo como disponible
      this.logger.log(
        `[repair_order.finish] Liberando equipo: ${order.equipmentId}`,
      );
      this.equipClient.emit('equipment.order.finished', {
        equipmentId: order.equipmentId,
      });

      this.acknowledgeMessage(context);
      return { success: true, data: order };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Finish failed';
      return { success: false, error: message };
    }
  }

  @MessagePattern('repair_order.delete')
  async remove(
    @Payload() payload: { id: string },
    @Ctx() context: RmqContext,
  ): Promise<ServiceResponse<void>> {
    this.logger.log(`[repair_order.delete] ID: ${payload.id}`);

    try {
      await this.repairOrdersService.remove(payload.id);
      this.acknowledgeMessage(context);
      return { success: true };
    } catch (error) {
      this.acknowledgeMessage(context);
      const message = error instanceof Error ? error.message : 'Delete failed';
      return { success: false, error: message };
    }
  }
}
