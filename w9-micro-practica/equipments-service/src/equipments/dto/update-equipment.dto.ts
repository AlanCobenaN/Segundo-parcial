import { PartialType } from '@nestjs/mapped-types';
import { CreateEquipmentDto } from './create-equipment.dto';
import { EquipmentStatus } from '../entities/equipment.entity';

export class UpdateEquipmentDto extends PartialType(CreateEquipmentDto) {
    status?: EquipmentStatus;
}
