import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EquipmentsService } from './equipments.service';

@Injectable()
export class EquipmentSeedService implements OnModuleInit {
  private readonly logger = new Logger('EquipmentsSeed');

  constructor(
    private readonly equipmentsService: EquipmentsService,
  ) {}

  async onModuleInit() {
    await this.seedEquipments();
  }

  async seedEquipments() {
    const existingEquipments = await this.equipmentsService.findAll();

    if (existingEquipments.length > 0) {
      this.logger.log('🖥️ Base de datos ya tiene equipos, saltando seed');
      return;
    }

    this.logger.log('🖥️ Poblando base de datos con equipos de ejemplo...');

    const equipmentsToCreate = [
      {
        name: 'Laptop de oficina',
        brand: 'Dell',
        model: 'Latitude 5420',
        serialNumber: 'DL-5420-001',
      },
      {
        name: 'Laptop gamer',
        brand: 'HP',
        model: 'Omen 15',
        serialNumber: 'HP-OMN-945',
      },
      {
        name: 'PC de escritorio',
        brand: 'Lenovo',
        model: 'ThinkCentre M70t',
        serialNumber: 'LN-M70-128',
      },
      {
        name: 'Impresora',
        brand: 'Epson',
        model: 'L3150',
        serialNumber: 'EP-L3150-77',
      },
      {
        name: 'Tablet',
        brand: 'Samsung',
        model: 'Galaxy Tab S8',
        serialNumber: 'SM-TAB-888',
      },
      {
        name: 'Servidor',
        brand: 'HP',
        model: 'ProLiant DL380',
        serialNumber: 'HP-DL380-001',
      },
      {
        name: 'Router',
        brand: 'TP-Link',
        model: 'Archer C6',
        serialNumber: 'TP-AC6-333',
      },
      {
        name: 'Monitor',
        brand: 'LG',
        model: '24MK600',
        serialNumber: 'LG-24MK600-555',
      },
    ];

    for (const equipmentData of equipmentsToCreate) {
      try {
        const equipment = await this.equipmentsService.create(equipmentData);
        this.logger.log(
          `  ✅ Creado: ${equipment.name} - ${equipment.brand} (${equipment.id})`
        );
      } catch (error) {
         const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `  ❌ Error creando ${equipmentData.name}: ${message}`,
        );
      }
    }

    this.logger.log('🖥️ Seed de equipos completado');
  }
}
