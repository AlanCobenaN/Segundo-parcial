import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ConsultarAuditoriaDto } from '../dto/consultar-auditoria.dto';
import { GeminiService } from '../services/gemini.service';

@Injectable()
export class AuditoriaService implements OnModuleInit {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @Inject('AUDITORIA_SERVICE') private readonly auditoriaClient: ClientProxy,
    private readonly geminiService: GeminiService,
  ) {}

  async onModuleInit() {
    // ⚠️ CRÍTICO: Conectar cliente antes de usarlo
    await this.auditoriaClient.connect();
    this.logger.log('✅ Cliente RabbitMQ conectado');
  }

  async consultarConFiltros(filtros: ConsultarAuditoriaDto): Promise<any> {
    this.logger.log('📡 Enviando consulta a microservicio de auditoría');
    this.logger.log(`🔍 Filtros: ${JSON.stringify(filtros)}`);

    try {
      const resultado = await firstValueFrom(
        this.auditoriaClient.send('exam2p.auditoria.consultar', filtros),
      );

      this.logger.log(`✅ Respuesta recibida: ${resultado.total} registros`);

      return resultado;
    } catch (error) {
      this.logger.error(`❌ Error consultando auditoría: ${error.message}`);
      throw error;
    }
  }

  async consultarConIA(consulta: string): Promise<string> {
    this.logger.log(`🤖 Consulta IA: "${consulta}"`);

    const respuesta = await this.geminiService.procesarConsulta(
      consulta,
      async (params: ConsultarAuditoriaDto) => {
        return await this.consultarConFiltros(params);
      },
    );

    return respuesta;
  }
}