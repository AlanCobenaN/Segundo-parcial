import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('AuditoriaMain');

  // Crear aplicación híbrida (Microservicio + HTTP opcional)
  const app = await NestFactory.create(AppModule);
  
  // Configurar como microservicio RabbitMQ
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'],
      queue: 'exam2p_auditoria_queue',
      queueOptions: {
        durable: true,
      },
      noAck: true,},
});// ⚠️ NUEVO: Escuchar también en queue de consultas
app.connectMicroservice<MicroserviceOptions>({
transport: Transport.RMQ,
options: {
urls: ['amqp://localhost:5672'],
queue: 'exam2p_auditoria_consulta_queue',
queueOptions: {
durable: true,
},
noAck: true,
},
});app.useGlobalPipes(new ValidationPipe());await app.startAllMicroservices();logger.log('🚀 Microservicio de Auditoría escuchando en RabbitMQ...');
logger.log('📡 Queue eventos: exam2p_auditoria_queue');
logger.log('📡 Queue consultas: exam2p_auditoria_consulta_queue');
logger.log('🔔 Esperando:');
logger.log('  - EventPattern: exam2p.registro.eliminado');
logger.log('  - MessagePattern: exam2p.auditoria.consultar');
}bootstrap();