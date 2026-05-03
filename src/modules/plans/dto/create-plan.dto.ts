import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsIn,
  IsObject,
  Matches,
  Min,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ALL_PLAN_AUDIENCES, PlanAudience } from '../enums/plan-audience.enum';
import { ALL_PLAN_TIERS, PlanTier } from '../enums/plan-tier.enum';
import type { PlanLimitsMap } from '../interfaces/plan-limits-map.interface';

export class CreatePlanDto {
  @ApiProperty({
    example: 'Pro Courier',
    description: 'Nombre comercial del plan (mostrado al usuario).',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  /**
   * Slug estable usado por la lógica del sistema. Debe ser snake_case.
   * Ej: `free_courier`, `pro_courier`, `enterprise_fleet`.
   */
  @ApiPropertyOptional({
    example: 'pro_courier',
    description:
      'Slug estable en snake_case. Único globalmente. Si no se provee al crear, se requerirá antes del Sprint A final.',
    pattern: '^[a-z][a-z0-9_]*$',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'code debe ser snake_case (minúsculas, dígitos y guiones bajos; comenzando por letra).',
  })
  code?: string;

  @ApiPropertyOptional({
    enum: ALL_PLAN_AUDIENCES,
    example: PlanAudience.COURIER,
    description: 'Audiencia del plan.',
  })
  @IsOptional()
  @IsIn(ALL_PLAN_AUDIENCES)
  audience?: PlanAudience;

  @ApiPropertyOptional({
    enum: ALL_PLAN_TIERS,
    example: PlanTier.PRO,
    description: 'Tier del plan dentro de su audience.',
  })
  @IsOptional()
  @IsIn(ALL_PLAN_TIERS)
  tier?: PlanTier;

  @ApiPropertyOptional({
    description:
      'Límites cuantitativos del plan (jsonb materializado). La fuente de verdad sigue siendo la tabla plan_limits.',
    example: {
      trucking: { max_trucks: 10 },
      global: { maxShipmentsPerDay: 200 },
    },
  })
  @IsOptional()
  @IsObject()
  limits?: PlanLimitsMap;

  @ApiPropertyOptional({
    example: 'Plan para couriers individuales con optimización avanzada.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 9.99, description: 'Precio en la moneda del plan.' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 'month',
    description: 'Periodicidad del cobro (month | year).',
  })
  @IsString()
  interval: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
