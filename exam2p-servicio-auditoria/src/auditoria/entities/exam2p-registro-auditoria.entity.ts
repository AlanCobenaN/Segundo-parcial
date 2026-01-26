import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('exam2p_registro_auditoria')
export class Exam2PRegistroAuditoria {
  @PrimaryGeneratedColumn()
  registroId: number;

  @Column('varchar', { length: 255 })
  exam2p_entidad: string;

  @Column('int')
  exam2p_registroAfectadoId: number;

  @Column('varchar', { length: 50 })
  exam2p_accion: string;

  @Column('varchar', { length: 255 })
  exam2p_usuario: string;

  @CreateDateColumn()
  exam2p_fechaHora: Date;

  @Column('text', { nullable: true })
  exam2p_detalle: string;
}