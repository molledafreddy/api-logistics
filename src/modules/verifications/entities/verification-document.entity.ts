import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { Verification } from './verification.entity';

@Entity('verification_documents')
export class VerificationDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'verification_id' })
  verificationId!: string;

  @ManyToOne(() => Verification, (v) => v.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'verification_id' })
  verification!: Verification;

  @Column({ type: 'varchar', length: 50, name: 'document_type' })
  documentType!: string;

  @Column({ type: 'varchar', length: 500, name: 'file_url' })
  fileUrl!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'file_name' })
  fileName!: string | null;

  @Column({ type: 'int', nullable: true, name: 'file_size' })
  fileSize!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'mime_type' })
  mimeType!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by' })
  reviewedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_at' })
  reviewedAt!: Date | null;

  @Column({ type: 'text', nullable: true, name: 'review_notes' })
  reviewNotes!: string | null;

  @Column({ type: 'timestamptz', name: 'uploaded_at', default: () => 'NOW()' })
  uploadedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
