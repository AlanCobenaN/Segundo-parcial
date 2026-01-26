import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './services/auditoria.service';
import { GeminiService } from './services/gemini.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUDITORIA_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'exam2p_auditoria_consulta_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, GeminiService],
})
export class AuditoriaModule {}