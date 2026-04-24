import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class OptimizeRunDto {
  @ApiPropertyOptional({
    enum: ['haversine', 'google_routes', 'mapbox'],
    description: 'Provider a usar. Si se omite, usa el default del servidor.',
  })
  @IsOptional()
  @IsEnum(['haversine', 'google_routes', 'mapbox'])
  provider?: 'haversine' | 'google_routes' | 'mapbox';

  @ApiPropertyOptional({
    description: 'Velocidad promedio en km/h (default 35).',
    minimum: 5,
    maximum: 130,
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  avgSpeedKmh?: number;

  @ApiPropertyOptional({
    description: 'Tiempo de servicio por parada en minutos (default 5).',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  serviceTimePerStopMin?: number;
}

export class OptimizedStopDto {
  @ApiProperty({ format: 'uuid' })
  shipmentId!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({
    example: 4.32,
    description: 'Distancia desde el stop anterior (km)',
  })
  distanceFromPrevKm!: number;

  @ApiProperty({
    example: 12.5,
    description: 'Duración estimada desde el stop anterior (min)',
  })
  durationFromPrevMin!: number;
}

export class OptimizationResultDto {
  @ApiProperty({ enum: ['haversine', 'google_routes', 'mapbox'] })
  provider!: 'haversine' | 'google_routes' | 'mapbox';

  @ApiProperty({ example: 23.45 })
  totalDistanceKm!: number;

  @ApiProperty({ example: 95.5 })
  totalDurationMin!: number;

  @ApiProperty({ type: [OptimizedStopDto] })
  sequence!: OptimizedStopDto[];

  @ApiPropertyOptional({
    description: 'true si el provider remoto falló y se usó Haversine',
  })
  fellBackToHaversine?: boolean;

  @ApiProperty({ format: 'date-time', nullable: true })
  optimizedAt!: Date | null;
}

export class EtaStopDto {
  @ApiProperty({ format: 'uuid' })
  shipmentId!: string;

  @ApiProperty({ example: 3, description: 'Posición en la secuencia' })
  order!: number;

  @ApiProperty({ format: 'date-time', nullable: true })
  etaAt!: Date | null;

  @ApiProperty({ example: 5.4 })
  remainingDistanceKm!: number;

  @ApiProperty({ example: 18.2 })
  remainingDurationMin!: number;

  @ApiProperty({ example: 'pending', enum: ['pending', 'completed'] })
  state!: 'pending' | 'completed';
}

export class EtaResponseDto {
  @ApiProperty({ format: 'uuid' })
  runId!: string;

  @ApiProperty({
    description: 'Origen usado para calcular (último GPS o origen del run)',
  })
  origin!: {
    lat: number;
    lng: number;
    source: 'gps' | 'first_stop' | 'unknown';
  };

  @ApiProperty({ format: 'date-time', nullable: true })
  computedAt!: Date | null;

  @ApiProperty({ type: [EtaStopDto] })
  stops!: EtaStopDto[];
}
