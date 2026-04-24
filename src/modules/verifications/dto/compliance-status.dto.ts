import { ApiProperty } from '@nestjs/swagger';
import { VerificationTierCode } from '../../../common/enums/verification-tier-code.enum';

export class ComplianceStatusDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ enum: ['freight', 'passenger', 'mixed'] })
  serviceType!: string;

  @ApiProperty({
    description: 'Indica si la empresa puede operar dado su serviceType',
  })
  canOperate!: boolean;

  @ApiProperty({
    enum: VerificationTierCode,
    description:
      'Tier mínimo requerido para operar (passenger_safe si passenger/mixed)',
    nullable: true,
  })
  requiredTier!: VerificationTierCode | null;

  @ApiProperty({
    enum: VerificationTierCode,
    nullable: true,
    description: 'Tier actual aprobado y vigente (null si no tiene)',
  })
  currentTier!: VerificationTierCode | null;

  @ApiProperty({
    nullable: true,
    description: 'Fecha de expiración del tier actual',
  })
  currentTierExpiresAt!: Date | null;

  @ApiProperty({
    description: '¿El tier requerido está aprobado y no expirado?',
  })
  hasRequiredTier!: boolean;

  @ApiProperty({
    description:
      'Razón por la que NO puede operar (si canOperate=false). Códigos posibles: ' +
      'no_verification | tier_not_approved | tier_expired | wrong_tier',
    nullable: true,
  })
  blockReason!: string | null;

  @ApiProperty({
    type: [String],
    description:
      'Documentos que faltan por subir (subset de tier.requiredDocuments)',
  })
  missingDocuments!: string[];
}
