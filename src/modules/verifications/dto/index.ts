import {
  IsUUID,
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVerificationDto {
  @ApiProperty({ description: 'UUID of the company requesting verification' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ description: 'UUID of the verification tier to apply for' })
  @IsUUID()
  tierId!: string;
}

export class SubmitVerificationDto {
  @ApiPropertyOptional({
    description: 'Optional notes or comment when submitting for review',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewVerificationDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    description: 'Admin decision: approve or reject the verification',
  })
  @IsEnum({ approved: 'approved', rejected: 'rejected' })
  decision!: 'approved' | 'rejected';

  @ApiPropertyOptional({
    description: 'Reason for rejection (required if decision is rejected)',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Admin notes/comments about the review' })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class CreateVerificationTierDto {
  @ApiProperty({
    description: 'Unique tier code (e.g., BASIC, STANDARD, PREMIUM)',
  })
  @IsString()
  code!: string;

  @ApiProperty({ description: 'Display name of the tier' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Description of what is included in this tier',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Price of this tier in USD (0 for free)',
  })
  @IsOptional()
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({ description: 'Validity period in days' })
  @IsOptional()
  @IsInt()
  validityDays?: number;
}

export class AddDocumentDto {
  @ApiProperty({
    enum: [
      'rut',
      'tax_id',
      'insurance',
      'driver_license',
      'vehicle_registration',
      'permit',
      'other',
    ],
    example: 'rut',
    description: 'Type of document being uploaded',
  })
  @IsEnum([
    'rut',
    'tax_id',
    'insurance',
    'driver_license',
    'vehicle_registration',
    'permit',
    'other',
  ])
  documentType!: string;

  @ApiProperty({
    example: 'http://localhost:3000/api/v1/files/local/verifications/uuid.jpg',
    description: 'URL of the uploaded file',
  })
  @IsString()
  fileUrl!: string;

  @ApiPropertyOptional({
    example: 'RUT de empresa',
    description: 'Display name for the document',
  })
  @IsOptional()
  @IsString()
  fileName?: string;
}

// PARTE 7 · Sprint 6 — Compliance + Onboarding
export * from './compliance-status.dto';
export * from './onboarding-wizard.dto';
