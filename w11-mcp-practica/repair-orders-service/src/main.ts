import { config } from 'dotenv';
config(); 
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: process.env.QUEUE_NAME || 'orders_queue',
        queueOptions: { durable: true },
        noAck: false,
        prefetchCount: 1,
        socketOptions: {
          heartbeatIntervalInSeconds: 60,
          reconnectTimeInSeconds: 5,
        },
      },
  });
  await app.listen();
  console.log('REPAIR-ORDERS-SERVICE iniciado correctamente');
  console.log(`RabbitMQ: ${process.env.RABBITMQ_URL ? '✅ Configurado' : '❌ Default'}`);
  console.log('RabbitMQ URL:', process.env.RABBITMQ_URL ? '✅ Configurado' : '❌ Usando default');
}

void bootstrap();