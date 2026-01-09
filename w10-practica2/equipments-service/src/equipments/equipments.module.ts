import { Module } from '@nestjs/common';
import { EquipmentsService } from './equipments.service';
import { EquipmentsController } from './equipments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from './entities/equipment.entity';
import { EquipmentSeedService } from './seed-equipments';

@Module({
  imports: [TypeOrmModule.forFeature([Equipment])],
  controllers: [EquipmentsController],
  providers: [EquipmentsService, EquipmentSeedService],
  exports: [EquipmentsService],
})
export class EquipmentsModule {}
