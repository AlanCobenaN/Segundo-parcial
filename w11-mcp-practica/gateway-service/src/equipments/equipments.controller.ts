import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  Logger,
  HttpException,
  HttpStatus,
  Patch,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { CreateEquipmentDto } from './dto/create-equipment.dto';

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface Equipment {
  id: string;
  name: string;
  brand: string;
  model: string;
  status: string;
  serialNumber?: string;
}

type OrderRepairStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'IN_REPAIR'
  | 'DELIVERED'
  | 'FAILED';

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

interface EquipmentWithOrders extends Equipment {
  repairOrders: RepairOrder[];
}

@Controller('equipments')
export class EquipmentsController {
  private readonly logger = new Logger('EquipmentsProxy');

  constructor(
    @Inject('EQUIPMENTS_SERVICE')
    private readonly equipmentsClient: ClientProxy,
    @Inject('REPAIR_ORDERS_SERVICE')
    private readonly repairOrdersClient: ClientProxy,
  ) {}

  /**
   * GET /api/equipments - Listar todos los equipos
   */
  @Get()
  async findAll(): Promise<ServiceResponse<Equipment[]>> {
    this.logger.log(
      '📚 GET /api/equipments → equipments-service [equipment.find.all]',
    );

    try {
      const response = await firstValueFrom(
        this.equipmentsClient
          .send<ServiceResponse<Equipment[]>>('equipment.find.all', {})
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new HttpException(
                'equipments-service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );

      if (!response.success) {
        throw new HttpException(
          response.error || 'Error',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`📚 Respuesta: ${response.data?.length || 0} equipos`);
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ): Promise<ServiceResponse<Equipment>> {
    this.logger.log(
      `🔄 PATCH /api/equipments/${id} → equipments-service [equipment.update.status]`,
    );
    try {
      const response = await firstValueFrom(
        this.equipmentsClient
          .send<
            ServiceResponse<Equipment>
          >('equipment.update.status', { id, status })
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new HttpException(
                'equipments-service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );
      if (!response.success) {
        throw new HttpException(
          response.error || 'Error',
          HttpStatus.BAD_REQUEST,
        );
      }
      this.logger.log(`✅ Estado del equipo ${id} actualizado a ${status}`);
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/equipments/available - Listar equipos disponibles
   */
  @Get('available')
  async findAvailable(): Promise<ServiceResponse<Equipment[]>> {
    this.logger.log(
      '📚 GET /api/equipments/available → equipments-service [equipment.find.available]',
    );

    try {
      const response = await firstValueFrom(
        this.equipmentsClient
          .send<ServiceResponse<Equipment[]>>('equipment.find.available', {})
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new HttpException(
                'equipments-service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );

      if (!response.success) {
        throw new HttpException(
          response.error || 'Error',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `📚 Respuesta: ${response.data?.length || 0} equipos disponibles`,
      );
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/equipments/search - Buscar equipos por nombre, marca o modelo
   */
  @Get('search')
  async search(@Query('q') query: string): Promise<ServiceResponse<Equipment[]>> {
    this.logger.log(
      `📚 GET /api/equipments/search?q=${query} → equipments-service [equipment.search]`,
    );

    if (!query || query.trim() === '') {
      throw new HttpException(
        'El parámetro "q" es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }
    
    try {
      const response = await firstValueFrom(
        this.equipmentsClient
          .send<ServiceResponse<Equipment[]>>('equipment.search', { query })
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new HttpException(
                'equipments-service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );
      
      if (!response.success) {
        throw new HttpException(
          response.error || 'No se encontraron equipos',
          HttpStatus.NOT_FOUND,
        );
      }
      
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/equipments/:id - Obtener un equipo por ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ServiceResponse<Equipment>> {
    this.logger.log(
      `📚 GET /api/equipments/${id} → equipments-service [equipment.find.one]`,
    );

    try {
      const response = await firstValueFrom(
        this.equipmentsClient
          .send<ServiceResponse<Equipment>>('equipment.find.one', { id })
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new HttpException(
                'equipments-service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );

      if (!response.success) {
        throw new HttpException(
          response.error || 'Equipo no encontrado',
          HttpStatus.NOT_FOUND,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/equipments - Crear un nuevo equipo
   */
  @Post()
  async create(
    @Body() createEquipmentDto: CreateEquipmentDto,
  ): Promise<ServiceResponse<Equipment>> {
    this.logger.log(
      `📚 POST /api/equipments → equipments-service [equipment.create]`,
    );
    this.logger.log(`📚 Equipo: ${createEquipmentDto.name}`);

    try {
      const response = await firstValueFrom(
        this.equipmentsClient
          .send<
            ServiceResponse<Equipment>
          >('equipment.create', createEquipmentDto)
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new HttpException(
                'equipments-service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );

      if (!response.success) {
        throw new HttpException(
          response.error || 'Error',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`📚 Equipo creado: ${response.data?.id}`);
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/equipments/:id/repair-orders - Obtener equipo con todas sus órdenes de reparación
   */
  @Get(':id/repair-orders')
  async getEquipmentWithOrders(
    @Param('id') id: string,
  ): Promise<ServiceResponse<EquipmentWithOrders>> {
    this.logger.log(
      `🔍 GET /api/equipments/${id}/repair-orders → Combinando datos de ambos servicios`,
    );

    try {
      // 1. Obtener el equipo
      this.logger.log(`📡 Consultando equipo: ${id}`);
      const equipmentResponse = await firstValueFrom(
        this.equipmentsClient
          .send<ServiceResponse<Equipment>>('equipment.find.one', { id })
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new HttpException(
                'equipments-service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );

      if (!equipmentResponse.success || !equipmentResponse.data) {
        throw new HttpException('Equipo no encontrado', HttpStatus.NOT_FOUND);
      }

      // 2. Obtener todas las órdenes de reparación
      this.logger.log(`📡 Consultando órdenes de reparación`);
      const ordersResponse = await firstValueFrom(
        this.repairOrdersClient
          .send<ServiceResponse<RepairOrder[]>>('repair_order.find.all', {})
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new HttpException(
                'repair-orders-service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }),
          ),
      );

      if (!ordersResponse.success) {
        throw new HttpException(
          'Error al obtener órdenes',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 3. Filtrar órdenes por equipmentId
      const equipmentOrders = (ordersResponse.data || []).filter(
        (order) => order.equipmentId === id,
      );

      // 4. Combinar datos
      const combinedData: EquipmentWithOrders = {
        ...equipmentResponse.data,
        repairOrders: equipmentOrders,
      };

      this.logger.log(
        `✅ Equipo encontrado con ${equipmentOrders.length} órdenes de reparación`,
      );

      return {
        success: true,
        data: combinedData,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Error interno';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
