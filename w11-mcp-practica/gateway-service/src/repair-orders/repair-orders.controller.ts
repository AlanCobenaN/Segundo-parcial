import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Logger,
  HttpException,
  HttpStatus,
  Inject,
  Patch,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { GeminiService } from 'src/gemini/gemini.service';

type OrderRepairStatus = 'PENDING' | 'IN_REVIEW' | 'IN_REPAIR' | 'DELIVERED' | 'FAILED';

interface RepairOrder {
  id: string;
  equipmentId: string;
  technicianId: string;
  problemDescription: string;
  diagnosis?: string;
  estimatedCost?: number;
  status: OrderRepairStatus;
  failureReason: string | null;
  createdAt: Date;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

@Controller('repair-orders')
export class RepairOrdersController {
  private readonly logger = new Logger('RepairOrdersProxy');

  constructor(
    @Inject('REPAIR_ORDERS_SERVICE') private readonly repairOrdersClient: ClientProxy,
    private readonly geminiService: GeminiService
  ) {}

  @Post('ai-request')
  async handleAiRequest(@Body() body: { prompt: string }) {
    this.logger.log(`Received AI request: ${body.prompt}`);

    try {
      const response = await this.geminiService.processRequest(body.prompt);
      
      return {
        success: true,
        response,
      };
    } catch (error: any) {
      this.logger.error(`Error processing request: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * GET /api/repair-orders - Listar todas las órdenes de reparación
   */
  @Get()
  async findAll(): Promise<ServiceResponse<RepairOrder[]>> {
    this.logger.log('📖 GET /api/repair-orders → repair-orders-service [repair_order.find.all]');
    
    try {
      const response = await firstValueFrom(
        this.repairOrdersClient.send<ServiceResponse<RepairOrder[]>>('repair_order.find.all', {}).pipe(
          timeout(5000),
          catchError(() => {
            throw new HttpException(
              'repair-orders-service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
      );

      if (!response.success) {
        throw new HttpException(response.error || 'Error desconocido', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/repair-orders/active - Listar órdenes activas (IN_REVIEW, IN_REPAIR)
   */
  @Get('active')
  async findActive(): Promise<ServiceResponse<RepairOrder[]>> {
    this.logger.log('📖 GET /api/repair-orders/active → repair-orders-service [repair_order.find.active]');
    
    try {
      const response = await firstValueFrom(
        this.repairOrdersClient.send<ServiceResponse<RepairOrder[]>>('repair_order.find.active', {}).pipe(
          timeout(5000),
          catchError(() => {
            throw new HttpException(
              'repair-orders-service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
      );

      if (!response.success) {
        throw new HttpException(response.error || 'Error desconocido', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/repair-orders/:id - Obtener una orden por ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ServiceResponse<RepairOrder>> {
    this.logger.log(`📖 GET /api/repair-orders/${id} → repair-orders-service [repair_order.find.one]`);
    
    try {
      const response = await firstValueFrom(
        this.repairOrdersClient.send<ServiceResponse<RepairOrder>>('repair_order.find.one', { id }).pipe(
          timeout(5000),
          catchError(() => {
            throw new HttpException(
              'repair-orders-service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
      );

      if (!response.success) {
        throw new HttpException(response.error || 'Orden no encontrada', HttpStatus.NOT_FOUND);
      }

      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/repair-orders - Crear orden con SAGA orquestada (Temporal)
   */
  @Post()
  async create(@Body() dto: CreateRepairOrderDto): Promise<ServiceResponse<RepairOrder>> {
    this.logger.log('🎭 POST /api/repair-orders → repair-orders-service [repair_order.create]');
    this.logger.log(`📖 Equipo: ${dto.equipmentId}, Técnico: ${dto.technicianId}`);
    
    try {
      const response = await firstValueFrom(
        this.repairOrdersClient.send<ServiceResponse<RepairOrder>>('repair_order.create', dto).pipe(
          timeout(15000), // Más tiempo para la saga completa
          catchError(() => {
            throw new HttpException(
              'repair-orders-service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
      );

      if (!response.success) {
        this.logger.error(`❌ Error en saga: ${response.error}`);
        throw new HttpException(response.error || 'Error en saga', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`✅ Orden creada: ${response.data?.id}`);
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * PUT /api/repair-orders/:id - Actualizar orden
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRepairOrderDto,
  ): Promise<ServiceResponse<RepairOrder>> {
    this.logger.log(`🔧 PATCH /api/repair-orders/${id} → repair-orders-service [repair_order.update]`);
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = { id, dto: updateDto };
      const response = await firstValueFrom(
        this.repairOrdersClient.send<ServiceResponse<RepairOrder>>('repair_order.update', payload).pipe(
          timeout(5000),
          catchError(() => {
            throw new HttpException(
              'repair-orders-service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
      );

      if (!response.success) {
        throw new HttpException(response.error || 'Error actualizando orden', HttpStatus.BAD_REQUEST);
      }

      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * PATCH /api/repair-orders/:id/finish - Finalizar reparación
   */
  @Patch(':id/finish')
  async finishOrder(@Param('id') id: string): Promise<ServiceResponse<RepairOrder>> {
    this.logger.log(`📖 PATCH /api/repair-orders/${id}/finish → repair-orders-service [repair_order.finish]`);
    
    try {
      const response = await firstValueFrom(
        this.repairOrdersClient.send<ServiceResponse<RepairOrder>>('repair_order.finish', { id }).pipe(
          timeout(5000),
          catchError(() => {
            throw new HttpException(
              'repair-orders-service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
      );

      if (!response.success) {
        throw new HttpException(response.error || 'Error finalizando orden', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`✅ Orden finalizada correctamente`);
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * DELETE /api/repair-orders/:id - Eliminar orden
   */
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ServiceResponse<void>> {
    this.logger.log(`🗑️ DELETE /api/repair-orders/${id} → repair-orders-service [repair_order.delete]`);
    
    try {
      const response = await firstValueFrom(
        this.repairOrdersClient.send<ServiceResponse<void>>('repair_order.delete', { id }).pipe(
          timeout(5000),
          catchError(() => {
            throw new HttpException(
              'repair-orders-service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
      );

      if (!response.success) {
        throw new HttpException(response.error || 'Error eliminando orden', HttpStatus.BAD_REQUEST);
      }

      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}