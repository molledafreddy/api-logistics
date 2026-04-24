import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('chat_conversations')
@Index(['companyId', 'updatedAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'direct',
    comment: 'direct | group | shipment',
  })
  type!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  title!: string | null;

  // Cuando es de tipo "shipment" se vincula con un shipment
  @Column({ type: 'uuid', nullable: true, name: 'shipment_id' })
  shipmentId!: string | null;

  // Lista de userIds participantes (para queries rápidas)
  @Column({ type: 'jsonb', default: [] })
  participantIds!: string[];

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_message_at' })
  lastMessageAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'last_message_preview' })
  lastMessagePreview!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;
}
