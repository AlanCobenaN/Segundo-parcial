import { Injectable, Logger } from '@nestjs/common';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Equipment, EquipmentStatus } from './entities/equipment.entity';
import { Repository } from 'typeorm';

@Injectable()
export class EquipmentsService {
  private readonly logger = new Logger(EquipmentsService.name);

  constructor(
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
  ) {}
  
  async create(createEquipmentDto: CreateEquipmentDto): Promise<Equipment> {
    this.logger.log(`Creating a new equipment ${createEquipmentDto.name}`);
    const equipment = this.equipmentRepository.create(createEquipmentDto);
    return await this.equipmentRepository.save(equipment);
  }

  async findAll(): Promise<Equipment[]> {
    return await this.equipmentRepository.find({order: { createdAt: 'DESC' }});
  }

  async findAvailable(): Promise<Equipment[]> {
    return await this.equipmentRepository.find({ where: { status: 'AVAILABLE' }, order: { createdAt: 'DESC' } });
  }

  async search(query: string): Promise<Equipment[]> {
    this.logger.log(`Searching for equipment with query: "${query}"`);
    
    // Búsqueda case-insensitive por nombre, marca o modelo
    const equipments = await this.equipmentRepository
      .createQueryBuilder('equipment')
      .where('LOWER(equipment.name) LIKE LOWER(:query)', { query: `%${query}%` })
      .orWhere('LOWER(equipment.brand) LIKE LOWER(:query)', { query: `%${query}%` })
      .orWhere('LOWER(equipment.model) LIKE LOWER(:query)', { query: `%${query}%` })
      .orderBy('equipment.createdAt', 'DESC')
      .getMany();
    
    this.logger.log(`Found ${equipments.length} equipment(s) matching "${query}"`);
    return equipments;
  }

  async findOne(id: string): Promise<Equipment | null> {
    return await  this.equipmentRepository.findOne({ where: { id } });
  }

  async updateStatus(id: string, status: EquipmentStatus): Promise<Equipment | null> {
    const equipment = await this.findOne(id);
    if (!equipment) return null;
    equipment.status = status;
    return await this.equipmentRepository.save(equipment);
  }

  async markAsInRepair(id: string): Promise<Equipment | null> {
    return await this.updateStatus(id, 'IN_REPAIR');
  }

  async markAsRetired(id: string): Promise<Equipment | null> {
    return await this.updateStatus(id, 'RETIRED');
  }

  async markAsAvailable(id: string): Promise<Equipment | null> {
    return await this.updateStatus(id, 'AVAILABLE');
  }
}
