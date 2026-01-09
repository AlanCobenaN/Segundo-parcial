import { Module } from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { RepairOrdersController } from './repair-orders.controller';
import { RepairOrder } from './entities/repair-order.entity';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TemporalClient } from '../temporal/client';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RepairOrder]),
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
    WebhooksModule,
  
  ],
  controllers: [RepairOrdersController],
  providers: [RepairOrdersService, TemporalClient, IdempotencyService],
  exports: [RepairOrdersService],
})
export class RepairOrdersModule {}
