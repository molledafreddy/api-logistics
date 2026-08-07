import {
  Entity,
  Column,
  Index,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/helpers/base.entity';
import { UserRole } from '../../../common/enums/user-role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'uuid', unique: true, nullable: true, name: 'auth_uid' })
  authUid!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'company_id' })
  companyId!: string | null;

  // ─── Relation: Company (lazy) ──────────
  @ManyToOne('Company', 'employees', { nullable: true, lazy: true })
  @JoinColumn({ name: 'company_id' })
  company!: Promise<
    import('../../companies/entities/company.entity').Company | null
  >;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'password_hash',
  })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'avatar_url' })
  avatarUrl!: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role_enum',
    default: UserRole.DRIVER,
  })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status_enum',
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @Column({ type: 'varchar', length: 50, default: 'America/New_York' })
  timezone!: string;

  @Column({ type: 'varchar', length: 5, default: 'en' })
  language!: string;

  @Column({ type: 'jsonb', default: {} })
  settings!: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt!: Date | null;

  @Column({ type: 'inet', nullable: true, name: 'last_login_ip' })
  lastLoginIp!: string | null;

  @Column({ type: 'int', default: 0, name: 'failed_login_attempts' })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'locked_until' })
  lockedUntil!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'email_verified_at' })
  emailVerifiedAt!: Date | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'email_verification_code_hash',
  })
  emailVerificationCodeHash!: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'email_verification_code_expires_at',
  })
  emailVerificationCodeExpiresAt!: Date | null;

  @Column({ type: 'int', default: 0, name: 'email_verification_attempts' })
  emailVerificationAttempts!: number;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'email_verification_last_sent_at',
  })
  emailVerificationLastSentAt!: Date | null;

  // ─── Password reset fields ─────────────
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'password_reset_code_hash',
  })
  passwordResetCodeHash!: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'password_reset_code_expires_at',
  })
  passwordResetCodeExpiresAt!: Date | null;

  @Column({ type: 'int', default: 0, name: 'password_reset_attempts' })
  passwordResetAttempts!: number;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'password_reset_last_sent_at',
  })
  passwordResetLastSentAt!: Date | null;

  // ─── Invitation fields ─────────────────
  @Column({ type: 'uuid', nullable: true, name: 'invited_by_id' })
  invitedById!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
    name: 'invitation_token',
  })
  invitationToken!: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'invitation_expires_at',
  })
  invitationExpiresAt!: Date | null;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  // ─── Computed ──────────────────────────
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get isEmailVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }

  get isLocked(): boolean {
    return this.lockedUntil !== null && this.lockedUntil > new Date();
  }
}
