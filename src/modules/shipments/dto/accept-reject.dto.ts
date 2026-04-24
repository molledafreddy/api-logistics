import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class AcceptShipmentDto {
  @ApiPropertyOptional({
    description: 'Pasar a true si quiere autoasignar truck/driver al aceptar',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  autoAssign?: boolean;

  @ApiPropertyOptional({
    description: 'Notas opcionales del carrier al aceptar',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}

export class RejectShipmentDto {
  @ApiProperty({
    description: 'Razón del rechazo (obligatoria)',
    maxLength: 500,
    example: 'No tenemos camiones disponibles para esa fecha',
  })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
