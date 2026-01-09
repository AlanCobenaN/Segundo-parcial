import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EquipmentsModule } from './equipments/equipments.module';
import { RepairOrdersModule } from './repair-orders/repair-orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    EquipmentsModule,
    RepairOrdersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
