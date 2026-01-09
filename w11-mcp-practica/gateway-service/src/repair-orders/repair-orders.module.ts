import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RepairOrdersController } from './repair-orders.controller';
import { GeminiService } from '../gemini/gemini.service';
import { McpClientService } from '../mcp-client/mcp-client.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'REPAIR_ORDERS_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'repair_orders_queue',
          queueOptions: { durable: true },
          socketOptions: {
            heartbeatIntervalInSeconds: 60,
            reconnectTimeInSeconds: 5,
          },
        },
      },
    ]),
  ],
  controllers: [RepairOrdersController],
  providers: [GeminiService, McpClientService],
})
export class RepairOrdersModule {}