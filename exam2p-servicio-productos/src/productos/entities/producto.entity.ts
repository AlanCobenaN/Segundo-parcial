import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'integer' })
  stock: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio: number;
}