import { Controller, Post, Delete, Get, Body, Param, Query } from '@nestjs/common';
import { ProductosService } from './productos.service';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  async crear(@Body() data: { nombre: string; stock: number; precio: number }) {
    return await this.productosService.crear(data);
  }

  @Delete(':id')
  async eliminar(
    @Param('id') id: string,
    @Query('usuario') usuario: string = 'sistema',
  ) {
    await this.productosService.eliminar(+id, usuario);
    return { success: true, message: 'Producto eliminado y auditoría registrada' };
  }

  @Get()
  async obtenerTodos() {
    return await this.productosService.obtenerTodos();
  }
}