import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

@Entity('push_tokens')
export class PushToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 500, unique: true })
  token!: string;

  @Column({ type: 'enum', enum: DevicePlatform })
  platform!: DevicePlatform;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'device_name' })
  deviceName!: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_used_at' })
  lastUsedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
