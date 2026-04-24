import { IsString, Length, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Marca un stop como incidente (no entregado). */
export class StopIncidentDto {
  @ApiProperty({
    example: 'Cliente ausente, no se pudo entregar',
    maxLength: 500,
  })
  @IsString()
  @Length(3, 500)
  reason!: string;

  @ApiPropertyOptional({ description: 'Foto del incidente', format: 'uri' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(0, 500)
  photoUrl?: string;
}
