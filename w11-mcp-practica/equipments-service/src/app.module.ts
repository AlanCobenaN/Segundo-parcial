import { Module } from '@nestjs/common';
import { EquipmentsModule } from './equipments/equipments.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from './equipments/entities/equipment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_NAME || 'equipments.sqlite',
      entities: [Equipment],
      synchronize: true, // Solo en desarrollo
      logging: ['error', 'warn'],
    }),
    EquipmentsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
