import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateReferralConfigDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    description: '% descuento en próxima renovación del referidor',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  referrerDiscountPct?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    description: '% descuento en primer pago del referido',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  referredDiscountPct?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 720,
    description: 'Horas de vigencia del link generado',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  linkTtlHours?: number;

  @ApiPropertyOptional({
    description: 'Habilita o deshabilita el sistema de referidos',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
