import { IsOptional, IsString, Length, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Cierra un stop como entregado/realizado correctamente. */
export class StopDoneDto {
  @ApiPropertyOptional({ description: 'Notas del driver', maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Para freight: nombre de quién firmó el POD. Para passenger: persona que recibió al pasajero.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  signedBy?: string;

  @ApiPropertyOptional({ description: 'URL del POD/foto', format: 'uri' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(0, 500)
  podUrl?: string;
}
