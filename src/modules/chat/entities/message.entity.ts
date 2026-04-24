import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('chat_messages')
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Column({ type: 'uuid', name: 'sender_id' })
  senderId!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'text',
    comment: 'text | image | file | system',
  })
  type!: string;

  @Column({ type: 'text' })
  content!: string;

  // Para mensajes con archivos
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'file_url' })
  fileUrl!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'file_name' })
  fileName!: string | null;

  // Lista de userIds que ya leyeron el mensaje
  @Column({ type: 'jsonb', default: [], name: 'read_by' })
  readBy!: string[];

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;
}
