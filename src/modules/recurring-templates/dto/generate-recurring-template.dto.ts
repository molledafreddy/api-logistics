import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateRecurringTemplateDto {
  @ApiProperty({
    example: '2026-04-24',
    description:
      'Fecha objetivo a generar (YYYY-MM-DD). RT-002: idempotente — si ya existe ' +
      'un run no-cancelado para (template, fecha), se devuelve el existente.',
  })
  @IsDateString()
  date!: string;
}
