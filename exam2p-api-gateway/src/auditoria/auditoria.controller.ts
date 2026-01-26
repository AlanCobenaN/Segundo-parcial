import { Controller, Post, Body, Get, Query, Logger } from '@nestjs/common';
import { AuditoriaService } from './services/auditoria.service';
import { ConsultarAuditoriaDto } from './dto/consultar-auditoria.dto';
import { ConsultarIaDto } from './dto/consultar-ia.dto';

@Controller('exam2p-auditoria')
export class AuditoriaController {
  private readonly logger = new Logger(AuditoriaController.name);

  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  async consultarConFiltros(@Query() filtros: ConsultarAuditoriaDto) {
    this.logger.log('📥 GET /exam2p-auditoria - Consulta con filtros');
    return await this.auditoriaService.consultarConFiltros(filtros);
  }

  @Post('consultar-ia')
  async consultarConIA(@Body() body: ConsultarIaDto) {
    this.logger.log('📥 POST /exam2p-auditoria/consultar-ia');
    this.logger.log(`🗣️ Consulta: "${body.consulta}"`);

    const respuesta = await this.auditoriaService.consultarConIA(body.consulta);

    return {
      success: true,
      consulta: body.consulta,
      respuesta: respuesta,
    };
  }
}