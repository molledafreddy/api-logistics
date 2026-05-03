import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanAudience } from '../enums/plan-audience.enum';
import { PlanTier } from '../enums/plan-tier.enum';
import type { PlanLimitsMap } from '../interfaces/plan-limits-map.interface';

/**
 * Representación de un Plan en respuestas REST y en el catálogo público.
 */
export class PlanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({
    example: 'pro_courier',
    description: 'Slug estable (snake_case). Único globalmente.',
  })
  code: string | null;

  @ApiProperty({ example: 'Pro Courier' })
  name: string;

  @ApiPropertyOptional({
    example: 'Plan para couriers individuales con optimización avanzada.',
  })
  description?: string | null;

  @ApiPropertyOptional({ enum: PlanAudience, example: PlanAudience.COURIER })
  audience: PlanAudience | null;

  @ApiPropertyOptional({ enum: PlanTier, example: PlanTier.PRO })
  tier: PlanTier | null;

  @ApiProperty({ example: 9.99 })
  price: number;

  @ApiProperty({ example: 'month' })
  interval: string;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({
    description:
      'Límites materializados (jsonb) — fuente de verdad: tabla plan_limits.',
    example: {
      global: { maxShipmentsPerDay: 200, maxStopsPerOptimization: 50 },
    },
  })
  limits: PlanLimitsMap;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updated_at: Date;
}
