import { PartialType } from '@nestjs/mapped-types';
import { CreateRepairOrderDto } from './create-repair-order.dto';

export class UpdateRepairOrderDto extends PartialType(CreateRepairOrderDto) {
  diagnosis?: string;
  estimatedCost?: number;
}
