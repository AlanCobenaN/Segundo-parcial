import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Producto } from './entities/producto.entity';

@Injectable()
export class ProductosService {
  private readonly logger = new Logger(ProductosService.name);

  constructor(
    @InjectRepository(Producto)
    private readonly productoRepository: Repository<Producto>,
    @Inject('AUDITORIA_SERVICE') private readonly auditoriaClient: ClientProxy,
  ) {}

  async crear(data: { nombre: string; stock: number; precio: number }): Promise<Producto> {
    const producto = this.productoRepository.create({
      nombre: data.nombre,
      stock: data.stock,
      precio: data.precio,
    });

    return await this.productoRepository.save(producto);
  }

  async eliminar(id: number, usuario: string): Promise<void> {
    const producto = await this.productoRepository.findOne({ where: { id } });
    
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    this.logger.log(`🗑️ Eliminando producto ID ${id}`);

    // Eliminar de BD
    await this.productoRepository.delete(id);

    // Emitir evento de auditoría
    this.logger.log(`📤 Emitiendo evento: exam2p.registro.eliminado`);
    
    this.auditoriaClient.emit('exam2p.registro.eliminado', {
      entidad: 'Producto',
      registroAfectadoId: id,
      usuario: usuario,
      detalle: `Producto "${producto.nombre}" eliminado del sistema`,
    });

    this.logger.log(`✅ Producto eliminado y evento emitido`);
  }

  async obtenerTodos(): Promise<Producto[]> {
    return await this.productoRepository.find();
  }
}