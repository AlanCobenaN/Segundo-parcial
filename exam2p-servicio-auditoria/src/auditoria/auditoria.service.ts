import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Exam2PRegistroAuditoria } from './entities/exam2p-registro-auditoria.entity';
import { RegistroEliminadoDto } from './dto/registro-eliminado.dto';
import { ConsultarAuditoriaDto } from './dto/consultar-auditoria.dto';
import { WebhookEmitterService } from './services/webhook-emitter.service';

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(Exam2PRegistroAuditoria)
    private readonly auditoriaRepository: Repository<Exam2PRegistroAuditoria>,
    private readonly webhookEmitterService: WebhookEmitterService,
  ) {}

  async registrarEliminacion(data: RegistroEliminadoDto): Promise<Exam2PRegistroAuditoria> {
    this.logger.log(`📝 Registrando eliminación: ${data.entidad} ID ${data.registroAfectadoId}`);

    const registro = this.auditoriaRepository.create({
      exam2p_entidad: data.entidad,
      exam2p_registroAfectadoId: data.registroAfectadoId,
      exam2p_accion: 'ELIMINAR',
      exam2p_usuario: data.usuario,
      exam2p_detalle: data.detalle || `Registro eliminado de ${data.entidad}`,
    });

    const guardado = await this.auditoriaRepository.save(registro);
    
    this.logger.log(`✅ Auditoría guardada con ID: ${guardado.registroId}`);

    if (guardado.exam2p_accion === 'ELIMINAR') {
      this.logger.log(`🔔 Acción ELIMINAR detectada. Emitiendo webhook...`);

      await this.webhookEmitterService.emitir({
        evento: 'exam2p.auditoria.eliminacion',
        fechaHora: guardado.exam2p_fechaHora,
        datos: {
          registroId: guardado.registroId,
          entidad: guardado.exam2p_entidad,
          registroAfectadoId: guardado.exam2p_registroAfectadoId,
          usuario: guardado.exam2p_usuario,
          detalle: guardado.exam2p_detalle,
        },
      });
    }
    
    return guardado;
  }

  // ⚠️ NUEVO: Método de consulta con filtros
  async consultarConFiltros(filtros: ConsultarAuditoriaDto): Promise<Exam2PRegistroAuditoria[]> {
    this.logger.log('🔍 Consultando auditoría con filtros');
    this.logger.log(`📦 Filtros recibidos: ${JSON.stringify(filtros)}`);

    const query = this.auditoriaRepository.createQueryBuilder('auditoria');

    // Filtro por entidad
    if (filtros.entidad) {
      query.andWhere('auditoria.exam2p_entidad = :entidad', { entidad: filtros.entidad });
    }

    // Filtro por acción
    if (filtros.accion) {
      query.andWhere('auditoria.exam2p_accion = :accion', { accion: filtros.accion });
    }

    // Filtro por usuario
    if (filtros.usuario) {
      query.andWhere('auditoria.exam2p_usuario = :usuario', { usuario: filtros.usuario });
    }

    // Filtro por rango de fechas
    if (filtros.fechaDesde && filtros.fechaHasta) {
      query.andWhere('auditoria.exam2p_fechaHora BETWEEN :desde AND :hasta', {
        desde: filtros.fechaDesde,
        hasta: filtros.fechaHasta,
      });
    } else if (filtros.fechaDesde) {
      query.andWhere('auditoria.exam2p_fechaHora >= :desde', {
        desde: filtros.fechaDesde,
      });
    } else if (filtros.fechaHasta) {
      query.andWhere('auditoria.exam2p_fechaHora <= :hasta', {
        hasta: filtros.fechaHasta,
      });
    }

    // Ordenar por fecha descendente
    query.orderBy('auditoria.exam2p_fechaHora', 'DESC');

    // Limitar resultados
    const limite = filtros.limite || 10;
    query.limit(limite);

    const resultados = await query.getMany();

    this.logger.log(`✅ Consulta completada: ${resultados.length} registros encontrados`);

    return resultados;
  }

  async obtenerTodos(): Promise<Exam2PRegistroAuditoria[]> {
    return await this.auditoriaRepository.find({
      order: { exam2p_fechaHora: 'DESC' }
    });
  }
}