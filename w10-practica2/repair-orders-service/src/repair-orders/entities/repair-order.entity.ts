import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type OrderRepairStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'IN_REPAIR'
  | 'DELIVERED'
  | 'FAILED';

@Entity('repair_order')
export class RepairOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  equipmentId: string;

  @Column({ type: 'varchar', length: 36 })
  technicianId: string;

  @Column({ type: 'text' })
  problemDescription: string;

  @Column({ type: 'text', nullable: true })
  diagnosis?: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  estimatedCost?: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: OrderRepairStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
