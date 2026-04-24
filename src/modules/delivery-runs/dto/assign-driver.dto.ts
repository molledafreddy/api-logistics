import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DR-005: driver y truck deben pertenecer a la misma `companyId` que el run.
 * DR-006: no se permite cambiar driverId/truckId si status=in_progress.
 *
 * Para desasignar enviar `null` explícitamente.
 */
export class AssignDriverDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'UUID del driver, o null para desasignar',
  })
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  driverId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'UUID del truck, o null para desasignar',
  })
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsUUID()
  truckId?: string | null;
}
