import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EquipmentStatus = 'AVAILABLE' | 'IN_REPAIR' | 'RETIRED';

@Entity('equipment')
export class Equipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  brand: string;

  @Column()
  model: string;

  @Column({ type: 'varchar', length: 20, default: 'AVAILABLE' })
  status!: EquipmentStatus;

  @Column({ nullable: true })
  serialNumber?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
