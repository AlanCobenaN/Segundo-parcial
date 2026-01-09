import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderRepairStatus, RepairOrder } from './entities/repair-order.entity';
import { Repository } from 'typeorm';
import { WebhooksService } from '../webhooks/webhooks.service';
import { RepairOrderCompletedDataDto, RepairOrderCreatedDataDto } from '../webhooks/dto/webhook-payload.dto';

@Injectable()
export class RepairOrdersService {
  constructor(
    @InjectRepository(RepairOrder)
    private readonly repairOrderRepository: Repository<RepairOrder>,
    private readonly webhooksService: WebhooksService
  ) {}

  async create(
    dto: CreateRepairOrderDto,
    status: OrderRepairStatus = 'IN_REVIEW',
  ): Promise<RepairOrder> {
    const repairOrder = this.repairOrderRepository.create({
      ...dto,
      status,
    });

    // Guardar PRIMERO en la base de datos
    const savedOrder = await this.repairOrderRepository.save(repairOrder);

    // DESPUÉS enviar webhook (solo si se guardó exitosamente)
    const webhookData: RepairOrderCreatedDataDto = {
      order_id: savedOrder.id,
      equipment_id: savedOrder.equipmentId,
      technician_id: savedOrder.technicianId,
      issue_description: savedOrder.problemDescription,
      status: savedOrder.status,
      estimated_cost: savedOrder.estimatedCost,
      created_at: savedOrder.createdAt.toISOString(),
    };

    await this.webhooksService.publishWebhook<RepairOrderCreatedDataDto>(
      'repair_order.created',
      webhookData,
      {
        correlation_id: `order-${savedOrder.id}`,
      }
    );

    return savedOrder;
  }

  async createPending(dto: CreateRepairOrderDto): Promise<RepairOrder> {
    return await this.create(dto, 'PENDING');
  }

  async findAll(): Promise<RepairOrder[]> {
    return await this.repairOrderRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findActive(): Promise<RepairOrder[]> {
    return await this.repairOrderRepository.find({
      where: [
        { status: 'IN_REVIEW' },
        { status: 'IN_REPAIR' },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findPending(): Promise<RepairOrder[]> {
    return await this.repairOrderRepository.find({
      where: { status: 'PENDING' },
      order: { createdAt: 'DESC' },
    });
  }

  async findFailed(): Promise<RepairOrder[]> {
    return await this.repairOrderRepository.find({
      where: { status: 'FAILED' },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<RepairOrder> {
    const order = await this.repairOrderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Repair order with ID ${id} not found`);
    return order;
  }

  async update(id: string, dto: UpdateRepairOrderDto): Promise<RepairOrder> {
    const order = await this.findOne(id);
    Object.assign(order, dto);
    return await this.repairOrderRepository.save(order);
  }

  async updateStatus(id: string, status: OrderRepairStatus, failureReason?: string): Promise<RepairOrder> {
    const order = await this.findOne(id);
    order.status = status;
    if (failureReason) {
      order.failureReason = failureReason;
    }
    return await this.repairOrderRepository.save(order);
  }

  async confirmReview(id: string): Promise<RepairOrder> {
    return await this.updateStatus(id, 'IN_REPAIR');
  }

  async rejectRepair(id: string, failureReason: string): Promise<RepairOrder> {
    return await this.updateStatus(id, 'FAILED', failureReason);
  }

  async confirmRepair(id: string): Promise<RepairOrder> {
    // Actualizar PRIMERO el estado en la base de datos
    const updatedOrder = await this.updateStatus(id, 'DELIVERED');

    // DESPUÉS enviar webhook (solo si se actualizó exitosamente)
    const webhookData: RepairOrderCompletedDataDto = {
      order_id: updatedOrder.id,
      equipment_id: updatedOrder.equipmentId,
      technician_id: updatedOrder.technicianId,
      completed_at: new Date().toISOString(),
      status: updatedOrder.status,
    };

    await this.webhooksService.publishWebhook<RepairOrderCompletedDataDto>(
      'repair_order.completed',
      webhookData,
      {
        correlation_id: `order-${updatedOrder.id}`,
      }
    );

    return updatedOrder;
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    await this.repairOrderRepository.remove(order);
  }
}
