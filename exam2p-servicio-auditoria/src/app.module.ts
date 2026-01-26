import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { Exam2PRegistroAuditoria } from './auditoria/entities/exam2p-registro-auditoria.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'auditoria.db',
      entities: [Exam2PRegistroAuditoria],
      synchronize: true,
      logging: true,
    }),
    AuditoriaModule,
  ],
})
export class AppModule {}