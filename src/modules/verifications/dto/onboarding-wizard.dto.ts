import { ApiProperty } from '@nestjs/swagger';

export class WizardStepDto {
  @ApiProperty({ example: 'company_profile' })
  key!: string;

  @ApiProperty({ example: 'Completa el perfil de empresa' })
  title!: string;

  @ApiProperty({
    example: 'Razón social, dirección, RUT/EIN, contacto principal',
  })
  description!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ description: '¿Este paso ya está completo para la empresa?' })
  completed!: boolean;

  @ApiProperty({
    type: [String],
    description: 'Documentos requeridos en este paso (si aplica)',
  })
  requiredDocuments!: string[];

  @ApiProperty({
    nullable: true,
    description:
      'Si el paso desbloquea operar un serviceType específico, lo indica',
  })
  unlocksServiceType!: string | null;
}

export class OnboardingWizardDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ enum: ['freight', 'passenger', 'mixed'] })
  serviceType!: string;

  @ApiProperty({ enum: ['independent', 'small_fleet', 'enterprise'] })
  businessModel!: string;

  @ApiProperty({ type: [WizardStepDto] })
  steps!: WizardStepDto[];

  @ApiProperty({
    example: 60,
    description: 'Porcentaje de pasos completados (0-100)',
  })
  progressPct!: number;

  @ApiProperty({
    description:
      '¿Onboarding completo? (todos los pasos requeridos hechos + tier aprobado)',
  })
  completed!: boolean;
}
