import { Module } from '@nestjs/common';
import { RepairOrdersModule } from './repair-orders/repair-orders.module';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { RepairOrder } from './repair-orders/entities/repair-order.entity';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { TemporalWorker } from './temporal/worker';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_NAME || 'equipments.sqlite',
      entities: [RepairOrder],
      synchronize: true,
      logging: ['error', 'warn'],
    }),

    ClientsModule.register([
      {
        name: 'EQUIPMENTS_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'equipments_queue',
          queueOptions: { durable: true },
          socketOptions: {
            heartbeatIntervalInSeconds: 60,
            reconnectTimeInSeconds: 5,
          },
        },
      },
    ]),

    RepairOrdersModule,
  ],
  controllers: [],
  providers: [TemporalWorker],
})
export class AppModule {}
