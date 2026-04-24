import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { NotificationType } from '../../../common/enums/notification-type.enum';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type_enum',
  })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'resource_type',
  })
  resourceType!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'resource_id' })
  resourceId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'action_url' })
  actionUrl!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  data!: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true, name: 'read_at' })
  readAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'dismissed_at' })
  dismissedAt!: Date | null;

  @Column({ type: 'boolean', default: false, name: 'push_sent' })
  pushSent!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'push_sent_at' })
  pushSentAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'push_error' })
  pushError!: string | null;

  @Column({ type: 'boolean', default: false, name: 'email_sent' })
  emailSent!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'email_sent_at' })
  emailSentAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
