import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { AuditoriaService } from './auditoria/auditoria.service';
import { RegistroEliminadoDto } from './auditoria/dto/registro-eliminado.dto';
import { ConsultarAuditoriaDto } from './auditoria/dto/consultar-auditoria.dto';

@Controller()
export class AuditoriaController {
  private readonly logger = new Logger(AuditoriaController.name);

  constructor(private readonly auditoriaService: AuditoriaService) {}

  @EventPattern('exam2p.registro.eliminado')
  async handleRegistroEliminado(@Payload() data: RegistroEliminadoDto) {
    this.logger.log(`🔔 Evento recibido: exam2p.registro.eliminado`);
    this.logger.log(`📦 Datos: ${JSON.stringify(data)}`);

    try {
      const resultado = await this.auditoriaService.registrarEliminacion(data);
      
      this.logger.log(`✅ Auditoría procesada correctamente: ID ${resultado.registroId}`);
      
      return { success: true, registroId: resultado.registroId };
    } catch (error) {
      this.logger.error(`❌ Error procesando auditoría: ${error.message}`);
      throw error;
    }
  }

  // Handler para consultas
  @MessagePattern('exam2p.auditoria.consultar')
  async handleConsultar(@Payload() filtros: ConsultarAuditoriaDto) {
    this.logger.log(`🔍 Consulta recibida: exam2p.auditoria.consultar`);
    this.logger.log(`📦 Filtros: ${JSON.stringify(filtros)}`);

    try {
      const registros = await this.auditoriaService.consultarConFiltros(filtros);
      
      this.logger.log(`✅ Consulta procesada: ${registros.length} registros encontrados`);
      
      return {
        success: true,
        total: registros.length,
        registros: registros,
      };
    } catch (error) {
      this.logger.error(`❌ Error consultando auditoría: ${error.message}`);
      throw error;
    }
  }
}