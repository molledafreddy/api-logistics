import { ApiProperty } from '@nestjs/swagger';

export class PlanLimitResponseDto {
  @ApiProperty({
    example: 'fbd11d9b-a3e8-4c15-a283-635f9e932f06',
    description: 'UUID del límite',
  })
  id: string;

  @ApiProperty({
    example: '89997dc0-d1f7-45a6-a9f8-b4d17954cead',
    description: 'UUID del plan al que pertenece este límite',
  })
  planId: string;

  @ApiProperty({
    example: 'trucking',
    description:
      'Vertical a la que aplica el límite (trucking, delivery, audit, etc.)',
  })
  vertical: string;

  @ApiProperty({
    example: 'max_trucks',
    description: 'Código identificador del límite dentro de la vertical',
  })
  code: string;

  @ApiProperty({
    example: 10,
    description: 'Valor numérico del límite',
  })
  value: number;

  @ApiProperty({ example: '2026-04-30T00:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-04-30T00:00:00.000Z' })
  updated_at: Date;
}
