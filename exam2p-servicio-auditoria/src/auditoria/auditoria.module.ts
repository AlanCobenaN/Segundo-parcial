import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaController } from '../auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { WebhookEmitterService } from './services/webhook-emitter.service';
import { Exam2PRegistroAuditoria } from './entities/exam2p-registro-auditoria.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exam2PRegistroAuditoria]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, WebhookEmitterService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}